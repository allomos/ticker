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
    expect(requests.find((r) => r.path === "/auth/email")?.body).toEqual({ email: "ann@example.com" });
    expect(screen.getByText(/The link is in the dev server's log/)).toBeTruthy();
  });

  it("finishes signing in from the link with one click, then shows the account", async () => {
    history.replaceState(null, "", "/signin/verify?token=good");
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(window.location.pathname).toBe("/"));
    expect(await screen.findByRole("button", { name: "Account: ann@example.com" })).toBeTruthy();
    expect(await screen.findByText("Your lists")).toBeTruthy();
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
