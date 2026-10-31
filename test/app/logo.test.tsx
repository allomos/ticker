import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/app/App";

beforeEach(() => {
  history.replaceState(null, "", "/");
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json({ user: null }));
});
afterEach(() => vi.restoreAllMocks());

describe("logo", () => {
  it("leads the header, as the link home named Ticker", async () => {
    render(<App />);
    const home = await screen.findByRole("link", { name: "Ticker" });
    expect(home.getAttribute("href")).toBe("/");
    expect(home.querySelector("svg.logo-mark")).toBeTruthy();
  });

  it("draws the chosen mark: teal dots, a coral dot, a gold star and ball, no background tile", async () => {
    render(<App />);
    const mark = (await screen.findByRole("link", { name: "Ticker" })).querySelector("svg.logo-mark")!;
    const fills = [...mark.querySelectorAll("[fill]")].map((e) => e.getAttribute("fill"));
    expect(fills).toEqual(expect.arrayContaining(["#2a9d8f", "#e76f51", "#e9c46a"]));
    expect(mark.querySelector("rect")).toBeNull();
  });
});
