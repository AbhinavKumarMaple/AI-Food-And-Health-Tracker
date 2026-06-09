import { getStore } from "@/lib/store";
import type { NewMeal, NewSymptom } from "@/lib/store";
import { toISODate } from "@/lib/store/util";

function at(daysAgo: number, h: number, m: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

function meal(
  occurredAt: string,
  mealType: string,
  title: string,
  items: { name: string; canonicalName: string; foodCategory?: string; tags?: string[]; isPotentialAllergen?: boolean }[],
  extra: Partial<NewMeal> = {},
): NewMeal {
  return {
    occurredAt,
    timeConfidence: "exact",
    mealType,
    title,
    description: items.map((i) => i.name).join(", "),
    location: null,
    restaurantName: null,
    socialContext: null,
    hungerBefore: null,
    fullnessAfter: null,
    preparation: "home_cooked",
    estimatedCalories: null,
    macros: null,
    portionSize: null,
    completenessScore: 70,
    aiConfidence: 0.9,
    source: "manual",
    notes: null,
    items: items.map((i) => ({
      name: i.name,
      canonicalName: i.canonicalName,
      quantity: null,
      unit: null,
      foodCategory: i.foodCategory ?? null,
      tags: i.tags ?? [],
      isPotentialAllergen: i.isPotentialAllergen ?? false,
      allergenType: i.isPotentialAllergen ? "dairy" : null,
      estimatedCalories: null,
    })),
    ...extra,
  };
}

function symptom(occurredAt: string, suspected: string): NewSymptom {
  return {
    occurredAt,
    timeConfidence: "approx",
    symptomType: "bloating",
    title: "Bloating",
    severity: 3,
    durationMinutes: 60,
    isOngoing: false,
    resolvedAt: null,
    bodyLocation: "abdomen",
    description: "Mild discomfort, lasted about an hour",
    completenessScore: 80,
    aiConfidence: 0.8,
    source: "manual",
    triggers: [
      {
        suspectedMealId: null,
        suspectedMealItemId: null,
        suspectedFoodText: suspected,
        relationNote: "Felt it a couple hours after eating",
        source: "user",
        userConfidence: 3,
      },
    ],
  };
}

/**
 * Populate a fresh account with ~7 days of realistic entries. Several breakfasts
 * contain dairy (yogurt/milk) and are followed by bloating, giving the pattern
 * engine a genuine dairy→bloating correlation to surface.
 */
export async function seedDemoData(): Promise<void> {
  const store = getStore();
  if ((await store.listMeals()).length > 0) return;

  const dairyDays = new Set([0, 2, 3, 6]);

  for (let d = 6; d >= 0; d--) {
    if (dairyDays.has(d)) {
      await store.addMeal(
        meal(at(d, 8, 30), "breakfast", "Breakfast", [
          { name: "Greek yogurt", canonicalName: "yogurt", foodCategory: "dairy", tags: ["Protein", "Dairy"], isPotentialAllergen: true },
          { name: "Granola", canonicalName: "granola", foodCategory: "grain", tags: ["Fiber"] },
          { name: "Banana", canonicalName: "banana", foodCategory: "fruit" },
        ]),
      );
      await store.addSymptom(symptom(at(d, 10, 45), "Greek yogurt"));
    } else {
      await store.addMeal(
        meal(at(d, 8, 30), "breakfast", "Breakfast", [
          { name: "Oatmeal", canonicalName: "oatmeal", foodCategory: "grain", tags: ["Fiber"] },
          { name: "Blueberries", canonicalName: "blueberry", foodCategory: "fruit" },
          { name: "Almonds", canonicalName: "almond", foodCategory: "fat", tags: ["Protein"] },
          { name: "Black coffee", canonicalName: "coffee", foodCategory: "beverage", tags: ["Caffeine"] },
        ]),
      );
    }

    await store.addMeal(
      meal(at(d, 12, 45), "lunch", "Lunch", [
        { name: "Grilled chicken", canonicalName: "chicken", foodCategory: "protein", tags: ["Protein"] },
        { name: "Quinoa", canonicalName: "quinoa", foodCategory: "grain", tags: ["Fiber"] },
        { name: "Mixed greens", canonicalName: "greens", foodCategory: "vegetable" },
        { name: "Olive oil", canonicalName: "olive oil", foodCategory: "fat" },
      ]),
    );

    await store.addMeal(
      meal(at(d, 19, 15), "dinner", "Dinner", [
        { name: "Salmon", canonicalName: "salmon", foodCategory: "protein", tags: ["Protein"] },
        { name: "Brown rice", canonicalName: "rice", foodCategory: "grain" },
        { name: "Broccoli", canonicalName: "broccoli", foodCategory: "vegetable", tags: ["Fiber"] },
      ]),
    );

    await store.addHydration({
      occurredAt: at(d, 10, 0),
      amountMl: 1400 + (d % 3) * 300,
      beverageType: "water",
      notes: null,
      source: "manual",
    });

    await store.addMood({
      occurredAt: at(d, 21, 30),
      rating: dairyDays.has(d) ? 3 : 4,
      label: null,
      energyLevel: dairyDays.has(d) ? 3 : 4,
      stressLevel: 2,
      notes: null,
      source: "manual",
    });

    await store.upsertDaySummary(toISODate(at(d, 12, 0)), {
      overallRating: dairyDays.has(d) ? 3 : 4,
      ratingLabel: dairyDays.has(d) ? "Okay" : "Pretty good",
      ratingCapturedAt: at(d, 22, 0),
      isClosed: d > 0,
    });
  }
}
