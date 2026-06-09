import type { DayRatingSample, ISODate, ISODateTime } from "@/lib/store/types";

/** Last instant of a local calendar day, as ISO. */
export function endOfDayIso(date: ISODate): ISODateTime {
  return new Date(`${date}T23:59:59.999`).toISOString();
}

/**
 * Time-weighted average of a day's ratings: each rating is weighted by how long
 * it stood before the next rating (the final one extends to end of day). This
 * reflects the "general feel" of the day rather than the last tap or a plain
 * mean that over-counts moments the user happened to re-rate more often.
 *
 * Returns null for no samples; the single value for one sample; falls back to a
 * plain mean if all samples share a timestamp (zero total duration).
 */
export function timeWeightedRating(
  samples: DayRatingSample[],
  endIso: ISODateTime,
): number | null {
  const valid = samples
    .filter((s) => typeof s.rating === "number" && !Number.isNaN(s.rating))
    .slice()
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  if (valid.length === 0) return null;
  if (valid.length === 1) return valid[0].rating;

  const endMs = new Date(endIso).getTime();
  let weighted = 0;
  let totalWeight = 0;
  for (let i = 0; i < valid.length; i++) {
    const startMs = new Date(valid[i].at).getTime();
    const segmentEnd = i < valid.length - 1 ? new Date(valid[i + 1].at).getTime() : endMs;
    const weight = Math.max(0, segmentEnd - startMs);
    weighted += valid[i].rating * weight;
    totalWeight += weight;
  }

  if (totalWeight <= 0) {
    return valid.reduce((sum, s) => sum + s.rating, 0) / valid.length;
  }
  return weighted / totalWeight;
}

export function roundRating(n: number): number {
  return Math.round(n * 100) / 100;
}
