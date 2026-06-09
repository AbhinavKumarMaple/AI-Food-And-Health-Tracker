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
    hungerBefore: m.hungerBefore ?? null,
    fullnessAfter: m.fullnessAfter ?? null,
    preparation: m.preparation ?? null,
    estimatedCalories: m.estimatedCalories ?? null,
    macros: m.macros ?? null,
    portionSize: m.portionSize ?? null,
    completenessScore: m.completenessScore ?? 0,
    aiConfidence: m.aiConfidence ?? null,
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
      estimatedCalories: it.estimatedCalories ?? null,
    })),
  }));

  const symptoms: NewSymptom[] = result.symptoms.map((s) => ({
    logSessionId: sessionId,
    occurredAt: resolveIso(s.occurredAt, fallback),
    timeConfidence: s.timeConfidence ?? "inferred",
    symptomType: s.symptomType || "other",
    title: s.title,
    severity: s.severity ?? 3,
    durationMinutes: s.durationMinutes ?? null,
    isOngoing: s.isOngoing ?? false,
    resolvedAt: null,
    bodyLocation: s.bodyLocation ?? null,
    description: s.description ?? null,
    completenessScore: s.completenessScore ?? 0,
    aiConfidence: s.aiConfidence ?? null,
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
    rating: m.rating,
    label: m.label ?? null,
    energyLevel: m.energyLevel ?? null,
    stressLevel: m.stressLevel ?? null,
    notes: m.notes ?? null,
    source: "voice",
  }));

  const hydration: NewHydration[] = result.hydration.map((h) => ({
    logSessionId: sessionId,
    occurredAt: resolveIso(h.occurredAt, fallback),
    amountMl: h.amountMl,
    beverageType: h.beverageType || "water",
    notes: null,
    source: "voice",
  }));

  const followUps: DraftFollowUp[] = result.followUps.map((f) => ({
    targetType: f.targetType,
    targetIndex: f.targetIndex ?? null,
    questionText: f.questionText,
    fieldHint: f.fieldHint ?? null,
    answerText: null,
  }));

  return { recap: result.recap ?? null, meals, symptoms, moods, hydration, followUps };
}
