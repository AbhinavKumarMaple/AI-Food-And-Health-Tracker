// Typo-tolerant food lookup over the low-FODMAP reference list. Matches against
// each food's canonical name AND all its alternate names (English synonyms +
// Indian/regional), so "bhindi", "bhindee" or "okra" all resolve to Okra.

import Fuse, { type IFuseOptions, type FuseResult } from "fuse.js";
import { FOODS, type FoodItem } from "./data";

const options: IFuseOptions<FoodItem> = {
  includeScore: true,
  includeMatches: true,
  threshold: 0.4, // fuzzy enough to catch spelling slips, tight enough to stay relevant
  ignoreLocation: true, // match anywhere in the string, not just the start
  minMatchCharLength: 2,
  keys: [
    { name: "name", weight: 2 },
    { name: "aliases", weight: 1 },
  ],
};

const fuse = new Fuse(FOODS, options);

export interface FoodResult {
  item: FoodItem;
  /** The alias the query actually matched, when it differs from the name (e.g. "bhindi" → Okra). */
  matchedAs?: string;
}

/** Search the food list. Empty query returns everything, sorted A→Z. */
export function searchFoods(query: string): FoodResult[] {
  const q = query.trim();
  if (!q) {
    return [...FOODS]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((item) => ({ item }));
  }
  const hits = fuse.search(q);
  // Adaptive relevance band: when there's a strong match, drop the weak fuzzy
  // outliers around it; when nothing matches well, stay lenient (typo forgiving).
  const best = hits[0]?.score ?? 1;
  const cutoff = best + 0.3;
  return hits
    .filter((r) => (r.score ?? 1) <= cutoff)
    .map((r) => ({ item: r.item, matchedAs: pickMatch(r) }));
}

function pickMatch(r: FuseResult<FoodItem>): string | undefined {
  const matches = r.matches ?? [];
  // Prefer the alias that matched (that's why the user found it); fall back to name.
  const matched = matches.find((m) => m.key === "aliases")?.value ?? matches.find((m) => m.key === "name")?.value;
  if (!matched) return undefined;
  // Don't bother surfacing it if it's basically the canonical name already.
  if (matched.toLowerCase() === r.item.name.toLowerCase()) return undefined;
  return matched;
}
