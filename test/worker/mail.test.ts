import { describe, expect, it } from "vitest";
import { signInMessage } from "../../src/worker/auth/mailer";

describe("sign-in email", () => {
  it("opens with Ticker's name in the logo's colours", () => {
    const { html } = signInMessage("https://ticker.test/signin/verify?token=x#code=K7QM-4XRP-9TWD-2HNC", "K7QM-4XRP-9TWD-2HNC", "en");
    const top = html.slice(0, html.indexOf("</p>"));
    for (const colour of ["#e9c46a", "#2a9d8f", "#e76f51", "#12223a"]) expect(top).toContain(colour);
    expect(top).toContain("Ticker");
  });
});
