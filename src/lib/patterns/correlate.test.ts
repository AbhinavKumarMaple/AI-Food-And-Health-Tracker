import { describe, it, expect } from "vitest";
import { computeCorrelations } from "./correlate";
import type { Meal, MealItem, Symptom } from "@/lib/store/types";

let counter = 0;
const id = () => `id${counter++}`;

function item(
  name: string,
  canonicalName: string,
  opts: { foodCategory?: string; tags?: string[] } = {},
): Omit<MealItem, "id"> {
  return {
    name,
    canonicalName,
    quantity: null,
    unit: null,
    foodCategory: opts.foodCategory ?? null,
    tags: opts.tags ?? [],
    isPotentialAllergen: false,
    allergenType: null,
    estimatedCalories: null,
  };
}

function meal(occurredAt: string, items: Omit<MealItem, "id">[]): Meal {
  return {
    id: id(),
    userId: "u",
    logSessionId: null,
    occurredAt,
    timeConfidence: "exact",
    mealType: "breakfast",
    title: "Meal",
    description: null,
    location: null,
    restaurantName: null,
    socialContext: null,
    hungerBefore: null,
    fullnessAfter: null,
    preparation: null,
    estimatedCalories: null,
    macros: null,
    portionSize: null,
    completenessScore: 0,
    aiConfidence: null,
    source: "manual",
    notes: null,
    items: items.map((it) => ({ ...it, id: id() })),
    createdAt: occurredAt,
    updatedAt: occurredAt,
  };
}

function symptom(occurredAt: string, symptomType = "bloating"): Symptom {
  return {
    id: id(),
    userId: "u",
    logSessionId: null,
    occurredAt,
    timeConfidence: "exact",
    symptomType,
    title: symptomType,
    severity: 3,
    durationMinutes: null,
    isOngoing: false,
    resolvedAt: null,
    bodyLocation: null,
    description: null,
    completenessScore: 0,
    aiConfidence: null,
    source: "manual",
    triggers: [],
    createdAt: occurredAt,
    updatedAt: occurredAt,
  };
}

describe("computeCorrelations", () => {
  const days = ["2026-06-01", "2026-06-02", "2026-06-03", "2026-06-04", "2026-06-05", "2026-06-06"];
  const meals: Meal[] = [];
  const symptoms: Symptom[] = [];
  days.forEach((d, i) => {
    if (i < 4) {
      // Dairy breakfast followed by bloating 1.5h later.
      meals.push(meal(`${d}T08:00:00.000Z`, [item("Greek yogurt", "yogurt", { foodCategory: "dairy", tags: ["Dairy"] })]));
      symptoms.push(symptom(`${d}T09:30:00.000Z`, "bloating"));
    } else {
      meals.push(meal(`${d}T08:00:00.000Z`, [item("Oatmeal", "oatmeal", { foodCategory: "grain" })]));
    }
    // Rice every lunch — never followed by bloating (a control).
    meals.push(meal(`${d}T13:00:00.000Z`, [item("Rice", "rice", { foodCategory: "grain" })]));
  });

  const results = computeCorrelations({ meals, symptoms, moods: [], hydration: [] });

  it("detects the dairy → bloating association", () => {
    const hit = results.find(
      (c) => c.objectValue === "bloating" && (c.subjectValue === "yogurt" || c.subjectValue.toLowerCase() === "dairy"),
    );
    expect(hit).toBeDefined();
    expect(hit!.confidence).toBeCloseTo(1, 5);
    expect(hit!.lift).toBeGreaterThan(1);
    expect(["strong", "likely"]).toContain(hit!.evidenceTier);
  });

  it("flags the known clinical mechanism (lactose) as plausible", () => {
    const hit = results.find((c) => c.subjectValue === "yogurt" && c.objectValue === "bloating");
    expect(hit?.plausible).toBe(true);
    expect(hit?.mechanism?.toLowerCase()).toContain("lactose");
  });

  it("does not surface the control food (rice) that never precedes the symptom", () => {
    expect(results.some((c) => c.subjectValue === "rice")).toBe(false);
  });
});
