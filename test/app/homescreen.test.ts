import { describe, expect, it, vi } from "vitest";
import indexHtml from "../../index.html?raw";
import manifestText from "../../public/manifest.webmanifest?raw";
import offlineHtml from "../../public/offline.html?raw";
import swSource from "../../public/sw.js?raw";

describe("home-screen web app", () => {
  it("has a manifest Chrome can install: name, standalone, start URL, 192, 512 and maskable icons", () => {
    const m = JSON.parse(manifestText);
    expect(m).toMatchObject({ name: "Ticker", short_name: "Ticker", display: "standalone", start_url: "/", scope: "/" });
    expect(m.background_color).toMatch(/^#[0-9a-f]{6}$/);
    expect(m.theme_color).toMatch(/^#[0-9a-f]{6}$/);
    const sizes = m.icons.map((i: { sizes: string; purpose: string }) => `${i.sizes} ${i.purpose}`);
    expect(sizes).toEqual(expect.arrayContaining(["192x192 any", "512x512 any", "512x512 maskable"]));
  });

  it("links the manifest and touch icon, with the iOS standalone tags and safe-area viewport", () => {
    for (const tag of [
      '<link rel="manifest" href="/manifest.webmanifest" />',
      '<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />',
      '<meta name="apple-mobile-web-app-capable" content="yes" />',
      '<meta name="apple-mobile-web-app-title" content="Ticker" />',
      '<meta name="apple-mobile-web-app-status-bar-style" content="default" />',
      "viewport-fit=cover",
    ]) expect(indexHtml).toContain(tag);
  });

  it("shows the offline screen in the user's language", () => {
    expect(offlineHtml).toContain("You're offline – prices will load when you're back online.");
    expect(offlineHtml).toContain("オフラインです");
    expect(offlineHtml).toContain('addEventListener("online"');
  });
});

describe("service worker", () => {
  // Runs public/sw.js against a fake worker scope and cache.
  function load(fetchImpl: () => Promise<Response>) {
    const handlers: Record<string, (e: any) => void> = {};
    const cached = new Map<string, Response>();
    const cache = { addAll: vi.fn(async (urls: string[]) => urls.forEach((u) => cached.set(u, new Response(`cached ${u}`)))) };
    const scope = {
      addEventListener: (type: string, fn: (e: any) => void) => (handlers[type] = fn),
      skipWaiting: vi.fn(),
      clients: { claim: vi.fn() },
    };
    const caches = { open: async () => cache, keys: async () => [], delete: vi.fn(), match: async (u: string) => cached.get(u) };
    new Function("self", "caches", "fetch", swSource)(scope, caches, fetchImpl);
    const respond = async (url: string, mode: string, method = "GET") => {
      let answer: Promise<Response> | undefined;
      handlers.fetch({ request: { url, mode, method }, respondWith: (p: Promise<Response>) => (answer = p) });
      return answer;
    };
    const install = async () => {
      let done: Promise<unknown> = Promise.resolve();
      handlers.install({ waitUntil: (p: Promise<unknown>) => (done = p) });
      await done;
    };
    return { install, respond, cache };
  }

  it("caches the offline screen and shows it when a page cannot load", async () => {
    const sw = load(() => Promise.reject(new TypeError("offline")));
    await sw.install();
    expect(sw.cache.addAll).toHaveBeenCalledWith(["/offline.html", "/favicon.svg"]);
    expect(await (await sw.respond("https://ticker.test/quote/AAPL", "navigate"))!.text()).toBe("cached /offline.html");
  });

  it("leaves pages online and prices alone", async () => {
    const sw = load(async () => new Response("live page"));
    await sw.install();
    expect(await (await sw.respond("https://ticker.test/", "navigate"))!.text()).toBe("live page");
    expect(await sw.respond("https://ticker.test/api/quotes?symbols=AAPL", "cors")).toBeUndefined();
    expect(await sw.respond("https://ticker.test/auth/code", "cors", "POST")).toBeUndefined();
  });
});
