import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, ApiError } from "../api";
import { useAuth } from "../auth";
import { useI18n } from "../i18n";
import { navigate } from "../router";

export function SignInPage() {
  const { t, locale } = useI18n();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState<"badEmail" | "tooMany" | "mailFailed">("mailFailed");
  const [local, setLocal] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setState("sending");
    try {
      const r = await api.requestLink(email, locale);
      setLocal(r.local);
      setState("sent");
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "";
      setMessage(code === "bad_email" ? "badEmail" : code === "too_many" ? "tooMany" : "mailFailed");
      setState("error");
    }
  };

  if (state === "sent") {
    return (
      <section className="narrow">
        <h1 className="page-title">{t.checkEmail}</h1>
        <p>{t.sentTo(<strong>{email}</strong>)}</p>
        {local && <p className="notice small">{t.localNotice}</p>}
        <p>
          <button className="link-button" onClick={() => setState("idle")}>
            {t.useAnother}
          </button>
        </p>
      </section>
    );
  }

  return (
    <section className="narrow">
      <h1 className="page-title">{t.signInTitle}</h1>
      <p className="muted">{t.signInIntro}</p>
      <form onSubmit={submit} className="form">
        <label htmlFor="email">{t.emailLabel}</label>
        <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className="button" type="submit" disabled={state === "sending"}>
          {state === "sending" ? t.sending : t.emailMeLink}
        </button>
        {state === "error" && <p className="error">{t[message]}</p>}
      </form>
    </section>
  );
}

export function VerifyPage({ token }: { token: string }) {
  const { setUser } = useAuth();
  const { t, locale } = useI18n();
  const [state, setState] = useState<"ready" | "working" | "bad">(token ? "ready" : "bad");
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => button.current?.focus(), []);

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
      <section className="narrow">
        <h1 className="page-title">{t.linkBadTitle}</h1>
        <p>{t.linkBadText}</p>
        <p>
          <a className="button" href="/signin" onClick={(e) => (e.preventDefault(), navigate("/signin"))}>
            {t.getNewLink}
          </a>
        </p>
      </section>
    );
  }
  return (
    <section className="narrow">
      <h1 className="page-title">{t.signInTitle}</h1>
      <p>{t.oneMoreClick}</p>
      <button ref={button} className="button" onClick={finish} disabled={state === "working"}>
        {state === "working" ? t.signingIn : t.signIn}
      </button>
    </section>
  );
}
