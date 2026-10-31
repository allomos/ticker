// Sends the sign-in email: through Resend in production; on this Mac (localhost) the link is
// only written to the dev server's log, so local work never sends real email.
import type { Env } from "../env";

export interface SignInMail {
  to: string;
  link: string;
}

export function isLocal(url: URL): boolean {
  return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

export function signInMessage(link: string) {
  const subject = "Sign in to Ticker";
  const text = `Open this link to sign in to Ticker:\n\n${link}\n\nIt works once, for 15 minutes. If you did not ask to sign in, ignore this email.`;
  const html = `<div style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#1f2328">
<p>Click the button to sign in to Ticker.</p>
<p><a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 18px;background:#1a73e8;color:#fff;border-radius:6px;text-decoration:none">Sign in to Ticker</a></p>
<p style="color:#5f6b7a;font-size:13px">The link works once, for 15 minutes. If you did not ask to sign in, ignore this email.</p>
</div>`;
  return { subject, text, html };
}

export async function sendSignInMail(env: Env, requestUrl: URL, mail: SignInMail): Promise<void> {
  if (isLocal(requestUrl)) {
    console.log(`[sign-in link for ${mail.to}] ${mail.link}`);
    return;
  }
  if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");
  const { subject, text, html } = signInMessage(mail.link);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: env.MAIL_FROM, to: [mail.to], subject, text, html }),
  });
  if (!res.ok) throw new Error(`Resend answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
}
