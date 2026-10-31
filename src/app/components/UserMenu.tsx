import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth";
import { useI18n } from "../i18n";
import { Link, navigate } from "../router";

export function UserMenu() {
  const { user, signOut } = useAuth();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  if (user === undefined) return <div className="user-menu" />;
  if (!user) {
    return (
      <Link className="button button-small" href="/signin">
        {t.signIn}
      </Link>
    );
  }
  return (
    <div className="user-menu" ref={box}>
      <button className="avatar" aria-label={t.account(user.email)} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {user.email[0].toUpperCase()}
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-note">{user.email}</div>
          <button
            role="menuitem"
            className="menu-item"
            onClick={() => {
              setOpen(false);
              navigate("/account/keys");
            }}
          >
            {t.menuKeys}
          </button>
          <button
            role="menuitem"
            className="menu-item"
            onClick={async () => {
              setOpen(false);
              await signOut();
              navigate("/");
            }}
          >
            {t.signOut}
          </button>
        </div>
      )}
    </div>
  );
}
