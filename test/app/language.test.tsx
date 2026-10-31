import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/app/App";
import { formatChange, formatCompact, formatPrice, formatTime } from "../../src/app/format";
import { STORAGE_KEY } from "../../src/app/i18n";
import { detectLocale } from "../../src/shared/locale";

let requests: { path: string; body: any }[] = [];

beforeEach(() => {
  localStorage.clear();
  requests = [];
  history.replaceState(null, "", "/");
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(String(input), "http://localhost");
    requests.push({ path: url.pathname, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (url.pathname === "/auth/me") return Response.json({ user: null });
    if (url.pathname === "/auth/email") return Response.json({ ok: true, local: true });
    return Response.json({ error: "not_found" }, { status: 404 });
  });
});
afterEach(() => vi.restoreAllMocks());

const browserLanguages = (langs: string[]) => vi.spyOn(navigator, "languages", "get").mockReturnValue(langs);

describe("browser language detection", () => {
  it("maps Chinese variants to Simplified or Traditional", () => {
    for (const tag of ["zh-CN", "zh-SG", "zh-Hans", "zh-Hans-CN", "zh"]) expect(detectLocale([tag])).toBe("zh-Hans");
    for (const tag of ["zh-TW", "zh-HK", "zh-MO", "zh-Hant", "zh-Hant-HK"]) expect(detectLocale([tag])).toBe("zh-Hant");
  });

  it("finds Japanese and English, and takes the first language Ticker has", () => {
    expect(detectLocale(["ja-JP"])).toBe("ja");
    expect(detectLocale(["en-GB"])).toBe("en");
    expect(detectLocale(["fr-FR", "ja", "en"])).toBe("ja");
  });

  it("falls back to English", () => {
    expect(detectLocale(["fr-FR", "de"])).toBe("en");
    expect(detectLocale([])).toBe("en");
  });
});

describe("language", () => {
  it("follows the browser's language on a first visit", async () => {
    browserLanguages(["zh-TW", "en"]);
    render(<App />);
    expect(await screen.findByRole("heading", { name: "隨時關注市場行情" })).toBeTruthy();
    expect(document.documentElement.lang).toBe("zh-Hant");
    expect(document.title).toBe("Ticker · 自選股");
    expect(screen.getByRole("link", { name: "登入" })).toBeTruthy();
  });

  it("uses English for a browser language Ticker does not have", async () => {
    browserLanguages(["fr-FR"]);
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Keep an eye on the markets" })).toBeTruthy();
    expect(document.documentElement.lang).toBe("en");
  });

  it("switches from the language menu and keeps the choice after a reload", async () => {
    browserLanguages(["en-US"]);
    const { unmount } = render(<App />);
    await screen.findByRole("heading", { name: "Keep an eye on the markets" });
    fireEvent.change(screen.getByRole("combobox", { name: "Language" }), { target: { value: "ja" } });
    expect(await screen.findByRole("heading", { name: "マーケットの動きをチェック" })).toBeTruthy();
    expect(document.documentElement.lang).toBe("ja");
    expect(document.title).toBe("Ticker · ウォッチリスト");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("ja");
    unmount();

    render(<App />);
    expect(await screen.findByRole("heading", { name: "マーケットの動きをチェック" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "言語" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "日本語", selected: true })).toBeTruthy();
  });

  it("ignores a stored value it does not know", async () => {
    localStorage.setItem(STORAGE_KEY, "klingon");
    browserLanguages(["zh-CN"]);
    render(<App />);
    expect(await screen.findByRole("heading", { name: "随时关注市场行情" })).toBeTruthy();
  });

  it("asks for the sign-in email in the chosen language", async () => {
    localStorage.setItem(STORAGE_KEY, "zh-Hans");
    history.replaceState(null, "", "/signin");
    render(<App />);
    fireEvent.change(await screen.findByLabelText("电子邮件地址"), { target: { value: "ann@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "发送登录链接" }));
    expect(await screen.findByText("请查收邮件")).toBeTruthy();
    await waitFor(() => expect(requests.find((r) => r.path === "/auth/email")?.body).toEqual({ email: "ann@example.com", lang: "zh-Hans" }));
  });
});

describe("number and time formats", () => {
  it("follow the chosen language", () => {
    expect(formatPrice(1234.5, "en")).toBe("1,234.50");
    expect(formatPrice(1234.5, "ja")).toBe("1,234.50");
    expect(formatChange(-4.28, -1.22668, "en").text).toBe("−4.28 (−1.23%)");
    expect(formatCompact(67797500, "en")).toBe("67.8M");
    expect(formatCompact(67797500, "ja")).toBe("6779.75万");
    expect(formatCompact(67797500, "zh-Hans")).toBe("6779.75万");
    expect(formatCompact(67797500, "zh-Hant")).toBe("6779.75萬");
    expect(formatTime("2026-10-30T19:59:00.000Z", "ja")).toMatch(/10月/);
    expect(formatTime("2026-10-30T19:59:00.000Z", "zh-Hans")).toMatch(/10月/);
    expect(formatTime("2026-10-30T19:59:00.000Z", "en")).toMatch(/Oct/);
  });
});
