// Users' API keys: kept on the server (encrypted) or sent by the browser with each request, and
// turned into an Access for the market services. Keys are never logged or sent back.
import type { Context } from "hono";
import type { AppEnv } from "../auth/session";
import { sha256 } from "../auth/crypto";
import type { Env } from "../env";
import type { Access } from "../market/access";
import { open, seal } from "./crypto";

export const KEY_SOURCES = ["twelvedata", "alphavantage"] as const;
export type KeySource = (typeof KEY_SOURCES)[number];
export const isKeySource = (v: unknown): v is KeySource => KEY_SOURCES.includes(v as KeySource);

/** The header a browser-kept key comes in, over HTTPS, for that request only. */
export const keyHeader = (source: KeySource) => `x-ticker-key-${source}`;

/** A key's own pause and cache space. */
export async function accessFor(source: KeySource, key: string, userId: string): Promise<Access> {
  return { key, source: `${source}:key:${(await sha256(`key:${key}`)).slice(0, 16)}`, prefix: `u:${userId}:`, own: true };
}

export interface ServerKey {
  source: KeySource;
  last4: string;
  createdAt: number;
}

export async function listKeys(db: D1Database, userId: string): Promise<ServerKey[]> {
  const rows = await db
    .prepare("SELECT source, last4, created_at FROM user_keys WHERE user_id = ?1 ORDER BY source")
    .bind(userId)
    .all<{ source: KeySource; last4: string; created_at: number }>();
  return rows.results.map((r) => ({ source: r.source, last4: r.last4, createdAt: r.created_at }));
}

export async function putKey(env: Env, userId: string, source: KeySource, key: string, now = Date.now()) {
  const s = await seal(env, userId, key);
  await env.DB.prepare(
    `INSERT INTO user_keys (user_id, source, ciphertext, nonce, key_version, last4, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
     ON CONFLICT (user_id, source) DO UPDATE SET ciphertext = excluded.ciphertext, nonce = excluded.nonce,
       key_version = excluded.key_version, last4 = excluded.last4, created_at = excluded.created_at`,
  )
    .bind(userId, source, s.ciphertext, s.nonce, s.version, key.slice(-4), now)
    .run();
}

export async function removeKey(db: D1Database, userId: string, source: KeySource) {
  await db.prepare("DELETE FROM user_keys WHERE user_id = ?1 AND source = ?2").bind(userId, source).run();
}

/** The signed-in user's keys for this request: the browser's first, then the server's. */
export async function userAccess(c: Context<AppEnv>): Promise<Partial<Record<KeySource, Access>>> {
  const user = c.var.user;
  if (!user) return {};
  const out: Partial<Record<KeySource, Access>> = {};
  for (const source of KEY_SOURCES) {
    const sent = c.req.header(keyHeader(source))?.trim();
    if (sent && sent.length <= 200) out[source] = await accessFor(source, sent, user.id);
  }
  if (KEY_SOURCES.every((s) => out[s])) return out;
  const rows = await c.env.DB.prepare("SELECT source, ciphertext, nonce, key_version FROM user_keys WHERE user_id = ?1")
    .bind(user.id)
    .all<{ source: KeySource; ciphertext: string; nonce: string; key_version: number }>();
  for (const r of rows.results) {
    if (out[r.source] || !isKeySource(r.source)) continue;
    try {
      out[r.source] = await accessFor(r.source, await open(c.env, user.id, { ciphertext: r.ciphertext, nonce: r.nonce, version: r.key_version }), user.id);
    } catch {
      console.warn(`A stored ${r.source} key could not be decrypted`);
    }
  }
  return out;
}
