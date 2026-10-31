import { env } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CODE_ALPHABET, formatCode, newCode, normalizeCode } from "../../src/worker/auth/code";
import { sha256 } from "../../src/worker/auth/crypto";
import { CODE_TRIES } from "../../src/worker/auth/routes";
import { app } from "../../src/worker/index";
import { json } from "./auth-helpers";

afterEach(() => vi.restoreAllMocks());

/** Asks for a sign-in email on localhost and returns the link's token and the code from the log. */
async function request(email: string) {
  const log = vi.spyOn(console, "log").mockImplementation(() => {});
  const res = await app.request("http://localhost/auth/email", json({ email }, { "cf-connecting-ip": `198.51.100.${Math.floor(Math.random() * 250)}` }), env);
  expect(res.status).toBe(200);
  const line = log.mock.calls.map((c) => String(c[0])).find((l) => l.includes(email))!;
  log.mockRestore();
  const [, code, link] = line.match(/ code (\S+) link (\S+)$/)!;
  return { code, link: new URL(link), token: new URL(link).searchParams.get("token")! };
}

const withCode = (email: string, code: string) => app.request("http://localhost/auth/code", json({ email, code }), env);
const withLink = (token: string) => app.request("http://localhost/auth/verify", json({ token }), env);

describe("sign-in code format", () => {
  it("has 16 characters without look-alikes, shown in groups of four", () => {
    expect(CODE_ALPHABET).not.toMatch(/[01OIL]/);
    const codes = new Set(Array.from({ length: 200 }, newCode));
    expect(codes.size).toBe(200);
    for (const c of codes) expect(c).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{16}$/);
    expect(Math.log2(CODE_ALPHABET.length) * 16).toBeGreaterThan(79);
    expect(formatCode("K7QM4XRP9TWD2HNC")).toBe("K7QM-4XRP-9TWD-2HNC");
  });

  it("accepts the code typed loosely", () => {
    for (const typed of ["K7QM-4XRP-9TWD-2HNC", "k7qm4xrp9twd2hnc", " k7qm 4xrp 9twd 2hnc ", "K7QM--4XRP-9TWD-2HNC-", "K7QM‑4XRP‑9TWD‑2HNC"]) {
      expect(normalizeCode(typed)).toBe("K7QM4XRP9TWD2HNC");
    }
    for (const bad of ["K7QM-4XRP-9TWD", "K7QM-4XRP-9TWD-2HNO", "K7QM-4XRP-9TWD-2HN1", "", null]) expect(normalizeCode(bad)).toBeNull();
  });
});

describe("signing in with the code", () => {
  it("is logged beside the link locally, carried in the link's fragment, and stored only as a hash", async () => {
    const { code, link } = await request("hash@example.com");
    expect(code).toMatch(/^[0-9A-Z]{4}(-[0-9A-Z]{4}){3}$/);
    expect(link.hash).toBe(`#code=${code}`);
    const row = await env.DB.prepare("SELECT * FROM login_tokens WHERE email = 'hash@example.com'").first<Record<string, unknown>>();
    expect(row!.code_hash).toBe(await sha256(`code:${normalizeCode(code)}`));
    expect(JSON.stringify(row)).not.toContain(normalizeCode(code)!);
  });

  it("signs in once, typed loosely, and then neither the code nor the link works", async () => {
    const { code, token } = await request("code@example.com");
    const res = await withCode("Code@Example.com", code.toLowerCase().replace(/-/g, " "));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ user: { email: "code@example.com" } });
    expect(res.headers.get("set-cookie")).toMatch(/^ticker_session=/);
    expect(await (await withCode("code@example.com", code)).json()).toEqual({ error: "code_void" });
    expect((await withLink(token)).status).toBe(400);
  });

  it("stops working once the link has been used", async () => {
    const { code, token } = await request("linkfirst@example.com");
    expect((await withLink(token)).status).toBe(200);
    expect(await (await withCode("linkfirst@example.com", code)).json()).toEqual({ error: "code_void" });
  });

  it("expires after 15 minutes", async () => {
    const { code } = await request("late-code@example.com");
    await env.DB.prepare("UPDATE login_tokens SET expires_at = ?1 WHERE email = 'late-code@example.com'").bind(Date.now() - 1).run();
    expect(await (await withCode("late-code@example.com", code)).json()).toEqual({ error: "code_void" });
  });

  it("voids the request after five wrong codes, link included", async () => {
    const { code, token } = await request("guess@example.com");
    for (let i = 1; i < CODE_TRIES; i++) {
      const res = await withCode("guess@example.com", "2222-2222-2222-2222");
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "bad_code", triesLeft: CODE_TRIES - i });
    }
    expect(await (await withCode("guess@example.com", "not a code")).json()).toEqual({ error: "code_void" });
    expect(await (await withCode("guess@example.com", code)).json()).toEqual({ error: "code_void" });
    expect((await withLink(token)).status).toBe(400);
  });

  it("does not take another address's code", async () => {
    const { code } = await request("owner@example.com");
    expect(await (await withCode("other@example.com", code)).json()).toEqual({ error: "code_void" });
    expect((await withCode("owner@example.com", code)).status).toBe(200);
  });

  it("is in the email, in a box that selects as one piece", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ id: "x" }));
    await app.request("https://ticker.test/auth/email", json({ email: "mail-code@example.com", lang: "ja" }), { ...env, RESEND_API_KEY: "test-resend" });
    const sent = JSON.parse(String((fetchSpy.mock.calls.at(-1) as [string, RequestInit])[1].body));
    const code = sent.text.match(/\n\n([0-9A-Z]{4}(?:-[0-9A-Z]{4}){3})\n\n/)[1];
    expect(sent.text).toContain("ホーム画面のアプリでログインする場合は");
    expect(sent.html).toContain("user-select:all");
    expect(sent.html).toContain(code.replace(/-/g, "‑"));
    expect(sent.html).toContain(`#code=${code}`);
  });
});
