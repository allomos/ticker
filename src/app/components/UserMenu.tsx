import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth";
import { Link, navigate } from "../router";

export function UserMenu() {
  const { user, signOut } = useAuth();
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
        Sign in
      </Link>
    );
  }
  return (
    <div className="user-menu" ref={box}>
      <button className="avatar" aria-label={`Account: ${user.email}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {user.email[0].toUpperCase()}
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-note">{user.email}</div>
          <button
            role="menuitem"
            className="menu-item"
            onClick={async () => {
              setOpen(false);
              await signOut();
              navigate("/");
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
