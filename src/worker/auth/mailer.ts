// Sends the sign-in email: through Resend in production; on this Mac (localhost) the link is
// only written to the dev server's log, so local work never sends real email.
import type { Locale } from "../../shared/locale";
import type { Env } from "../env";

export interface SignInMail {
  to: string;
  link: string;
  /** The language the user had when they asked for the link. */
  lang: Locale;
}

export function isLocal(url: URL): boolean {
  return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

const MAIL_TEXT: Record<Locale, { subject: string; open: string; click: string; button: string; note: string }> = {
  en: {
    subject: "Sign in to Ticker",
    open: "Open this link to sign in to Ticker:",
    click: "Click the button to sign in to Ticker.",
    button: "Sign in to Ticker",
    note: "The link works once, for 15 minutes. If you did not ask to sign in, ignore this email.",
  },
  "zh-Hans": {
    subject: "登录 Ticker",
    open: "打开此链接即可登录 Ticker：",
    click: "点击下方按钮即可登录 Ticker。",
    button: "登录 Ticker",
    note: "此链接只能使用一次，有效期 15 分钟。如果你没有请求登录，请忽略这封邮件。",
  },
  "zh-Hant": {
    subject: "登入 Ticker",
    open: "開啟此連結即可登入 Ticker：",
    click: "按下方按鈕即可登入 Ticker。",
    button: "登入 Ticker",
    note: "此連結只能使用一次，有效期限 15 分鐘。如果你沒有要求登入，請忽略這封郵件。",
  },
  ja: {
    subject: "Ticker へのログイン",
    open: "このリンクを開いて Ticker にログインしてください：",
    click: "ボタンをクリックして Ticker にログインしてください。",
    button: "Ticker にログイン",
    note: "このリンクは1回限り、15分間有効です。ログインを依頼していない場合は、このメールを無視してください。",
  },
};

export function signInMessage(link: string, lang: Locale = "en") {
  const m = MAIL_TEXT[lang];
  const subject = m.subject;
  const text = `${m.open}\n\n${link}\n\n${m.note}`;
  const html = `<div lang="${lang}" style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#1f2328">
<p>${m.click}</p>
<p><a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 18px;background:#1a73e8;color:#fff;border-radius:6px;text-decoration:none">${m.button}</a></p>
<p style="color:#5f6b7a;font-size:13px">${m.note}</p>
</div>`;
  return { subject, text, html };
}

export async function sendSignInMail(env: Env, requestUrl: URL, mail: SignInMail): Promise<void> {
  if (isLocal(requestUrl)) {
    console.log(`[sign-in link for ${mail.to}] ${mail.link}`);
    return;
  }
  if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");
  const { subject, text, html } = signInMessage(mail.link, mail.lang);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: env.MAIL_FROM, to: [mail.to], subject, text, html }),
  });
  if (!res.ok) throw new Error(`Resend answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
}
