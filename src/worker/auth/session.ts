import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Env } from "../env";
import { newToken, sha256 } from "./crypto";

export const SESSION_COOKIE = "ticker_session";
const DAY = 86_400_000;
export const SESSION_DAYS = 30;

export interface User {
  id: string;
  email: string;
}

export type AuthVars = { user: User | null };
export type AppEnv = { Bindings: Env; Variables: AuthVars };

export async function createSession(c: Context<AppEnv>, userId: string, now = Date.now()) {
  const token = newToken();
  await c.env.DB.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?1, ?2, ?3, ?4)")
    .bind(await sha256(token), userId, now, now + SESSION_DAYS * DAY)
    .run();
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === "https:",
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function endSession(c: Context<AppEnv>) {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) await c.env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?1").bind(await sha256(token)).run();
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}

/** Reads the session cookie into `c.var.user`; a session in use is extended once a day. */
export const loadUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.set("user", null);
  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    const now = Date.now();
    const hash = await sha256(token);
    const row = await c.env.DB.prepare(
      `SELECT s.expires_at, u.id, u.email FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?1 AND s.expires_at > ?2`,
    )
      .bind(hash, now)
      .first<{ expires_at: number; id: string; email: string }>();
    if (row) {
      c.set("user", { id: row.id, email: row.email });
      if (row.expires_at - now < (SESSION_DAYS - 1) * DAY) {
        await c.env.DB.prepare("UPDATE sessions SET expires_at = ?2 WHERE token_hash = ?1").bind(hash, now + SESSION_DAYS * DAY).run();
      }
    }
  }
  await next();
};

/** 401 unless signed in. */
export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.var.user) return c.json({ error: "signed_out" }, 401);
  await next();
};

/**
 * Changes must come from this site: a JSON body (which other sites cannot send without asking
 * first) and, when the browser says where the request comes from, the same origin.
 */
export const sameOrigin: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.req.method !== "GET" && c.req.method !== "HEAD") {
    const origin = c.req.header("origin");
    if (origin && origin !== new URL(c.req.url).origin) return c.json({ error: "forbidden" }, 403);
    const type = c.req.header("content-type") ?? "";
    if (!type.startsWith("application/json")) return c.json({ error: "json_required" }, 415);
  }
  await next();
};
