import type { ParseResult } from "@/lib/gemini/schema";
import type { NewHydration, NewMeal, NewMood, NewSymptom } from "@/lib/store";
import type { FollowUpTargetType } from "@/lib/store/types";
import { nowIso } from "@/lib/store/util";

export type DraftFollowUp = {
  targetType: FollowUpTargetType;
  targetIndex: number | null;
  questionText: string;
  fieldHint: string | null;
  answerText: string | null;
};

export type Drafts = {
  recap: string | null;
  meals: NewMeal[];
  symptoms: NewSymptom[];
  moods: NewMood[];
  hydration: NewHydration[];
  followUps: DraftFollowUp[];
};

function resolveIso(occurredAt: string | null | undefined, fallback: string): string {
  if (occurredAt) {
    const d = new Date(occurredAt);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return fallback;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
/** 1–5 integer, defaulting when absent/invalid. */
function rating1to5(n: number | null | undefined, def = 3): number {
  if (n == null || Number.isNaN(n)) return def;
  return clamp(Math.round(n), 1, 5);
}
/** 1–5 integer or null (for optional fields). */
function rating1to5OrNull(n: number | null | undefined): number | null {
  if (n == null || Number.isNaN(n)) return null;
  return clamp(Math.round(n), 1, 5);
}
/** Accepts 0–1 or a 0–100 percentage; returns 0–1 or null. */
function normConfidence(n: number | null | undefined): number | null {
  if (n == null || Number.isNaN(n)) return null;
  const v = n > 1 ? n / 100 : n;
  return clamp(v, 0, 1);
}
function score0to100(n: number | null | undefined): number {
  if (n == null || Number.isNaN(n)) return 0;
  return clamp(Math.round(n), 0, 100);
}
function roundOrNull(n: number | null | undefined): number | null {
  if (n == null || Number.isNaN(n)) return null;
  return Math.round(n);
}

const FU_TYPES: FollowUpTargetType[] = ["meal", "symptom", "mood", "hydration", "day", "general"];
function normTargetType(t: string): FollowUpTargetType {
  const v = (t || "").toLowerCase().trim() as FollowUpTargetType;
  return FU_TYPES.includes(v) ? v : "general";
}

export function draftsFromParseResult(result: ParseResult, sessionId: string): Drafts {
  const fallback = nowIso();

  const meals: NewMeal[] = result.meals.map((m) => ({
    logSessionId: sessionId,
    occurredAt: resolveIso(m.occurredAt, fallback),
    timeConfidence: m.timeConfidence ?? "inferred",
    mealType: m.mealType || "other",
    title: m.title,
    description: m.description ?? null,
    location: m.location ?? null,
    restaurantName: m.restaurantName ?? null,
    socialContext: m.socialContext ?? null,
    hungerBefore: rating1to5OrNull(m.hungerBefore),
    fullnessAfter: rating1to5OrNull(m.fullnessAfter),
    preparation: m.preparation ?? null,
    estimatedCalories: roundOrNull(m.estimatedCalories),
    macros: m.macros ?? null,
    portionSize: m.portionSize ?? null,
    completenessScore: score0to100(m.completenessScore),
    aiConfidence: normConfidence(m.aiConfidence),
    source: "voice",
    notes: m.notes ?? null,
    items: m.items.map((it) => ({
      name: it.name,
      canonicalName: (it.canonicalName ?? it.name).toLowerCase().trim(),
      quantity: it.quantity ?? null,
      unit: it.unit ?? null,
      foodCategory: it.foodCategory ?? null,
      tags: it.tags ?? [],
      isPotentialAllergen: it.isPotentialAllergen ?? false,
      allergenType: it.allergenType ?? null,
      estimatedCalories: roundOrNull(it.estimatedCalories),
    })),
  }));

  const symptoms: NewSymptom[] = result.symptoms.map((s) => ({
    logSessionId: sessionId,
    occurredAt: resolveIso(s.occurredAt, fallback),
    timeConfidence: s.timeConfidence ?? "inferred",
    symptomType: s.symptomType || "other",
    title: s.title,
    severity: rating1to5(s.severity, 3),
    durationMinutes: roundOrNull(s.durationMinutes),
    isOngoing: s.isOngoing ?? false,
    resolvedAt: null,
    bodyLocation: s.bodyLocation ?? null,
    description: s.description ?? null,
    completenessScore: score0to100(s.completenessScore),
    aiConfidence: normConfidence(s.aiConfidence),
    source: "voice",
    triggers: s.suspectedFoodText
      ? [
          {
            suspectedMealId: null,
            suspectedMealItemId: null,
            suspectedFoodText: s.suspectedFoodText,
            relationNote: null,
            source: "ai",
            userConfidence: null,
          },
        ]
      : [],
  }));

  const moods: NewMood[] = result.moods.map((m) => ({
    logSessionId: sessionId,
    occurredAt: resolveIso(m.occurredAt, fallback),
    rating: rating1to5(m.rating, 3),
    label: m.label ?? null,
    energyLevel: rating1to5OrNull(m.energyLevel),
    stressLevel: rating1to5OrNull(m.stressLevel),
    notes: m.notes ?? null,
    source: "voice",
  }));

  const hydration: NewHydration[] = result.hydration
    .filter((h) => h.amountMl != null && h.amountMl > 0)
    .map((h) => ({
      logSessionId: sessionId,
      occurredAt: resolveIso(h.occurredAt, fallback),
      amountMl: Math.round(h.amountMl as number),
      beverageType: h.beverageType || "water",
      notes: null,
      source: "voice",
    }));

  const followUps: DraftFollowUp[] = result.followUps.map((f) => ({
    targetType: normTargetType(f.targetType),
    targetIndex: f.targetIndex ?? null,
    questionText: f.questionText,
    fieldHint: f.fieldHint ?? null,
    answerText: null,
  }));

  return { recap: result.recap ?? null, meals, symptoms, moods, hydration, followUps };
}
