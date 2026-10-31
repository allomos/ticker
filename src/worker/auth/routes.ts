import { Hono, type Context } from "hono";
import { isLocale } from "../../shared/locale";
import { createDefaultList } from "../lists/routes";
import { formatCode, newCode, normalizeCode } from "./code";
import { newToken, sha256 } from "./crypto";
import { isLocal, sendSignInMail } from "./mailer";
import { createSession, endSession, type AppEnv } from "./session";

const MINUTE = 60_000;
export const LINK_MINUTES = 15;
/** Sign-in emails per address: 3 in 15 minutes, 10 a day; per network address: 20 an hour. */
export const LIMITS = { emailShort: 3, emailDay: 10, ipHour: 20 };
/** Wrong codes allowed per sign-in request; the next one voids the request, link and code alike. */
export const CODE_TRIES = 5;

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
  const code = newCode();
  await c.env.DB.prepare(
    "INSERT INTO login_tokens (token_hash, email, ip_hash, created_at, expires_at, code_hash) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
  )
    .bind(await sha256(token), email, ipHash, now, now + LINK_MINUTES * MINUTE, await sha256(`code:${code}`))
    .run();
  const url = new URL(c.req.url);
  // The code rides in the link's fragment, which never reaches the server: the page the link
  // opens shows it for copying into the home-screen app.
  const link = `${url.origin}/signin/verify?token=${token}#code=${formatCode(code)}`;
  try {
    await sendSignInMail(c.env, url, { to: email, link, code: formatCode(code), lang: isLocale(body?.lang) ? body.lang : "en" });
  } catch (e) {
    console.error("Sign-in email failed:", (e as Error).message);
    return c.json({ error: "mail_failed" }, 502);
  }
  return c.json({ ok: true, local: isLocal(url) });
});

/** Signs in the owner of a sign-in request just used up, making the account on first use. */
async function finishSignIn(c: Context<AppEnv>, email: string, lang: unknown, now: number) {
  const user = await c.env.DB.prepare(
    `INSERT INTO users (id, email, created_at) VALUES (?1, ?2, ?3)
     ON CONFLICT (email) DO UPDATE SET email = users.email RETURNING id, email, created_at`,
  )
    .bind(crypto.randomUUID(), email, now)
    .first<{ id: string; email: string; created_at: number }>();
  if (user!.created_at === now) await createDefaultList(c.env.DB, user!.id, now, isLocale(lang) ? lang : "en");
  await createSession(c, user!.id, now);
  return c.json({ user: { email: user!.email } });
}

// The emailed link opens a page that posts the token here, so mail scanners that open links
// do not use it up.
auth.post("/verify", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const token = String(body?.token ?? "");
  if (!token || token.length > 100) return c.json({ error: "bad_link" }, 400);
  const now = Date.now();
  const row = await c.env.DB.prepare(
    `UPDATE login_tokens SET used_at = ?2
     WHERE token_hash = ?1 AND used_at IS NULL AND expires_at > ?2 AND code_tries < ?3 RETURNING email`,
  )
    .bind(await sha256(token), now, CODE_TRIES)
    .first<{ email: string }>();
  if (!row) return c.json({ error: "bad_link" }, 400);
  return finishSignIn(c, row.email, body?.lang, now);
});

// The code from the email, typed or pasted where the link cannot reach (the home-screen app).
// Each wrong code counts against every open request for that address; the fifth voids them.
auth.post("/code", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!EMAIL.test(email) || email.length > 254) return c.json({ error: "bad_email" }, 400);
  const code = normalizeCode(body?.code);
  const now = Date.now();
  if (code) {
    const row = await c.env.DB.prepare(
      `UPDATE login_tokens SET used_at = ?3
       WHERE email = ?1 AND code_hash = ?2 AND used_at IS NULL AND expires_at > ?3 AND code_tries < ?4 RETURNING email`,
    )
      .bind(email, await sha256(`code:${code}`), now, CODE_TRIES)
      .first<{ email: string }>();
    if (row) return finishSignIn(c, row.email, body?.lang, now);
  }
  const open = await c.env.DB.prepare(
    `UPDATE login_tokens SET code_tries = code_tries + 1
     WHERE email = ?1 AND used_at IS NULL AND expires_at > ?2 AND code_tries < ?3 RETURNING code_tries`,
  )
    .bind(email, now, CODE_TRIES)
    .all<{ code_tries: number }>();
  const left = Math.max(0, ...open.results.map((r) => CODE_TRIES - r.code_tries));
  return c.json(left > 0 ? { error: "bad_code", triesLeft: left } : { error: "code_void" }, 400);
});

auth.get("/me", (c) => c.json({ user: c.var.user ? { email: c.var.user.email } : null }));

auth.post("/signout", async (c) => {
  await endSession(c);
  return c.json({ ok: true });
});
