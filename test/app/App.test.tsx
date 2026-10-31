import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "../../src/app/App";

describe("App", () => {
  it("shows the brand", () => {
    render(<App />);
    expect(screen.getByText("Ticker")).toBeTruthy();
  });
});
