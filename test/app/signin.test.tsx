import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/app/App";

let signedIn: string | null = null;
let requests: { path: string; body: any }[] = [];

beforeEach(() => {
  signedIn = null;
  requests = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(String(input), "http://localhost");
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    requests.push({ path: url.pathname, body });
    if (url.pathname === "/auth/me") return Response.json({ user: signedIn ? { email: signedIn } : null });
    if (url.pathname === "/auth/email") return Response.json({ ok: true, local: true });
    if (url.pathname === "/auth/verify") {
      if (body.token !== "good") return Response.json({ error: "bad_link" }, { status: 400 });
      signedIn = "ann@example.com";
      return Response.json({ user: { email: signedIn } });
    }
    if (url.pathname === "/auth/code") {
      if (body.code.replace(/[^0-9A-Z]/gi, "").toUpperCase() !== "K7QM4XRP9TWD2HNC") return Response.json({ error: "bad_code", triesLeft: 4 }, { status: 400 });
      signedIn = body.email;
      return Response.json({ user: { email: signedIn } });
    }
    if (url.pathname === "/api/lists") return Response.json({ lists: [{ id: "l1", name: "Watchlist", items: [] }] });
    if (url.pathname === "/auth/signout") {
      signedIn = null;
      return Response.json({ ok: true });
    }
    return Response.json({ error: "not_found" }, { status: 404 });
  });
});
afterEach(() => vi.restoreAllMocks());

describe("sign-in", () => {
  it("asks for an email address and says to check the inbox", async () => {
    history.replaceState(null, "", "/signin");
    render(<App />);
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "ann@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Email me a sign-in link" }));
    expect(await screen.findByText("Check your email")).toBeTruthy();
    expect(requests.find((r) => r.path === "/auth/email")?.body).toEqual({ email: "ann@example.com", lang: "en" });
    expect(screen.getByText(/The link and the code are in the dev server's log/)).toBeTruthy();
  });

  it("finishes signing in from the link with one click, then shows the account", async () => {
    history.replaceState(null, "", "/signin/verify?token=good");
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(window.location.pathname).toBe("/"));
    expect(await screen.findByRole("button", { name: "Account: ann@example.com" })).toBeTruthy();
    expect(await screen.findByRole("tab", { name: /Watchlist/ })).toBeTruthy();
  });

  it("explains a used or expired link", async () => {
    history.replaceState(null, "", "/signin/verify?token=bad");
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("This link does not work")).toBeTruthy();
  });

  it("signs out from the account menu", async () => {
    signedIn = "ann@example.com";
    history.replaceState(null, "", "/");
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Account: ann@example.com" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
    expect(await screen.findByRole("link", { name: "Sign in" })).toBeTruthy();
    expect(requests.some((r) => r.path === "/auth/signout")).toBe(true);
  });
});

const clipboard = (text = "") => {
  const api = { readText: vi.fn(async () => text), writeText: vi.fn(async () => {}) };
  Object.defineProperty(navigator, "clipboard", { value: api, configurable: true });
  return api;
};

describe("sign-in code", () => {
  afterEach(() => Reflect.deleteProperty(navigator, "clipboard"));

  const askForEmail = async () => {
    history.replaceState(null, "", "/signin");
    const view = render(<App />);
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "ann@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Email me a sign-in link" }));
    await screen.findByText("Check your email");
    return view;
  };

  it("signs in with a code pasted from the email", async () => {
    clipboard(" k7qm 4xrp 9twd 2hnc ");
    await askForEmail();
    fireEvent.click(screen.getByRole("button", { name: "Paste" }));
    await waitFor(() => expect((screen.getByLabelText("Sign-in code") as HTMLInputElement).value).toBe("k7qm 4xrp 9twd 2hnc"));
    fireEvent.click(screen.getByRole("button", { name: "Sign in with code" }));
    expect(await screen.findByRole("button", { name: "Account: ann@example.com" })).toBeTruthy();
    expect(window.location.pathname).toBe("/");
    expect(requests.find((r) => r.path === "/auth/code")?.body).toEqual({ email: "ann@example.com", code: "k7qm 4xrp 9twd 2hnc", lang: "en" });
  });

  it("says how many tries are left after a wrong code", async () => {
    await askForEmail();
    expect(screen.queryByRole("button", { name: "Paste" })).toBeNull();
    fireEvent.change(screen.getByLabelText("Sign-in code"), { target: { value: "2222-2222-2222-2222" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in with code" }));
    expect(await screen.findByText("That code does not work. 4 tries left.")).toBeTruthy();
  });

  it("still shows the code field after the app reloads", async () => {
    const view = await askForEmail();
    view.unmount();
    history.replaceState(null, "", "/signin");
    render(<App />);
    expect(await screen.findByText("Check your email")).toBeTruthy();
    expect(screen.getByLabelText("Sign-in code")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Use another address" }));
    expect(await screen.findByLabelText("Email address")).toBeTruthy();
  });

  it("shows the code with a copy button on the page the link opens", async () => {
    const api = clipboard();
    history.replaceState(null, "", "/signin/verify?token=good#code=K7QM-4XRP-9TWD-2HNC");
    render(<App />);
    expect(await screen.findByText("K7QM-4XRP-9TWD-2HNC")).toBeTruthy();
    expect(screen.getByText("Signing in on your home-screen app? Copy this code and paste it there.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(api.writeText).toHaveBeenCalledWith("K7QM-4XRP-9TWD-2HNC"));
    expect(await screen.findByRole("button", { name: "✓ Copied" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("button", { name: "Account: ann@example.com" })).toBeTruthy();
  });
});
