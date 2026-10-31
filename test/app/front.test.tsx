import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../src/app/App";

beforeEach(() => {
  history.replaceState(null, "", "/");
  vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json({ user: null }));
});
afterEach(() => vi.restoreAllMocks());

describe("front page, signed out", () => {
  it("shows the pitch, an example list and the way in", async () => {
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Every price you care about, on one screen" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sign in to start your lists" }).getAttribute("href")).toBe("/signin");
    const example = screen.getByRole("figure", { name: "example" });
    expect(example.textContent).toContain("Watchlist");
    expect(example.textContent).toContain("NVDA");
    expect(example.querySelector(".down")?.textContent).toBe("−0.3%");
    for (const name of ["Find anything", "Your own lists", "Charts and figures"]) expect(screen.getByText(name)).toBeTruthy();
  });

  it("puts the cursor in the search box from Try a search", async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: "Try a search" }));
    expect(document.activeElement).toBe(screen.getByRole("combobox", { name: "Search by name or ticker" }));
  });

  it("shows the sign-in screen as a card with the logo", async () => {
    history.replaceState(null, "", "/signin");
    render(<App />);
    const title = await screen.findByRole("heading", { name: "Sign in to Ticker" });
    const card = title.closest(".auth-card")!;
    expect(card.querySelector("svg.logo-mark")).toBeTruthy();
    expect(card.textContent).toContain("We'll email you a link. No password needed.");
  });
});
