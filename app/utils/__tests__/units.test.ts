import { describe, it, expect } from "vitest";
import { toBase, toDisplay } from "../units";

describe("units helper", () => {
  it("returns identical base values for supported units", () => {
    expect(toBase(10, "g")).toBe(10);
    expect(toBase(2, "pcs")).toBe(2);
  });

  it("falls back to base quantity when display unit matches", () => {
    expect(toDisplay(100, "g", "g")).toBe(100);
  });

  it("returns base when display unit missing", () => {
    expect(toDisplay(20, "ml")).toBe(20);
  });
});
