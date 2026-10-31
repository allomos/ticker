import { env } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app, cleanUp } from "../../src/worker/index";
import { LIMITS } from "../../src/worker/auth/routes";
import { json, requestLink, signIn } from "./auth-helpers";

afterEach(() => vi.restoreAllMocks());

const me = async (cookie?: string) =>
  (await (await app.request("http://localhost/auth/me", { headers: cookie ? { cookie } : {} }, env)).json()) as { user: { email: string } | null };

describe("sign-in link", () => {
  it("signs in with the link, once", async () => {
    const token = await requestLink("Ann@Example.com");
    const res = await app.request("http://localhost/auth/verify", json({ token }), env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: { email: "ann@example.com" } });
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect((await me(cookie.split(";")[0])).user?.email).toBe("ann@example.com");
    // The same link does not work twice.
    expect((await app.request("http://localhost/auth/verify", json({ token }), env)).status).toBe(400);
  });

  it("refuses an expired link", async () => {
    const token = await requestLink("old@example.com");
    const real = Date.now;
    vi.spyOn(Date, "now").mockReturnValue(real() + 16 * 60_000);
    expect((await app.request("http://localhost/auth/verify", json({ token }), env)).status).toBe(400);
  });

  it("refuses a made-up link and a bad address", async () => {
    expect((await app.request("http://localhost/auth/verify", json({ token: "nope" }), env)).status).toBe(400);
    expect((await app.request("http://localhost/auth/email", json({ email: "not-an-email" }), env)).status).toBe(400);
  });

  it("keeps one account per address", async () => {
    await signIn("same@example.com");
    await signIn("SAME@example.com");
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE email = 'same@example.com'").first<{ n: number }>();
    expect(n?.n).toBe(1);
  });

  it("limits sign-in emails per address", async () => {
    for (let i = 0; i < LIMITS.emailShort; i++) await requestLink("busy@example.com", `203.0.113.${i}`);
    vi.spyOn(console, "log").mockImplementation(() => {});
    const res = await app.request("http://localhost/auth/email", json({ email: "busy@example.com" }), env);
    expect(res.status).toBe(429);
  });

  it("sends the email through Resend when not on localhost", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ id: "x" }));
    const res = await app.request("https://ticker.test/auth/email", json({ email: "real@example.com" }), { ...env, RESEND_API_KEY: "test-resend" });
    expect(res.status).toBe(200);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer test-resend");
    const sent = JSON.parse(String(init.body));
    expect(sent.from).toBe("Ticker <no-reply@ticker.allomos.com>");
    expect(sent.to).toEqual(["real@example.com"]);
    expect(sent.text).toMatch(/^Open this link to sign in to Ticker:\n\nhttps:\/\/ticker\.test\/signin\/verify\?token=/);
  });

  it("says so when the email cannot be sent", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("nope", { status: 500 }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await app.request("https://ticker.test/auth/email", json({ email: "fail@example.com" }), { ...env, RESEND_API_KEY: "test-resend" });
    expect(res.status).toBe(502);
  });
});

describe("sessions", () => {
  it("signs out", async () => {
    const cookie = await signIn("bye@example.com");
    const res = await app.request("http://localhost/auth/signout", json({}, { cookie }), env);
    expect(res.status).toBe(200);
    expect((await me(cookie)).user).toBeNull();
  });

  it("is signed out without a cookie, or with a wrong one", async () => {
    expect((await me()).user).toBeNull();
    expect((await me("ticker_session=forged")).user).toBeNull();
  });

  it("ends after 30 days unused, and clean-up removes it", async () => {
    const cookie = await signIn("late@example.com");
    const later = Date.now() + 31 * 86_400_000;
    vi.spyOn(Date, "now").mockReturnValue(later);
    expect((await me(cookie)).user).toBeNull();
    await cleanUp(env, later);
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM sessions s JOIN users u ON u.id = s.user_id WHERE u.email = 'late@example.com'").first<{ n: number }>();
    expect(n?.n).toBe(0);
  });
});

describe("changes from other sites", () => {
  it("are refused", async () => {
    const res = await app.request("http://localhost/auth/email", json({ email: "x@example.com" }, { origin: "https://evil.example" }), env);
    expect(res.status).toBe(403);
    const form = await app.request("http://localhost/auth/signout", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "a=1" }, env);
    expect(form.status).toBe(415);
  });
});
