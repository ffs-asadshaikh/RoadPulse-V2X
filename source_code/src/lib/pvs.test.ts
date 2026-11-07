import { describe, it, expect } from "vitest";
import { PVS_RUNS, runById, simulatePass, pickClass } from "./pvs";
import { mulberry32, trimmedMean } from "./v2x";

describe("PVS calibration", () => {
  it("each real drive's road mix adds up to 100%", () => {
    for (const r of PVS_RUNS) expect(r.left.good + r.left.regular + r.left.bad).toBeCloseTo(100, 0);
  });
  it("uses the notebook's figure for PVS 5 rough road (35.23%)", () => {
    expect(runById(5).left.bad).toBe(35.23);
  });
  it("rougher real drives give higher average damage", () => {
    const r = mulberry32(7);
    const avg = (n: number) => trimmedMean(Array.from({ length: 300 }, () => simulatePass(runById(n), 0, 50, r).D));
    expect(avg(5)).toBeGreaterThan(avg(6));
  });
  it("wear shifts the road towards rough", () => {
    expect(pickClass({ good: 50, regular: 40, bad: 10 }, 0.5, 0.5)).toBe(2);
    expect(pickClass({ good: 50, regular: 40, bad: 10 }, 0, 0.5)).toBe(1);
  });
});
