import { z } from "zod";

// Zod schemas describing exactly what we expect Gemini to return when it parses
// a log session. These are the validation source of truth — Gemini is prompted
// to match this shape, and the response is validated here before persistence.

const clamp1to5 = z.number().int().min(1).max(5);

export const parsedMacrosSchema = z
  .object({
    protein_g: z.number().nullish(),
    carbs_g: z.number().nullish(),
    fat_g: z.number().nullish(),
    fiber_g: z.number().nullish(),
    sugar_g: z.number().nullish(),
    sodium_mg: z.number().nullish(),
  })
  .partial();

export const parsedMealItemSchema = z.object({
  name: z.string().min(1),
  canonicalName: z.string().nullish(),
  quantity: z.number().nullish(),
  unit: z.string().nullish(),
  foodCategory: z.string().nullish(),
  tags: z.array(z.string()).default([]),
  isPotentialAllergen: z.boolean().default(false),
  allergenType: z.string().nullish(),
  estimatedCalories: z.number().int().nullish(),
});

export const parsedMealSchema = z.object({
  mealType: z.string().default("other"),
  title: z.string().min(1),
  description: z.string().nullish(),
  occurredAt: z.string().nullish(), // ISO 8601, resolved against provided "now"
  timeText: z.string().nullish(), // raw mention e.g. "around 8:30"
  timeConfidence: z.enum(["exact", "approx", "inferred"]).default("inferred"),
  location: z.string().nullish(),
  restaurantName: z.string().nullish(),
  socialContext: z.string().nullish(),
  hungerBefore: clamp1to5.nullish(),
  fullnessAfter: clamp1to5.nullish(),
  preparation: z.string().nullish(),
  portionSize: z.string().nullish(),
  estimatedCalories: z.number().int().nullish(),
  macros: parsedMacrosSchema.nullish(),
  items: z.array(parsedMealItemSchema).default([]),
  completenessScore: z.number().int().min(0).max(100).default(0),
  aiConfidence: z.number().min(0).max(1).nullish(),
  notes: z.string().nullish(),
});

export const parsedSymptomSchema = z.object({
  symptomType: z.string().default("other"),
  title: z.string().min(1),
  severity: clamp1to5.default(3),
  occurredAt: z.string().nullish(),
  timeText: z.string().nullish(),
  timeConfidence: z.enum(["exact", "approx", "inferred"]).default("inferred"),
  durationMinutes: z.number().int().nullish(),
  isOngoing: z.boolean().default(false),
  bodyLocation: z.string().nullish(),
  description: z.string().nullish(),
  // Free-text food the user suspects caused this symptom ("I think it was the coffee")
  suspectedFoodText: z.string().nullish(),
  completenessScore: z.number().int().min(0).max(100).default(0),
  aiConfidence: z.number().min(0).max(1).nullish(),
});

export const parsedMoodSchema = z.object({
  rating: clamp1to5,
  label: z.string().nullish(),
  occurredAt: z.string().nullish(),
  timeText: z.string().nullish(),
  energyLevel: clamp1to5.nullish(),
  stressLevel: clamp1to5.nullish(),
  notes: z.string().nullish(),
});

export const parsedHydrationSchema = z.object({
  amountMl: z.number().int().positive(),
  beverageType: z.string().default("water"),
  occurredAt: z.string().nullish(),
  timeText: z.string().nullish(),
});

export const parsedFollowUpSchema = z.object({
  targetType: z.enum(["meal", "symptom", "mood", "hydration", "day", "general"]),
  // Index into the corresponding array above, when the question targets a specific entry.
  targetIndex: z.number().int().nullish(),
  questionText: z.string().min(1),
  fieldHint: z.string().nullish(),
});

export const parseResultSchema = z.object({
  transcript: z.string().nullish(),
  meals: z.array(parsedMealSchema).default([]),
  symptoms: z.array(parsedSymptomSchema).default([]),
  moods: z.array(parsedMoodSchema).default([]),
  hydration: z.array(parsedHydrationSchema).default([]),
  followUps: z.array(parsedFollowUpSchema).default([]),
  // A short natural-language recap, e.g. "Here's what we heard".
  recap: z.string().nullish(),
});

export type ParsedMeal = z.infer<typeof parsedMealSchema>;
export type ParsedSymptom = z.infer<typeof parsedSymptomSchema>;
export type ParsedMood = z.infer<typeof parsedMoodSchema>;
export type ParsedHydration = z.infer<typeof parsedHydrationSchema>;
export type ParsedFollowUp = z.infer<typeof parsedFollowUpSchema>;
export type ParseResult = z.infer<typeof parseResultSchema>;
