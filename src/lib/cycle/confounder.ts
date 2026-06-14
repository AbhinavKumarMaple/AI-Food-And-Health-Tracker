// Treats the menstrual cycle as a time-varying CONFOUNDER of food→symptom
// correlations. Many symptoms (bloating, headache, cramps, low mood, fatigue,
// acne, nausea, cravings) surge in the luteal/menstrual phase regardless of diet,
// so a naive engine blames whatever food was eaten that week. We detect symptoms
// that cluster by cycle phase and let correlate.ts DEMOTE (never silently delete)
// food links to them — and annotate the insight so the user understands.

import type { CorrelationDataset } from "@/lib/store/types";
import { toISODate } from "@/lib/store/util";
import { buildPhaseResolver, type PhaseResolver } from "./engine";

/** Symptoms whose rate is known to vary strongly across the cycle. */
export const CYCLE_SENSITIVE_SYMPTOMS: ReadonlySet<string> = new Set([
  "bloating",
  "gas",
  "cramps",
  "headache",
  "migraine",
  "nausea",
  "diarrhea",
  "constipation",
  "fatigue",
  "mood",
  "anxiety",
  "irritability",
  "acne",
  "skin",
  "breast_tenderness",
  "back_pain",
  "cravings",
]);

export type SymptomCyclePattern = {
  symptomType: string;
  known: number; // occurrences that landed in a known cycle phase
  inPremenstrual: number; // luteal + menstrual occurrences
  fraction: number; // inPremenstrual / known
  cycleLinked: boolean; // clusters enough to treat the food link as suspect
};

const MIN_KNOWN = 3;
const LINK_FRACTION = 0.6;

/**
 * For each symptom type, how concentrated its occurrences are in the
 * luteal/menstrual ("premenstrual + period") window. Returns null when the user
 * isn't tracking a cycle (no logs) so callers behave exactly as before.
 */
export function analyzeSymptomCyclePatterns(
  dataset: CorrelationDataset,
  opts: { today: string; avgPrior: number },
): { patterns: Map<string, SymptomCyclePattern>; resolver: PhaseResolver } | null {
  const logs = dataset.cycleLogs ?? [];
  if (logs.length === 0) return null;

  const resolver = buildPhaseResolver(logs, { today: opts.today, avgPrior: opts.avgPrior });
  const patterns = new Map<string, SymptomCyclePattern>();

  const byType = new Map<string, number[]>(); // symptomType -> [known, inPremenstrual]
  for (const s of dataset.symptoms) {
    const info = resolver.phaseOf(toISODate(s.occurredAt));
    if (info.confidence === "none" || info.phase === "unknown") continue;
    const acc = byType.get(s.symptomType) ?? [0, 0];
    acc[0] += 1;
    if (info.phase === "luteal" || info.phase === "menstrual") acc[1] += 1;
    byType.set(s.symptomType, acc);
  }

  for (const [symptomType, [known, inPre]] of byType) {
    const fraction = known > 0 ? inPre / known : 0;
    patterns.set(symptomType, {
      symptomType,
      known,
      inPremenstrual: inPre,
      fraction,
      cycleLinked:
        known >= MIN_KNOWN &&
        fraction >= LINK_FRACTION &&
        CYCLE_SENSITIVE_SYMPTOMS.has(symptomType.toLowerCase()),
    });
  }

  return { patterns, resolver };
}
