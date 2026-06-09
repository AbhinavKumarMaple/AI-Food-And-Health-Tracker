import { describe, it, expect } from "vitest";
import {
  binomialUpperTail,
  baselineWindowProbability,
  lift,
  benjaminiHochberg,
} from "./significance";

describe("binomialUpperTail", () => {
  it("is 1 when k <= 0", () => {
    expect(binomialUpperTail(0, 10, 0.3)).toBe(1);
  });

  it("matches a hand-computed value", () => {
    // P(X >= 2), n=3, p=0.5 = P(2)+P(3) = 3/8 + 1/8 = 0.5
    expect(binomialUpperTail(2, 3, 0.5)).toBeCloseTo(0.5, 6);
  });

  it("is tiny when all trials succeed against a low baseline", () => {
    // 4 of 4 successes at baseline 0.1 → 0.1^4 = 1e-4
    expect(binomialUpperTail(4, 4, 0.1)).toBeCloseTo(0.0001, 8);
  });

  it("returns 0 when more successes than trials are requested", () => {
    expect(binomialUpperTail(5, 4, 0.2)).toBe(0);
  });
});

describe("baselineWindowProbability", () => {
  it("is 0 with no events", () => {
    expect(baselineWindowProbability(0, 100, 6)).toBe(0);
  });

  it("rises with a larger window", () => {
    const small = baselineWindowProbability(10, 240, 2);
    const large = baselineWindowProbability(10, 240, 12);
    expect(large).toBeGreaterThan(small);
    expect(large).toBeLessThanOrEqual(1);
  });
});

describe("lift", () => {
  it("is >1 when confidence beats baseline", () => {
    expect(lift(0.8, 0.2)).toBeCloseTo(4, 6);
  });
  it("is 1 at independence", () => {
    expect(lift(0.3, 0.3)).toBeCloseTo(1, 6);
  });
});

describe("benjaminiHochberg", () => {
  it("keeps q-values aligned to input order and monotonic", () => {
    const p = [0.01, 0.5, 0.04, 0.2];
    const q = benjaminiHochberg(p);
    expect(q).toHaveLength(4);
    // smallest p gets the strongest (smallest) q
    expect(q[0]).toBeLessThan(q[1]);
    q.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    });
  });

  it("returns empty for empty input", () => {
    expect(benjaminiHochberg([])).toEqual([]);
  });
});
