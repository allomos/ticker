// A small router on the History API: the app has only a few pages.
import { useEffect, useState, type AnchorHTMLAttributes, type MouseEvent } from "react";

const EVENT = "ticker:navigate";

export function navigate(to: string, replace = false) {
  if (replace) history.replaceState(null, "", to);
  else history.pushState(null, "", to);
  window.dispatchEvent(new Event(EVENT));
  if (!replace) window.scrollTo(0, 0);
}

export function useLocation(): URL {
  const [href, setHref] = useState(() => window.location.href);
  useEffect(() => {
    const update = () => setHref(window.location.href);
    window.addEventListener("popstate", update);
    window.addEventListener(EVENT, update);
    return () => {
      window.removeEventListener("popstate", update);
      window.removeEventListener(EVENT, update);
    };
  }, []);
  return new URL(href);
}

export function Link({ href = "/", onClick, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  const handle = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(href);
  };
  return <a href={href} onClick={handle} {...rest} />;
}

/** The page for one symbol; symbols such as BTC/USD keep their slash, encoded. */
export const quotePath = (symbol: string) => `/quote/${encodeURIComponent(symbol)}`;
