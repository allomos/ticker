import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, ApiError } from "../api";
import { useAuth } from "../auth";
import { MailCheckIcon } from "../components/Icons";
import { LogoMark } from "../components/Logo";
import { useI18n } from "../i18n";
import { navigate } from "../router";

// The address a sign-in email went to, kept for the link's 15 minutes: a home-screen app is often
// reloaded while the user copies the code in the mail app, and must still show the code field.
const PENDING_KEY = "ticker.signin";
const PENDING_MS = 15 * 60_000;

function loadPending(): string | null {
  try {
    const p = JSON.parse(localStorage.getItem(PENDING_KEY) ?? "null");
    return p && typeof p.email === "string" && Date.now() - p.at < PENDING_MS ? p.email : null;
  } catch {
    return null;
  }
}

function savePending(email: string | null) {
  try {
    if (email) localStorage.setItem(PENDING_KEY, JSON.stringify({ email, at: Date.now() }));
    else localStorage.removeItem(PENDING_KEY);
  } catch {
    // Without storage the code field lasts until the page reloads.
  }
}

function CodeForm({ email }: { email: string }) {
  const { t, locale } = useI18n();
  const { setUser } = useAuth();
  const [code, setCode] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<{ kind: "bad"; left: number } | { kind: "void" } | { kind: "failed" } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const canPaste = Boolean(navigator.clipboard?.readText);

  const paste = async () => {
    try {
      setCode((await navigator.clipboard.readText()).trim());
    } catch {
      // Refused: the user pastes into the field by hand.
    }
    input.current?.focus();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setWorking(true);
    setError(null);
    try {
      setUser(await api.signInWithCode(email, code, locale));
      savePending(null);
      navigate("/", true);
    } catch (err) {
      const status = err instanceof ApiError ? err.code : "";
      setError(status === "bad_code" ? { kind: "bad", left: (err as ApiError).triesLeft ?? 0 } : status === "code_void" ? { kind: "void" } : { kind: "failed" });
      setWorking(false);
    }
  };

  return (
    <form onSubmit={submit} className="form code-form">
      <h2 className="section-title">{t.codeTitle}</h2>
      <p className="muted small">{t.codeHelp}</p>
      <label htmlFor="code">{t.codeLabel}</label>
      <div className="code-row">
        <input
          id="code"
          ref={input}
          className="code-input"
          required
          autoComplete="one-time-code"
          autoCapitalize="characters"
          spellCheck={false}
          placeholder="XXXX-XXXX-XXXX-XXXX"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        {canPaste && (
          <button type="button" className="button button-quiet" onClick={paste}>
            {t.paste}
          </button>
        )}
      </div>
      <button className="button button-block" type="submit" disabled={working}>
        {working ? t.signingIn : t.codeSubmit}
      </button>
      {error && <p className="error">{error.kind === "bad" ? t.badCode(error.left) : error.kind === "void" ? t.codeVoid : t.mailFailed}</p>}
    </form>
  );
}

export function SignInPage() {
  const { t, locale } = useI18n();
  const [pending] = useState(loadPending);
  const [email, setEmail] = useState(pending ?? "");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">(pending ? "sent" : "idle");
  const [message, setMessage] = useState<"badEmail" | "tooMany" | "mailFailed">("mailFailed");
  const [local, setLocal] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setState("sending");
    try {
      const r = await api.requestLink(email, locale);
      setLocal(r.local);
      savePending(email);
      setState("sent");
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "";
      setMessage(code === "bad_email" ? "badEmail" : code === "too_many" ? "tooMany" : "mailFailed");
      setState("error");
    }
  };

  if (state === "sent") {
    return (
      <section className="auth-card">
        <span className="auth-badge">
          <MailCheckIcon />
        </span>
        <h1 className="auth-title">{t.checkEmail}</h1>
        <p className="auth-text muted">{t.sentTo(<strong>{email}</strong>)}</p>
        {local && <p className="notice small">{t.localNotice}</p>}
        <CodeForm email={email} />
        <button
          className="button button-quiet button-block"
          onClick={() => {
            savePending(null);
            setState("idle");
          }}
        >
          {t.useAnother}
        </button>
      </section>
    );
  }

  return (
    <section className="auth-card">
      <LogoMark size={40} />
      <h1 className="auth-title">{t.signInTitle}</h1>
      <p className="auth-text muted">{t.signInIntro}</p>
      <form onSubmit={submit} className="form">
        <label htmlFor="email">{t.emailLabel}</label>
        <input id="email" type="email" required autoComplete="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className="button button-block" type="submit" disabled={state === "sending"}>
          {state === "sending" ? t.sending : t.emailMeLink}
        </button>
        {state === "error" && <p className="error">{t[message]}</p>}
      </form>
    </section>
  );
}

/** The code the email's link carries in its fragment (#code=…), which never reaches the server. */
function linkCode(): string | null {
  const code = new URLSearchParams(window.location.hash.slice(1)).get("code");
  return code && /^[0-9A-Z-]{16,24}$/.test(code) ? code : null;
}

function CopyCode({ code }: { code: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const box = useRef<HTMLElement>(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // No clipboard access: select the code so the user can copy it.
      const range = document.createRange();
      range.selectNodeContents(box.current!);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
    }
  };
  return (
    <div className="copy-code">
      <p>{t.copyHint}</p>
      <div className="code-row">
        <code ref={box} className="signin-code">
          {code}
        </code>
        <button className="button" onClick={copy}>
          {copied ? `✓ ${t.copied}` : t.copy}
        </button>
      </div>
    </div>
  );
}

export function VerifyPage({ token }: { token: string }) {
  const { setUser } = useAuth();
  const { t, locale } = useI18n();
  const [state, setState] = useState<"ready" | "working" | "bad">(token ? "ready" : "bad");
  const [code] = useState(linkCode);
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!code) button.current?.focus();
  }, [code]);

  const finish = async () => {
    setState("working");
    try {
      setUser(await api.verify(token, locale));
      navigate("/", true);
    } catch {
      setState("bad");
    }
  };

  if (state === "bad") {
    return (
      <section className="auth-card">
        <LogoMark size={40} />
        <h1 className="auth-title">{t.linkBadTitle}</h1>
        <p className="auth-text muted">{t.linkBadText}</p>
        <a className="button button-block" href="/signin" onClick={(e) => (e.preventDefault(), navigate("/signin"))}>
          {t.getNewLink}
        </a>
      </section>
    );
  }
  return (
    <section className="auth-card">
      <LogoMark size={40} />
      <h1 className="auth-title">{t.signInTitle}</h1>
      {code && <CopyCode code={code} />}
      <p className="auth-text muted">{code ? t.orThisBrowser : t.oneMoreClick}</p>
      <button ref={button} className={code ? "button button-quiet button-block" : "button button-block"} onClick={finish} disabled={state === "working"}>
        {state === "working" ? t.signingIn : t.signIn}
      </button>
    </section>
  );
}
