import { describe, it, expect } from "vitest";
import { timeWeightedRating } from "./dayRating";

const NEXT_MIDNIGHT = "2026-06-10T00:00:00.000Z";

describe("timeWeightedRating", () => {
  it("returns null when there are no samples", () => {
    expect(timeWeightedRating([], NEXT_MIDNIGHT)).toBeNull();
  });

  it("returns the only value for a single sample", () => {
    expect(
      timeWeightedRating([{ rating: 4, at: "2026-06-09T09:00:00.000Z" }], NEXT_MIDNIGHT),
    ).toBe(4);
  });

  it("weights each rating by how long it stood", () => {
    // 2 from 00:00→18:00 (18h), 4 from 18:00→24:00 (6h) => (2*18 + 4*6)/24 = 2.5
    const r = timeWeightedRating(
      [
        { rating: 2, at: "2026-06-09T00:00:00.000Z" },
        { rating: 4, at: "2026-06-09T18:00:00.000Z" },
      ],
      NEXT_MIDNIGHT,
    );
    expect(r).toBeCloseTo(2.5, 5);
  });

  it("does not let a brief re-rating dominate the day", () => {
    // felt 5 for one minute, 2 for the rest of the day => stays near 2
    const r = timeWeightedRating(
      [
        { rating: 5, at: "2026-06-09T08:00:00.000Z" },
        { rating: 2, at: "2026-06-09T08:01:00.000Z" },
      ],
      NEXT_MIDNIGHT,
    );
    expect(r).not.toBeNull();
    expect(r as number).toBeLessThan(2.1);
  });

  it("ignores chronological order of input", () => {
    const ordered = timeWeightedRating(
      [
        { rating: 2, at: "2026-06-09T00:00:00.000Z" },
        { rating: 4, at: "2026-06-09T18:00:00.000Z" },
      ],
      NEXT_MIDNIGHT,
    );
    const shuffled = timeWeightedRating(
      [
        { rating: 4, at: "2026-06-09T18:00:00.000Z" },
        { rating: 2, at: "2026-06-09T00:00:00.000Z" },
      ],
      NEXT_MIDNIGHT,
    );
    expect(shuffled).toBeCloseTo(ordered as number, 9);
  });

  it("falls back to a plain mean when all timestamps coincide", () => {
    const t = "2026-06-09T08:00:00.000Z";
    const r = timeWeightedRating(
      [
        { rating: 2, at: t },
        { rating: 4, at: t },
      ],
      t,
    );
    expect(r).toBe(3);
  });
});
