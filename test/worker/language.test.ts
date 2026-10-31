import { env } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WatchList } from "../../src/shared/lists";
import { app } from "../../src/worker/index";
import { json, requestLink } from "./auth-helpers";

afterEach(() => vi.restoreAllMocks());

const sendFrom = async (lang: unknown) => {
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ id: "x" }));
  const res = await app.request("https://ticker.test/auth/email", json({ email: `lang${Math.random()}@example.com`, lang }), { ...env, RESEND_API_KEY: "test-resend" });
  expect(res.status).toBe(200);
  return JSON.parse(String((fetchSpy.mock.calls.at(-1) as [string, RequestInit])[1].body)) as { subject: string; text: string; html: string };
};

describe("sign-in email language", () => {
  it("is written in the language the user had when asking", async () => {
    expect((await sendFrom("ja")).subject).toBe("Ticker へのログイン");
    expect((await sendFrom("zh-Hans")).subject).toBe("登录 Ticker");
    const hant = await sendFrom("zh-Hant");
    expect(hant.subject).toBe("登入 Ticker");
    expect(hant.text).toMatch(/^開啟此連結即可登入 Ticker：\n\nhttps:\/\/ticker\.test\/signin\/verify\?token=/);
    expect(hant.html).toContain('lang="zh-Hant"');
  });

  it("falls back to English for a missing or unknown language", async () => {
    expect((await sendFrom(undefined)).subject).toBe("Sign in to Ticker");
    expect((await sendFrom("fr")).subject).toBe("Sign in to Ticker");
  });
});

describe("first list's name", () => {
  it("follows the language the user signs up in", async () => {
    const token = await requestLink("hant@example.com");
    const res = await app.request("http://localhost/auth/verify", json({ token, lang: "zh-Hant" }), env);
    const cookie = res.headers.get("set-cookie")!.split(";")[0];
    const { lists } = (await (await app.request("http://localhost/api/lists", { headers: { cookie } }, env)).json()) as { lists: WatchList[] };
    expect(lists.map((l) => l.name)).toEqual(["自選股"]);
  });
});
