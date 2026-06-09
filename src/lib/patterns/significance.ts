// Pure statistics for food→symptom association testing.
//
// We treat each consumption of a food as an "exposure" and ask whether a symptom
// follows within a physiological window more often than the person's background
// rate would predict. That gives us:
//   - confidence = P(symptom within window | ate food)   (hits / exposures)
//   - baseline   = P(symptom within a random window)      (from background rate)
//   - lift       = confidence / baseline                  (>1 = positive association)
//   - p-value    = one-sided binomial tail: chance of >= hits successes out of
//                  `exposures` trials at the baseline probability
// Many foods are tested at once, so p-values are corrected with Benjamini-Hochberg
// (controls the false-discovery rate).

/** P(X >= k) for X ~ Binomial(n, p). One-sided upper tail. */
export function binomialUpperTail(k: number, n: number, p: number): number {
  if (n <= 0) return 1;
  if (k <= 0) return 1;
  if (p <= 0) return k > 0 ? 0 : 1;
  if (p >= 1) return 1;
  if (k > n) return 0;

  // Iterative PMF using the term ratio to stay numerically stable for small n.
  // pmf(0) = (1-p)^n ; pmf(i+1) = pmf(i) * (n-i)/(i+1) * p/(1-p)
  let pmf = Math.pow(1 - p, n);
  let cumulativeBelow = 0; // sum of pmf for i = 0..k-1
  for (let i = 0; i < k; i++) {
    cumulativeBelow += pmf;
    pmf = (pmf * (n - i) * p) / ((i + 1) * (1 - p));
  }
  const tail = 1 - cumulativeBelow;
  return Math.min(1, Math.max(0, tail));
}

/**
 * Probability that at least one event occurs in a window of `windowHours`,
 * given `eventCount` events spread over `spanHours` (Poisson approximation).
 */
export function baselineWindowProbability(
  eventCount: number,
  spanHours: number,
  windowHours: number,
): number {
  if (eventCount <= 0 || spanHours <= 0 || windowHours <= 0) return 0;
  const rate = eventCount / spanHours; // events per hour
  return 1 - Math.exp(-rate * windowHours);
}

export function lift(confidence: number, baseline: number): number {
  if (baseline <= 0) return confidence > 0 ? Infinity : 0;
  return confidence / baseline;
}

/**
 * Benjamini-Hochberg FDR correction. Returns q-values aligned to the input order.
 */
export function benjaminiHochberg(pValues: number[]): number[] {
  const m = pValues.length;
  if (m === 0) return [];
  const indexed = pValues.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p);
  const q = new Array<number>(m);
  let prev = 1;
  for (let rank = m; rank >= 1; rank--) {
    const { p, i } = indexed[rank - 1];
    const value = Math.min(prev, (p * m) / rank);
    q[i] = value;
    prev = value;
  }
  return q;
}
