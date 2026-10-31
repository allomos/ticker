// The signed-in user's own data API keys: on the server (encrypted) or only in this browser.
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, ApiError, type ServerKey } from "../api";
import { useAuth } from "../auth";
import { browserKeys, KEY_SOURCES, setBrowserKey, type KeySource } from "../browserKeys";
import { useI18n } from "../i18n";
import { Link } from "../router";

const NAMES: Record<KeySource, string> = { twelvedata: "Twelve Data", alphavantage: "Alpha Vantage" };
type Where = "server" | "browser";

function KeyForm({ source, where: initialWhere, fixedWhere, onDone }: { source: KeySource; where: Where; fixedWhere?: boolean; onDone: () => void }) {
  const { t } = useI18n();
  const [key, setKey] = useState("");
  const [where, setWhere] = useState<Where>(initialWhere);
  const [state, setState] = useState<{ kind: "idle" | "checking" } | { kind: "error"; text: string }>({ kind: "idle" });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const value = key.trim();
    if (!value) return;
    setState({ kind: "checking" });
    try {
      if (where === "server") {
        await api.saveKey(source, value);
        setBrowserKey(source, null);
      } else {
        const check = await api.checkKey(source, value);
        if (!check.ok) {
          setState({ kind: "error", text: t.keyRejected(NAMES[source]) });
          return;
        }
        setBrowserKey(source, value);
        await api.removeKey(source).catch(() => {});
      }
      setKey("");
      onDone();
    } catch (err) {
      setState({ kind: "error", text: err instanceof ApiError && err.code === "key_rejected" ? t.keyRejected(NAMES[source]) : t.keyFailed });
    }
  };

  return (
    <form className="form key-form" onSubmit={submit}>
      <label htmlFor={`key-${source}`}>{t.keyLabel}</label>
      <input id={`key-${source}`} autoComplete="off" spellCheck={false} value={key} onChange={(e) => setKey(e.target.value)} />
      {!fixedWhere && (
        <fieldset className="where">
          <legend>{t.whereLabel}</legend>
          {(["server", "browser"] as const).map((w) => (
            <label key={w} className="where-option">
              <input type="radio" name={`where-${source}`} checked={where === w} onChange={() => setWhere(w)} />
              <span>
                <b>{w === "server" ? t.whereServer : t.whereBrowser}</b>
                <span className="muted small">{w === "server" ? t.whereServerHelp : t.whereBrowserHelp}</span>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      <button className="button" type="submit" disabled={state.kind === "checking"}>
        {state.kind === "checking" ? t.keyChecking : t.keyAdd}
      </button>
      {state.kind === "error" && <p className="error">{state.text}</p>}
    </form>
  );
}

function SourceCard({ source, server, onChange }: { source: KeySource; server: ServerKey | undefined; onChange: () => void }) {
  const { t } = useI18n();
  const [form, setForm] = useState<null | "add" | "toBrowser">(null);
  const [added, setAdded] = useState(false);
  const local = browserKeys()[source];
  const done = () => {
    setForm(null);
    setAdded(true);
    onChange();
  };
  const remove = async () => {
    setBrowserKey(source, null);
    if (server) await api.removeKey(source).catch(() => {});
    setAdded(false);
    onChange();
  };
  const toServer = async () => {
    try {
      await api.saveKey(source, local!);
      setBrowserKey(source, null);
      onChange();
    } catch {
      setForm("add");
    }
  };

  return (
    <section className="key-card" aria-labelledby={`title-${source}`}>
      <h2 id={`title-${source}`} className="section-title">
        {NAMES[source]}
      </h2>
      <p className="muted small">{source === "twelvedata" ? t.keyHelpTwelveData : t.keyHelpAlphaVantage}</p>
      <p className="key-status">{local ? t.keyInBrowser(local.slice(-4)) : server ? t.keyOnServer(server.last4) : t.keyNone}</p>
      {added && <p className="notice small">{t.keyAdded}</p>}
      {(local || server) && form === null && (
        <div className="key-actions">
          {local ? (
            <button className="button button-small button-quiet" onClick={toServer}>
              {t.keyMoveToServer}
            </button>
          ) : (
            <button className="button button-small button-quiet" onClick={() => setForm("toBrowser")}>
              {t.keyMoveToBrowser}
            </button>
          )}
          <button className="button button-small button-quiet" onClick={remove}>
            {t.keyRemove}
          </button>
        </div>
      )}
      {!local && !server && form === null && (
        <button className="button button-small" onClick={() => setForm("add")}>
          {t.addKey}
        </button>
      )}
      {form === "toBrowser" && <p className="muted small">{t.keyMoveToBrowserHelp}</p>}
      {form && <KeyForm source={source} where={form === "toBrowser" ? "browser" : "server"} fixedWhere={form === "toBrowser"} onDone={done} />}
    </section>
  );
}

export function KeysPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const [server, setServer] = useState<ServerKey[] | null>(null);
  const [, redraw] = useState(0);
  const load = useCallback(() => {
    api.keys().then(setServer, () => setServer([]));
    redraw((n) => n + 1);
  }, []);
  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (user === undefined) return null;
  if (!user) {
    return (
      <section className="narrow">
        <h1 className="page-title">{t.keysTitle}</h1>
        <p>
          <Link href="/signin">{t.keysSignIn}</Link>
        </p>
      </section>
    );
  }
  return (
    <section className="narrow keys-page">
      <h1 className="page-title">{t.keysTitle}</h1>
      <p className="muted">{t.keysIntro}</p>
      {server &&
        KEY_SOURCES.map((s) => <SourceCard key={s} source={s} server={server.find((k) => k.source === s)} onChange={load} />)}
    </section>
  );
}
