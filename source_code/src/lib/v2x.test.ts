import { describe, it, expect } from "vitest";
import { normalizedDamage, priorityUtility, trimmedMean, priorityLevel } from "./v2x";

describe("v2x formulas", () => {
  it("normalises damage by (v_ref/v)^0.5", () => {
    expect(normalizedDamage(2, 160)).toBeCloseTo(1);
  });
  it("trims 15% from each end", () => {
    expect(trimmedMean([0, 1, 1, 1, 1, 1, 100])).toBeCloseTo(1);
  });
  it("weights utility 0.50 / 0.35 / 0.15", () => {
    expect(priorityUtility(1, 1, 12, 1, 1)).toBeCloseTo(1);
    expect(priorityUtility(1, 0, 0, 2, 1)).toBeCloseTo(0.25);
    expect(priorityUtility(0, 0, 6, 1, 1)).toBeCloseTo(0.075);
  });
  it("maps utility to levels", () => {
    expect(priorityLevel(0.8)).toBe("urgent");
    expect(priorityLevel(0.5)).toBe("watch");
    expect(priorityLevel(0.2)).toBe("good");
  });
});
