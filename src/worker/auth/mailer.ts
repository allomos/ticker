// Sends the sign-in email: through Resend in production; on this Mac (localhost) the link is
// only written to the dev server's log, so local work never sends real email.
import type { Locale } from "../../shared/locale";
import type { Env } from "../env";

export interface SignInMail {
  to: string;
  link: string;
  /** The same sign-in as a code, K7QM-4XRP-9TWD-2HNC, for the home-screen app. */
  code: string;
  /** The language the user had when they asked for the link. */
  lang: Locale;
}

export function isLocal(url: URL): boolean {
  return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

const MAIL_TEXT: Record<Locale, { subject: string; open: string; click: string; button: string; codeIntro: string; note: string }> = {
  en: {
    subject: "Sign in to Ticker",
    open: "Open this link to sign in to Ticker:",
    click: "Click the button to sign in to Ticker.",
    button: "Sign in to Ticker",
    codeIntro: "Signing in on your home-screen app? Copy this code and paste it there:",
    note: "The link and the code work once, for 15 minutes, and using one uses up the other. If you did not ask to sign in, ignore this email.",
  },
  "zh-Hans": {
    subject: "登录 Ticker",
    open: "打开此链接即可登录 Ticker：",
    click: "点击下方按钮即可登录 Ticker。",
    button: "登录 Ticker",
    codeIntro: "要在主屏幕上的应用中登录？复制此代码并粘贴到应用中：",
    note: "链接和代码只能使用一次，有效期 15 分钟，使用其中一个后另一个也会失效。如果你没有请求登录，请忽略这封邮件。",
  },
  "zh-Hant": {
    subject: "登入 Ticker",
    open: "開啟此連結即可登入 Ticker：",
    click: "按下方按鈕即可登入 Ticker。",
    button: "登入 Ticker",
    codeIntro: "要在主畫面上的應用程式登入？複製此代碼並貼到應用程式中：",
    note: "連結和代碼只能使用一次，有效期限 15 分鐘，使用其中一個後另一個也會失效。如果你沒有要求登入，請忽略這封郵件。",
  },
  ja: {
    subject: "Ticker へのログイン",
    open: "このリンクを開いて Ticker にログインしてください：",
    click: "ボタンをクリックして Ticker にログインしてください。",
    button: "Ticker にログイン",
    codeIntro: "ホーム画面のアプリでログインする場合は、このコードをコピーしてアプリに貼り付けてください：",
    note: "リンクとコードは1回限り、15分間有効です。どちらかを使うと、もう一方も使えなくなります。ログインを依頼していない場合は、このメールを無視してください。",
  },
};

// The logo for email: its name beside the mark's star and dots, drawn as text in the logo's colours,
// since many mail apps block images and drop SVG.
const WORDMARK = `<p style="margin:0 0 16px;font-size:24px;font-weight:700;line-height:1;color:#12223a"><span style="color:#e9c46a">&#10022;</span><span style="color:#2a9d8f;font-size:14px;vertical-align:middle">&#9675;&#9679;</span><span style="color:#e76f51;font-size:18px;vertical-align:middle">&#9679;</span> Ticker</p>`;

export function signInMessage(link: string, code: string, lang: Locale = "en") {
  const m = MAIL_TEXT[lang];
  const subject = m.subject;
  const text = `${m.open}\n\n${link}\n\n${m.codeIntro}\n\n${code}\n\n${m.note}`;
  // Non-breaking hyphens (U+2011) and user-select: all make a long-press select the whole code.
  const shown = code.replace(/-/g, "\u2011");
  const html = `<div lang="${lang}" style="font-family:system-ui,sans-serif;font-size:15px;line-height:1.5;color:#1f2328">
${WORDMARK}
<p>${m.click}</p>
<p><a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 18px;background:#1a73e8;color:#fff;border-radius:6px;text-decoration:none">${m.button}</a></p>
<p>${m.codeIntro}</p>
<p><span style="display:inline-block;padding:12px 18px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:24px;font-weight:600;letter-spacing:2px;white-space:nowrap;background:#f6f8fb;border:1px solid #dde3ea;border-radius:8px;-webkit-user-select:all;user-select:all">${shown}</span></p>
<p style="color:#5f6b7a;font-size:13px">${m.note}</p>
</div>`;
  return { subject, text, html };
}

export async function sendSignInMail(env: Env, requestUrl: URL, mail: SignInMail): Promise<void> {
  if (isLocal(requestUrl)) {
    console.log(`[sign-in for ${mail.to}] code ${mail.code} link ${mail.link}`);
    return;
  }
  if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");
  const { subject, text, html } = signInMessage(mail.link, mail.code, mail.lang);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ from: env.MAIL_FROM, to: [mail.to], subject, text, html }),
  });
  if (!res.ok) throw new Error(`Resend answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
}
