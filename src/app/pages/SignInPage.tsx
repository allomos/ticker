import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, ApiError } from "../api";
import { useAuth } from "../auth";
import { navigate } from "../router";

export function SignInPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");
  const [local, setLocal] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setState("sending");
    try {
      const r = await api.requestLink(email);
      setLocal(r.local);
      setState("sent");
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "";
      setMessage(
        code === "bad_email"
          ? "That does not look like an email address."
          : code === "too_many"
            ? "Too many sign-in emails for now. Use the latest one, or try again in 15 minutes."
            : "The email could not be sent. Try again in a moment.",
      );
      setState("error");
    }
  };

  if (state === "sent") {
    return (
      <section className="narrow">
        <h1 className="page-title">Check your email</h1>
        <p>
          We sent a sign-in link to <strong>{email}</strong>. Open it on this device within 15 minutes.
        </p>
        {local && <p className="notice small">Running on this computer: no email is sent. The link is in the dev server's log.</p>}
        <p>
          <button className="link-button" onClick={() => setState("idle")}>
            Use another address
          </button>
        </p>
      </section>
    );
  }

  return (
    <section className="narrow">
      <h1 className="page-title">Sign in to Ticker</h1>
      <p className="muted">Enter your email address and we'll send you a link to sign in. No password needed. New here? The same link creates your account.</p>
      <form onSubmit={submit} className="form">
        <label htmlFor="email">Email address</label>
        <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button className="button" type="submit" disabled={state === "sending"}>
          {state === "sending" ? "Sending…" : "Email me a sign-in link"}
        </button>
        {state === "error" && <p className="error">{message}</p>}
      </form>
    </section>
  );
}

export function VerifyPage({ token }: { token: string }) {
  const { setUser } = useAuth();
  const [state, setState] = useState<"ready" | "working" | "bad">(token ? "ready" : "bad");
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => button.current?.focus(), []);

  const finish = async () => {
    setState("working");
    try {
      setUser(await api.verify(token));
      navigate("/", true);
    } catch {
      setState("bad");
    }
  };

  if (state === "bad") {
    return (
      <section className="narrow">
        <h1 className="page-title">This link does not work</h1>
        <p>Sign-in links work once, for 15 minutes. Ask for a new one.</p>
        <p>
          <a className="button" href="/signin" onClick={(e) => (e.preventDefault(), navigate("/signin"))}>
            Get a new link
          </a>
        </p>
      </section>
    );
  }
  return (
    <section className="narrow">
      <h1 className="page-title">Sign in to Ticker</h1>
      <p>One more click to finish signing in.</p>
      <button ref={button} className="button" onClick={finish} disabled={state === "working"}>
        {state === "working" ? "Signing in…" : "Sign in"}
      </button>
    </section>
  );
}
