import type { CorrelationDataset, Insight, Meal, Symptom } from "@/lib/store/types";

export type CorrelationOptions = {
  lagWindowHours?: number; // how long after eating a symptom may appear
  minExposures?: number; // min times a food was eaten to be considered
  minHits?: number; // min co-occurrences (unless explicitly suspected)
  maxResults?: number;
};

export type Correlation = {
  subjectKind: "food" | "tag";
  subjectValue: string;
  objectKind: "symptom_type";
  objectValue: string;
  exposureCount: number;
  supportCount: number; // hits: exposures followed by the symptom in-window
  confidence: number; // supportCount / exposureCount
  avgLagMinutes: number;
  explicitMentions: number; // user explicitly suspected this food
  strength: number; // 0..1 ranking score
};

type Consumption = { key: string; display: string; kind: "food" | "tag"; at: number };

function mealConsumptions(meal: Meal): Consumption[] {
  const at = new Date(meal.occurredAt).getTime();
  const out: Consumption[] = [];
  const seen = new Set<string>();
  for (const item of meal.items) {
    const key = `food:${item.canonicalName}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push({ key, display: item.canonicalName, kind: "food", at });
    }
    for (const tag of item.tags) {
      const tkey = `tag:${tag.toLowerCase()}`;
      if (!seen.has(tkey)) {
        seen.add(tkey);
        out.push({ key: tkey, display: tag, kind: "tag", at });
      }
    }
  }
  return out;
}

function explicitlySuspects(symptom: Symptom, display: string): boolean {
  const needle = display.toLowerCase();
  return symptom.triggers.some((t) =>
    (t.suspectedFoodText ?? "").toLowerCase().includes(needle),
  );
}

/**
 * Find food/tag → symptom correlations using a time-lag window. A "hit" is a
 * consumption followed by that symptom type within the window. User-suspected
 * triggers boost a correlation's strength.
 */
export function computeCorrelations(
  dataset: CorrelationDataset,
  options: CorrelationOptions = {},
): Correlation[] {
  const lagMs = (options.lagWindowHours ?? 6) * 3600_000;
  const minExposures = options.minExposures ?? 3;
  const minHits = options.minHits ?? 2;
  const maxResults = options.maxResults ?? 8;

  const symptomTypes = Array.from(new Set(dataset.symptoms.map((s) => s.symptomType)));
  const symptomsByType = new Map<string, Symptom[]>();
  for (const s of dataset.symptoms) {
    const list = symptomsByType.get(s.symptomType) ?? [];
    list.push(s);
    symptomsByType.set(s.symptomType, list);
  }

  // Index all consumptions by key.
  const consumptionsByKey = new Map<string, Consumption[]>();
  for (const meal of dataset.meals) {
    for (const c of mealConsumptions(meal)) {
      const list = consumptionsByKey.get(c.key) ?? [];
      list.push(c);
      consumptionsByKey.set(c.key, list);
    }
  }

  const results: Correlation[] = [];

  for (const consumptions of consumptionsByKey.values()) {
    if (consumptions.length < minExposures) continue;
    const { kind, display } = consumptions[0];

    for (const symptomType of symptomTypes) {
      const symptoms = symptomsByType.get(symptomType) ?? [];
      const symptomTimes = symptoms.map((s) => new Date(s.occurredAt).getTime());

      let hits = 0;
      let lagSum = 0;
      for (const c of consumptions) {
        // earliest symptom of this type within (0, lag] after the consumption
        let bestLag = Infinity;
        for (const t of symptomTimes) {
          const lag = t - c.at;
          if (lag > 0 && lag <= lagMs && lag < bestLag) bestLag = lag;
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
      const avgLagMinutes = hits > 0 ? Math.round(lagSum / hits / 60000) : 0;
      const strength = Math.min(
        1,
        confidence * 0.75 + (explicitMentions > 0 ? 0.25 : 0),
      );

      results.push({
        subjectKind: kind,
        subjectValue: display,
        objectKind: "symptom_type",
        objectValue: symptomType,
        exposureCount,
        supportCount: hits,
        confidence,
        avgLagMinutes,
        explicitMentions,
        strength,
      });
    }
  }

  return results
    .sort((a, b) => b.strength - a.strength || b.supportCount - a.supportCount)
    .slice(0, maxResults);
}

function lagPhrase(minutes: number): string {
  if (minutes <= 0) return "soon after";
  if (minutes < 90) return `within about ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return `within about ${hours}h`;
}

/** Turn correlations into persistable Insight drafts with friendly copy. */
export function correlationsToInsights(
  correlations: Correlation[],
  period: { start: string; end: string },
): Omit<Insight, "id" | "userId" | "createdAt" | "updatedAt">[] {
  return correlations.map((c) => {
    const subject = capitalize(c.subjectValue);
    const pct = Math.round(c.confidence * 100);
    const explicit = c.explicitMentions > 0 ? " You've also flagged this yourself." : "";
    return {
      insightType: "food_symptom_correlation",
      subjectKind: c.subjectKind,
      subjectValue: c.subjectValue,
      objectKind: "symptom_type",
      objectValue: c.objectValue,
      title: `${subject} → ${c.objectValue}`,
      description: `${subject} preceded ${c.objectValue} ${c.supportCount} of ${c.exposureCount} times (${pct}%), ${lagPhrase(c.avgLagMinutes)}.${explicit}`,
      strength: c.strength,
      supportCount: c.supportCount,
      exposureCount: c.exposureCount,
      confidence: c.confidence,
      avgLagMinutes: c.avgLagMinutes,
      periodStart: period.start,
      periodEnd: period.end,
      status: "active",
      evidence: {
        subjectKind: c.subjectKind,
        explicitMentions: c.explicitMentions,
      },
    };
  });
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
