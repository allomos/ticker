import { Hono } from "hono";
import { isLocale } from "../../shared/locale";
import { createDefaultList } from "../lists/routes";
import { newToken, sha256 } from "./crypto";
import { isLocal, sendSignInMail } from "./mailer";
import { createSession, endSession, type AppEnv } from "./session";

const MINUTE = 60_000;
export const LINK_MINUTES = 15;
/** Sign-in emails per address: 3 in 15 minutes, 10 a day; per network address: 20 an hour. */
export const LIMITS = { emailShort: 3, emailDay: 10, ipHour: 20 };

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,253}\.[^\s@]{2,}$/;

export const auth = new Hono<AppEnv>();

auth.post("/email", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 254) return c.json({ error: "bad_email" }, 400);
  const now = Date.now();
  const ipHash = await sha256(`ip:${c.req.header("cf-connecting-ip") ?? "local"}`);
  const counts = await c.env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM login_tokens WHERE email = ?1 AND created_at > ?2) AS short,
       (SELECT COUNT(*) FROM login_tokens WHERE email = ?1 AND created_at > ?3) AS day,
       (SELECT COUNT(*) FROM login_tokens WHERE ip_hash = ?4 AND created_at > ?5) AS ip`,
  )
    .bind(email, now - 15 * MINUTE, now - 1440 * MINUTE, ipHash, now - 60 * MINUTE)
    .first<{ short: number; day: number; ip: number }>();
  if (counts && (counts.short >= LIMITS.emailShort || counts.day >= LIMITS.emailDay || counts.ip >= LIMITS.ipHour)) {
    return c.json({ error: "too_many" }, 429);
  }
  const token = newToken();
  await c.env.DB.prepare(
    "INSERT INTO login_tokens (token_hash, email, ip_hash, created_at, expires_at) VALUES (?1, ?2, ?3, ?4, ?5)",
  )
    .bind(await sha256(token), email, ipHash, now, now + LINK_MINUTES * MINUTE)
    .run();
  const url = new URL(c.req.url);
  const link = `${url.origin}/signin/verify?token=${token}`;
  try {
    await sendSignInMail(c.env, url, { to: email, link, lang: isLocale(body?.lang) ? body.lang : "en" });
  } catch (e) {
    console.error("Sign-in email failed:", (e as Error).message);
    return c.json({ error: "mail_failed" }, 502);
  }
  return c.json({ ok: true, local: isLocal(url) });
});

// The emailed link opens a page that posts the token here, so mail scanners that open links
// do not use it up.
auth.post("/verify", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const token = String(body?.token ?? "");
  if (!token || token.length > 100) return c.json({ error: "bad_link" }, 400);
  const now = Date.now();
  const row = await c.env.DB.prepare(
    "UPDATE login_tokens SET used_at = ?2 WHERE token_hash = ?1 AND used_at IS NULL AND expires_at > ?2 RETURNING email",
  )
    .bind(await sha256(token), now)
    .first<{ email: string }>();
  if (!row) return c.json({ error: "bad_link" }, 400);
  const user = await c.env.DB.prepare(
    `INSERT INTO users (id, email, created_at) VALUES (?1, ?2, ?3)
     ON CONFLICT (email) DO UPDATE SET email = users.email RETURNING id, email, created_at`,
  )
    .bind(crypto.randomUUID(), row.email, now)
    .first<{ id: string; email: string; created_at: number }>();
  if (user!.created_at === now) await createDefaultList(c.env.DB, user!.id, now, isLocale(body?.lang) ? body.lang : "en");
  await createSession(c, user!.id, now);
  return c.json({ user: { email: user!.email } });
});

auth.get("/me", (c) => c.json({ user: c.var.user ? { email: c.var.user.email } : null }));

auth.post("/signout", async (c) => {
  await endSession(c);
  return c.json({ ok: true });
});
