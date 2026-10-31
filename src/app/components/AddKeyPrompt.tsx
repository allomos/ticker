import { useAuth } from "../auth";
import { useI18n } from "../i18n";
import { Link } from "../router";

/** Offers a user's own API key where the free data plan stops: not covered, or busy. */
export function AddKeyPrompt({ kind }: { kind: "unavailable" | "busy" }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const link = (
    <Link className="button button-small" href={user ? "/account/keys" : "/signin"}>
      {t.addKey}
    </Link>
  );
  if (kind === "busy") {
    return (
      <p className="key-prompt small">
        {t.promptBusy} {link}
      </p>
    );
  }
  return (
    <div className="key-prompt">
      <p>
        <strong>{t.promptNotOnPlan}</strong> {t.promptNotOnPlanText}
      </p>
      {link}
    </div>
  );
}
