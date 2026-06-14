import type { CorrelationDataset, Insight, Meal, Symptom } from "@/lib/store/types";
import {
  baselineWindowProbability,
  benjaminiHochberg,
  binomialUpperTail,
  lift as liftRatio,
} from "./significance";
import { plausibleMechanism, windowHoursFor } from "./knowledge";
import { analyzeSymptomCyclePatterns } from "@/lib/cycle/confounder";
import { todayISODate } from "@/lib/store/util";

export type CorrelationOptions = {
  minExposures?: number; // min times a food was eaten to be considered
  minHits?: number; // min co-occurrences (unless explicitly suspected)
  maxResults?: number;
  /** Expected cycle length prior, used by the phase confounder (default 28). */
  cycleAvgLengthDays?: number;
};

export type EvidenceTier = "strong" | "likely" | "emerging";

export type Correlation = {
  subjectKind: "food" | "tag";
  subjectValue: string;
  objectKind: "symptom_type";
  objectValue: string;
  exposureCount: number; // times the food was eaten
  supportCount: number; // hits: exposures followed by the symptom in-window
  confidence: number; // hits / exposures = P(symptom | food)
  baseline: number; // P(symptom in a random window) = background rate
  lift: number; // confidence / baseline (>1 = positive association)
  pValue: number; // one-sided binomial tail
  qValue: number; // Benjamini-Hochberg FDR-adjusted p
  avgLagMinutes: number;
  windowHours: number; // physiological look-back window used
  explicitMentions: number; // user explicitly suspected this food
  plausible: boolean; // matches a known clinical mechanism
  mechanism: string | null;
  onset: string | null;
  evidenceTier: EvidenceTier;
  strength: number; // 0..1 ranking score
  firstSeen: string | null;
  lastSeen: string | null;
  /** True when this symptom clusters around the cycle, so the food link is suspect. */
  cyclePhaseConfounded: boolean;
};

type Consumption = {
  key: string;
  display: string;
  kind: "food" | "tag";
  at: number;
  iso: string;
  terms: string[];
};

const LIFT_CAP = 99;

function mealConsumptions(meal: Meal): Consumption[] {
  const at = new Date(meal.occurredAt).getTime();
  const iso = meal.occurredAt;
  const out: Consumption[] = [];
  const seen = new Set<string>();
  for (const item of meal.items) {
    const foodKey = `food:${item.canonicalName}`;
    if (!seen.has(foodKey)) {
      seen.add(foodKey);
      out.push({
        key: foodKey,
        display: item.canonicalName,
        kind: "food",
        at,
        iso,
        terms: [item.name, item.canonicalName, item.foodCategory ?? "", ...item.tags],
      });
    }
    for (const tag of item.tags) {
      const tagKey = `tag:${tag.toLowerCase()}`;
      if (!seen.has(tagKey)) {
        seen.add(tagKey);
        out.push({ key: tagKey, display: tag, kind: "tag", at, iso, terms: [tag] });
      }
    }
  }
  return out;
}

function explicitlySuspects(symptom: Symptom, display: string): boolean {
  const needle = display.toLowerCase();
  return symptom.triggers.some((t) => (t.suspectedFoodText ?? "").toLowerCase().includes(needle));
}

function tierFor(q: number, lift: number, hits: number): EvidenceTier {
  if (q < 0.05 && lift >= 2 && hits >= 3) return "strong";
  if (q < 0.2 && lift >= 1.5 && hits >= 2) return "likely";
  return "emerging";
}

/**
 * Detect food/ingredient/tag → symptom correlations using a case-crossover-style
 * exposure model: each consumption is followed (or not) by the symptom within a
 * physiological window; we compare that hit-rate to the person's background rate
 * (lift) and test significance (binomial tail + Benjamini-Hochberg FDR).
 */
export function computeCorrelations(
  dataset: CorrelationDataset,
  options: CorrelationOptions = {},
): Correlation[] {
  const minExposures = options.minExposures ?? 3;
  const minHits = options.minHits ?? 2;
  const maxResults = options.maxResults ?? 10;

  if (dataset.symptoms.length === 0 || dataset.meals.length === 0) return [];

  // Cycle confounder: which symptoms cluster in the luteal/menstrual phase?
  // Only active when the user tracks a cycle (dataset.cycleLogs present).
  const cycleAnalysis = analyzeSymptomCyclePatterns(dataset, {
    today: todayISODate(),
    avgPrior: options.cycleAvgLengthDays ?? 28,
  });
  const cycleLinked = (symptomType: string): boolean =>
    cycleAnalysis?.patterns.get(symptomType)?.cycleLinked ?? false;

  // Observation span (hours) across all logged events.
  const allTimes = [
    ...dataset.meals.map((m) => new Date(m.occurredAt).getTime()),
    ...dataset.symptoms.map((s) => new Date(s.occurredAt).getTime()),
  ];
  const minTs = Math.min(...allTimes);
  const maxTs = Math.max(...allTimes);
  const spanHours = Math.max(1, (maxTs - minTs) / 3_600_000);

  // Symptom occurrences grouped by type.
  const symptomsByType = new Map<string, Symptom[]>();
  for (const s of dataset.symptoms) {
    const list = symptomsByType.get(s.symptomType) ?? [];
    list.push(s);
    symptomsByType.set(s.symptomType, list);
  }

  // Consumptions grouped by food/tag key.
  const byKey = new Map<string, Consumption[]>();
  for (const meal of dataset.meals) {
    for (const c of mealConsumptions(meal)) {
      const list = byKey.get(c.key) ?? [];
      list.push(c);
      byKey.set(c.key, list);
    }
  }

  type Candidate = Omit<
    Correlation,
    "qValue" | "evidenceTier" | "strength" | "cyclePhaseConfounded"
  >;
  const candidates: Candidate[] = [];

  for (const consumptions of byKey.values()) {
    if (consumptions.length < minExposures) continue;
    const { kind, display } = consumptions[0];
    const terms = consumptions[0].terms;
    const sortedIso = consumptions.map((c) => c.iso).sort();

    for (const [symptomType, symptoms] of symptomsByType) {
      const windowHours = windowHoursFor(symptomType);
      const windowMs = windowHours * 3_600_000;
      const symptomTimes = symptoms.map((s) => new Date(s.occurredAt).getTime());

      let hits = 0;
      let lagSum = 0;
      for (const c of consumptions) {
        let bestLag = Infinity;
        for (const t of symptomTimes) {
          const lag = t - c.at;
          if (lag > 0 && lag <= windowMs && lag < bestLag) bestLag = lag;
        }
        if (bestLag !== Infinity) {
          hits += 1;
          lagSum += bestLag;
        }
      }

      const explicitMentions = symptoms.filter((s) => explicitlySuspects(s, display)).length;
      if (hits < minHits && explicitMentions === 0) continue;

      const exposureCount = consumptions.length;
      const confidence = hits / exposureCount;
      const baseline = baselineWindowProbability(symptoms.length, spanHours, windowHours);
      const liftValue = Math.min(LIFT_CAP, liftRatio(confidence, baseline));
      const pValue = binomialUpperTail(hits, exposureCount, baseline);
      const avgLagMinutes = hits > 0 ? Math.round(lagSum / hits / 60000) : 0;
      const match = plausibleMechanism(terms, symptomType);

      candidates.push({
        subjectKind: kind,
        subjectValue: display,
        objectKind: "symptom_type",
        objectValue: symptomType,
        exposureCount,
        supportCount: hits,
        confidence,
        baseline,
        lift: liftValue,
        pValue,
        avgLagMinutes,
        windowHours,
        explicitMentions,
        plausible: match != null,
        mechanism: match?.mechanism ?? null,
        onset: match?.onset ?? null,
        firstSeen: sortedIso[0] ?? null,
        lastSeen: sortedIso[sortedIso.length - 1] ?? null,
      });
    }
  }

  if (candidates.length === 0) return [];

  // Multiple-comparison correction across everything we tested.
  const qValues = benjaminiHochberg(candidates.map((c) => c.pValue));

  const results: Correlation[] = candidates.map((c, i) => {
    const q = qValues[i];
    let evidenceTier = tierFor(q, c.lift, c.supportCount);
    const sig = 1 - Math.min(q, 1);
    const liftScore = Math.min(1, Math.max(0, (c.lift - 1) / 3));
    let strength = Math.min(
      1,
      0.5 * sig + 0.3 * liftScore + (c.plausible ? 0.1 : 0) + (c.explicitMentions > 0 ? 0.1 : 0),
    );

    // Cycle confounder: if this symptom clusters around the cycle, the food link
    // is suspect. Demote (cap at "likely", penalise rank) and flag it — but never
    // delete it, so a genuine trigger eaten premenstrually isn't silently lost.
    const confounded = cycleLinked(c.objectValue);
    if (confounded && c.explicitMentions === 0) {
      if (evidenceTier === "strong") evidenceTier = "likely";
      strength = strength * 0.6;
    }

    return { ...c, qValue: q, evidenceTier, strength, cyclePhaseConfounded: confounded };
  });

  // Surface only associations with some evidence; the tier conveys confidence.
  return results
    .filter((c) => c.qValue < 0.3 || c.explicitMentions > 0 || c.plausible)
    .sort((a, b) => b.strength - a.strength || b.supportCount - a.supportCount)
    .slice(0, maxResults);
}

function lagPhrase(minutes: number): string {
  if (minutes <= 0) return "soon after";
  if (minutes < 90) return `~${minutes} min later`;
  return `~${Math.round(minutes / 60)} h later`;
}

function liftPhrase(lift: number): string {
  if (lift >= LIFT_CAP) return "far more often than usual";
  if (lift >= 1.2) return `about ${lift.toFixed(1)}× more often than usual`;
  return "around your usual rate";
}

export type InsightEvidence = {
  lift: number;
  pValue: number;
  qValue: number;
  tier: EvidenceTier;
  windowHours: number;
  hits: number;
  exposures: number;
  plausible: boolean;
  mechanism: string | null;
  onset: string | null;
  explicit: boolean;
  cyclePhaseConfounded: boolean;
};

/** Turn correlations into persistable Insight drafts with evidence-rich copy. */
export function correlationsToInsights(
  correlations: Correlation[],
  period: { start: string; end: string },
): Omit<Insight, "id" | "userId" | "createdAt" | "updatedAt">[] {
  return correlations.map((c) => {
    const subject = capitalize(c.subjectValue);
    const pct = Math.round(c.confidence * 100);
    const parts = [
      `${subject} preceded ${c.objectValue} in ${c.supportCount} of ${c.exposureCount} times (${pct}%), ${lagPhrase(c.avgLagMinutes)} — ${liftPhrase(c.lift)}.`,
    ];
    if (c.mechanism) parts.push(`Consistent with: ${c.mechanism} (typical onset ${c.onset}).`);
    if (c.explicitMentions > 0) parts.push("You've flagged this yourself, too.");
    if (c.cyclePhaseConfounded)
      parts.push(
        `Heads up: your ${c.objectValue} tends to cluster around your cycle, so this may be partly cycle-driven rather than caused by ${c.subjectValue.toLowerCase()}.`,
      );

    const evidence: InsightEvidence = {
      lift: c.lift,
      pValue: c.pValue,
      qValue: c.qValue,
      tier: c.evidenceTier,
      windowHours: c.windowHours,
      hits: c.supportCount,
      exposures: c.exposureCount,
      plausible: c.plausible,
      mechanism: c.mechanism,
      onset: c.onset,
      explicit: c.explicitMentions > 0,
      cyclePhaseConfounded: c.cyclePhaseConfounded,
    };

    return {
      insightType: "food_symptom_correlation",
      subjectKind: c.subjectKind,
      subjectValue: c.subjectValue,
      objectKind: "symptom_type",
      objectValue: c.objectValue,
      title: `${subject} → ${c.objectValue}`,
      description: parts.join(" "),
      strength: c.strength,
      supportCount: c.supportCount,
      exposureCount: c.exposureCount,
      confidence: c.confidence,
      avgLagMinutes: c.avgLagMinutes,
      periodStart: period.start,
      periodEnd: period.end,
      status: "active",
      evidence,
    };
  });
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
