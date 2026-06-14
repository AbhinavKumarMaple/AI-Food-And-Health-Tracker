// Pure menstrual-cycle analytics — derivation, phase labelling, prediction,
// deviation and red flags. Everything is DERIVED from per-day CycleLog rows;
// nothing here is persisted. All logging is optional and gender-neutral.
//
// Clinical anchors (FIGO 2018 System 1 / ACOG "cycle as a vital sign"):
//   - normal cycle frequency 24–38 days
//   - "regular" = shortest-to-longest spread within ~7–9 days
//   - normal bleed duration ≤ 8 days
//   - the luteal phase is the comparatively STABLE part (~11–17d, here ~14 as a
//     default), so almost all timing variability lives in the follicular phase —
//     which is why phases are anchored BACKWARD from the next period when known.
// Honesty rules baked in: no prediction until a period is logged; low confidence
// until ≥3 cycles; "early/late" judged against the person's own band, not 28 days.

import type { CycleLog, CyclePhase, FlowLevel, ISODate } from "@/lib/store/types";

const DAY_MS = 86_400_000;
const DEFAULT_LUTEAL_DAYS = 14;

export const NORMAL_MIN_LEN = 24;
export const NORMAL_MAX_LEN = 38;
export const REGULAR_SPREAD_DAYS = 9;
export const NORMAL_MAX_PERIOD_DAYS = 8;
export const AMENORRHEA_DAYS = 90;

// ---- date helpers (treat ISODate at UTC-noon to avoid DST/offset drift) -----

function toMs(date: ISODate): number {
  return new Date(`${date}T12:00:00.000Z`).getTime();
}
export function addDays(date: ISODate, n: number): ISODate {
  return new Date(toMs(date) + n * DAY_MS).toISOString().slice(0, 10);
}
export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((toMs(b) - toMs(a)) / DAY_MS);
}

const BLEEDING: ReadonlySet<FlowLevel> = new Set<FlowLevel>([
  "spotting",
  "light",
  "medium",
  "heavy",
  "flooding",
]);
export function isBleeding(flow: FlowLevel | null | undefined): boolean {
  return flow != null && BLEEDING.has(flow);
}

// ---- statistics primitives --------------------------------------------------

function median(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
/** Median absolute deviation — robust spread that one outlier cycle can't wreck. */
function mad(xs: number[], center: number): number {
  if (xs.length === 0) return NaN;
  return median(xs.map((x) => Math.abs(x - center)));
}

// ---- cycle derivation -------------------------------------------------------

export type Cycle = {
  startDate: ISODate; // Day 1
  endDate: ISODate | null; // last bleeding day of this period
  nextStartDate: ISODate | null; // start of the following cycle (null = current/open)
  lengthDays: number | null; // nextStart − start (null while open)
  periodLengthDays: number | null; // contiguous bleeding-day count
  isOpen: boolean;
};

/** Build cycles from period-start anchors; period length walks contiguous bleed days. */
export function deriveCycles(logs: CycleLog[]): Cycle[] {
  const byDate = new Map<ISODate, CycleLog>();
  for (const l of logs) byDate.set(l.date, l);

  const starts = logs
    .filter((l) => l.isPeriodStart)
    .map((l) => l.date)
    .sort();

  const cycles: Cycle[] = [];
  for (let i = 0; i < starts.length; i++) {
    const startDate = starts[i];
    const nextStartDate = starts[i + 1] ?? null;
    const lengthDays = nextStartDate ? daysBetween(startDate, nextStartDate) : null;

    // Period length: count consecutive calendar days (from Day 1) that are bleeding.
    let periodLengthDays = 0;
    for (let d = 0; d < (lengthDays ?? 30); d++) {
      const log = byDate.get(addDays(startDate, d));
      if (log && isBleeding(log.flow)) periodLengthDays += 1;
      else break;
    }
    const endDate = periodLengthDays > 0 ? addDays(startDate, periodLengthDays - 1) : null;

    cycles.push({
      startDate,
      endDate,
      nextStartDate,
      lengthDays,
      periodLengthDays: periodLengthDays > 0 ? periodLengthDays : null,
      isOpen: nextStartDate === null,
    });
  }
  return cycles;
}

// ---- personal stats ---------------------------------------------------------

export type Regularity = "regular" | "irregular" | "insufficient";

export type CycleStats = {
  nCycles: number; // completed (length known)
  medianLength: number | null;
  madLength: number | null;
  minLength: number | null;
  maxLength: number | null;
  spread: number | null; // shortest-to-longest
  regularity: Regularity;
  medianPeriodLength: number | null;
};

export function cycleStats(cycles: Cycle[]): CycleStats {
  const lengths = cycles.map((c) => c.lengthDays).filter((n): n is number => n != null);
  const periods = cycles
    .map((c) => c.periodLengthDays)
    .filter((n): n is number => n != null);
  const n = lengths.length;
  if (n === 0) {
    return {
      nCycles: 0,
      medianLength: null,
      madLength: null,
      minLength: null,
      maxLength: null,
      spread: null,
      regularity: "insufficient",
      medianPeriodLength: periods.length ? median(periods) : null,
    };
  }
  // Use the most recent 12 cycles as the operative window.
  const recent = lengths.slice(-12);
  const med = median(recent);
  const minL = Math.min(...recent);
  const maxL = Math.max(...recent);
  const spread = maxL - minL;
  const regularity: Regularity =
    n < 3 ? "insufficient" : spread <= REGULAR_SPREAD_DAYS ? "regular" : "irregular";
  return {
    nCycles: n,
    medianLength: med,
    madLength: mad(recent, med),
    minLength: minL,
    maxLength: maxL,
    spread,
    regularity,
    medianPeriodLength: periods.length ? median(periods) : null,
  };
}

// ---- prediction -------------------------------------------------------------

export type PredictionConfidence = "high" | "medium" | "low";

export type CyclePrediction = {
  lastStart: ISODate;
  expectedLengthDays: number;
  predictedDate: ISODate;
  windowStart: ISODate;
  windowEnd: ISODate;
  daysUntil: number; // negative = overdue
  bandDays: number;
  confidence: PredictionConfidence;
};

/**
 * Predict the next onset from the most recent period anchor. Uses the personal
 * rolling median once ≥2 cycles exist, otherwise the user's expected-length prior.
 * Returns null when no period has been logged (nothing to anchor on).
 */
export function predictNextOnset(
  cycles: Cycle[],
  stats: CycleStats,
  opts: { today: ISODate; avgPrior: number },
): CyclePrediction | null {
  if (cycles.length === 0) return null;
  const lastStart = cycles[cycles.length - 1].startDate;

  const expectedLengthDays =
    stats.nCycles >= 2 && stats.medianLength != null
      ? Math.round(stats.medianLength)
      : Math.round(opts.avgPrior);

  const predictedDate = addDays(lastStart, expectedLengthDays);

  // Band: robust SD (1.48·MAD) once we have ≥3 cycles, else a deliberately wide
  // window so we never imply false precision early on.
  const robustSd =
    stats.nCycles >= 3 && stats.madLength != null ? 1.48 * stats.madLength : null;
  const bandDays = Math.max(2, Math.min(9, Math.round(robustSd ?? (stats.nCycles >= 1 ? 5 : 6))));

  const confidence: PredictionConfidence =
    stats.nCycles >= 6 ? "high" : stats.nCycles >= 3 ? "medium" : "low";

  return {
    lastStart,
    expectedLengthDays,
    predictedDate,
    windowStart: addDays(predictedDate, -bandDays),
    windowEnd: addDays(predictedDate, bandDays),
    daysUntil: daysBetween(opts.today, predictedDate),
    bandDays,
    confidence,
  };
}

// ---- deviation (this period came early / late) ------------------------------

export type DeviationClass = "early" | "on_time" | "late";
export type CycleDeviation = {
  lengthDays: number;
  expectedDays: number;
  deviationDays: number; // length − expected (negative = shorter/earlier)
  classification: DeviationClass;
  startDate: ISODate;
};

/**
 * Deviation of the most recently COMPLETED cycle vs. the person's baseline.
 * Only meaningful once ≥3 cycles exist (Tier-gated), so returns null below that.
 */
export function lastDeviation(cycles: Cycle[], stats: CycleStats): CycleDeviation | null {
  const completed = cycles.filter((c) => c.lengthDays != null);
  if (completed.length < 3 || stats.medianLength == null) return null;
  const last = completed[completed.length - 1];
  const priorLengths = completed
    .slice(0, -1)
    .map((c) => c.lengthDays!)
    .slice(-12);
  const expected = median(priorLengths);
  const deviationDays = last.lengthDays! - expected;
  const band = Math.max(2, Math.min(REGULAR_SPREAD_DAYS, Math.round(1.48 * (stats.madLength ?? 2))));
  const classification: DeviationClass =
    deviationDays < -band ? "early" : deviationDays > band ? "late" : "on_time";
  return {
    lengthDays: last.lengthDays!,
    expectedDays: Math.round(expected),
    deviationDays: Math.round(deviationDays),
    classification,
    startDate: last.startDate,
  };
}

// ---- phase labelling --------------------------------------------------------

export type PhaseConfidence = "high" | "medium" | "low" | "none";
export type PhaseInfo = { phase: CyclePhase; cycleDay: number | null; confidence: PhaseConfidence };

const UNKNOWN_PHASE: PhaseInfo = { phase: "unknown", cycleDay: null, confidence: "none" };

/**
 * A resolver mapping any local calendar date to its cycle phase. Closed cycles
 * are anchored backward from the next onset (luteal is the stable segment);
 * the open cycle is forward-projected at lower confidence.
 */
export type PhaseResolver = {
  phaseOf(date: ISODate): PhaseInfo;
  cycles: Cycle[];
  stats: CycleStats;
  prediction: CyclePrediction | null;
};

export function buildPhaseResolver(
  logs: CycleLog[],
  opts: { today: ISODate; avgPrior: number },
): PhaseResolver {
  const cycles = deriveCycles(logs);
  const stats = cycleStats(cycles);
  const prediction = predictNextOnset(cycles, stats, opts);

  function classify(
    cycleStart: ISODate,
    date: ISODate,
    periodLen: number | null,
    cycleEnd: ISODate | null, // next onset (exclusive) or projected end
    settled: boolean,
  ): PhaseInfo {
    const cycleDay = daysBetween(cycleStart, date) + 1;
    if (cycleDay < 1) return UNKNOWN_PHASE;

    // Menstrual: within the bleeding run (fallback to ≤5 days if duration unknown).
    const menstrualLen = periodLen ?? 5;
    if (cycleDay <= menstrualLen) {
      return { phase: "menstrual", cycleDay, confidence: "high" };
    }

    // Ovulation back-counted from the next onset (or projected onset).
    if (cycleEnd) {
      const ovDay = daysBetween(cycleStart, cycleEnd) - DEFAULT_LUTEAL_DAYS; // 0-indexed offset
      const ovCycleDay = ovDay + 1;
      const conf: PhaseConfidence = settled ? "medium" : "low";
      if (Math.abs(cycleDay - ovCycleDay) <= 1) return { phase: "ovulatory", cycleDay, confidence: conf };
      if (cycleDay > ovCycleDay) return { phase: "luteal", cycleDay, confidence: settled ? "high" : "low" };
      return { phase: "follicular", cycleDay, confidence: conf };
    }
    return { phase: "follicular", cycleDay, confidence: "low" };
  }

  function phaseOf(date: ISODate): PhaseInfo {
    if (cycles.length === 0) return UNKNOWN_PHASE;
    if (date < cycles[0].startDate) return UNKNOWN_PHASE;

    for (const c of cycles) {
      const upper = c.nextStartDate; // exclusive
      const within = upper ? date >= c.startDate && date < upper : date >= c.startDate;
      if (!within) continue;
      if (!c.isOpen) {
        return classify(c.startDate, date, c.periodLengthDays, c.nextStartDate, true);
      }
      // Open/current cycle — project the end from the prediction when available.
      const projectedEnd = prediction?.predictedDate ?? null;
      return classify(c.startDate, date, c.periodLengthDays, projectedEnd, false);
    }
    return UNKNOWN_PHASE;
  }

  return { phaseOf, cycles, stats, prediction };
}

// ---- red flags (gentle, non-diagnostic) -------------------------------------

export type CycleFlag = { id: string; title: string; detail: string };

/** Patterns worth a calm "consider mentioning to a clinician" — never a diagnosis. */
export function cycleRedFlags(
  cycles: Cycle[],
  stats: CycleStats,
  logs: CycleLog[],
  today: ISODate,
): CycleFlag[] {
  const flags: CycleFlag[] = [];

  if (stats.nCycles >= 3 && stats.medianLength != null) {
    if (stats.medianLength < NORMAL_MIN_LEN) {
      flags.push({
        id: "short-cycles",
        title: "Your cycles are running short",
        detail: `They average about ${Math.round(stats.medianLength)} days. Cycles consistently under ${NORMAL_MIN_LEN} days can be worth discussing with a clinician.`,
      });
    } else if (stats.medianLength > NORMAL_MAX_LEN) {
      flags.push({
        id: "long-cycles",
        title: "Your cycles are running long",
        detail: `They average about ${Math.round(stats.medianLength)} days. Cycles consistently over ${NORMAL_MAX_LEN} days can be worth discussing with a clinician.`,
      });
    }
    if (stats.regularity === "irregular" && stats.spread != null) {
      flags.push({
        id: "irregular",
        title: "Your cycle length varies a lot",
        detail: `Your recent cycles span about ${stats.spread} days shortest-to-longest. New or persistent irregularity can be worth a check-in.`,
      });
    }
  }

  const longest = cycles
    .map((c) => c.periodLengthDays)
    .filter((n): n is number => n != null);
  if (longest.some((d) => d > NORMAL_MAX_PERIOD_DAYS)) {
    flags.push({
      id: "prolonged",
      title: "A period lasted over a week",
      detail: `Bleeding longer than ${NORMAL_MAX_PERIOD_DAYS} days is worth mentioning to a clinician, especially if it's new for you.`,
    });
  }

  if (logs.some((l) => l.flooding || (l.flow === "heavy" && l.clots))) {
    flags.push({
      id: "heavy",
      title: "Heavy bleeding logged",
      detail:
        "Soaking through protection hourly, flooding, or passing large clots can point to heavy menstrual bleeding (and iron loss) — worth a clinician's input.",
    });
  }

  // Amenorrhea: a current cycle that's far past the normal range with no new start.
  if (cycles.length > 0) {
    const last = cycles[cycles.length - 1];
    if (last.isOpen) {
      const sinceStart = daysBetween(last.startDate, today);
      if (sinceStart >= AMENORRHEA_DAYS) {
        flags.push({
          id: "amenorrhea",
          title: "It's been a while since your last period",
          detail: `No period logged in about ${sinceStart} days. If that's unexpected, a clinician can help look into why (and a pregnancy test may be worth considering).`,
        });
      }
    }
  }

  return flags;
}

export const LUTEAL_DAYS = DEFAULT_LUTEAL_DAYS;
