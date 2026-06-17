import { z } from "zod";

// Zod schemas describing exactly what we expect Gemini to return when it parses
// a log session. These are the validation source of truth — Gemini is prompted
// to match this shape, and the response is validated here before persistence.

// LLMs are loose with numeric ranges/enums. We accept any number here and
// clamp/normalize in draft.ts so a sane response never fails validation.
const looseNum = z.number().nullish();

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
  tags: z.array(z.string()).nullish(),
  isPotentialAllergen: z.boolean().nullish(),
  allergenType: z.string().nullish(),
  estimatedCalories: z.number().nullish(),
});

export const parsedMealSchema = z.object({
  mealType: z.string().nullish(),
  // Models occasionally return null/missing — normalized (derived from items/type) in draft.ts.
  title: z.string().nullish(),
  description: z.string().nullish(),
  occurredAt: z.string().nullish(), // ISO 8601, resolved against provided "now"
  timeText: z.string().nullish(), // raw mention e.g. "around 8:30"
  // Accept any string; normalized to the enum in draft.ts (models send odd values).
  timeConfidence: z.string().nullish(),
  location: z.string().nullish(),
  restaurantName: z.string().nullish(),
  socialContext: z.string().nullish(),
  hungerBefore: looseNum,
  fullnessAfter: looseNum,
  preparation: z.string().nullish(),
  portionSize: z.string().nullish(),
  estimatedCalories: looseNum,
  macros: parsedMacrosSchema.nullish(),
  items: z.array(parsedMealItemSchema).nullish(),
  completenessScore: looseNum,
  aiConfidence: looseNum,
  notes: z.string().nullish(),
});

export const parsedSymptomSchema = z.object({
  symptomType: z.string().nullish(),
  title: z.string().nullish(),
  severity: looseNum,
  occurredAt: z.string().nullish(),
  timeText: z.string().nullish(),
  timeConfidence: z.string().nullish(),
  durationMinutes: looseNum,
  isOngoing: z.boolean().nullish(),
  bodyLocation: z.string().nullish(),
  description: z.string().nullish(),
  // Free-text food the user suspects caused this symptom ("I think it was the coffee")
  suspectedFoodText: z.string().nullish(),
  completenessScore: looseNum,
  aiConfidence: looseNum,
});

export const parsedMoodSchema = z.object({
  rating: looseNum,
  label: z.string().nullish(),
  occurredAt: z.string().nullish(),
  timeText: z.string().nullish(),
  energyLevel: looseNum,
  stressLevel: looseNum,
  notes: z.string().nullish(),
});

export const parsedHydrationSchema = z.object({
  amountMl: looseNum,
  beverageType: z.string().nullish(),
  occurredAt: z.string().nullish(),
  timeText: z.string().nullish(),
});

// Menstrual-cycle mentions ("my period started", "spotting today", "heavy flow",
// "temp was 36.6", "ovulation test positive"). Only requested when the user has
// cycle tracking ON; the field always exists so validation never breaks.
export const parsedCycleSchema = z.object({
  event: z.string().default("flow"), // period_start | flow | spotting | bbt | ovulation_test
  isPeriodStart: z.boolean().nullish(),
  flow: z.string().nullish(), // spotting | light | medium | heavy | flooding | none
  clots: z.boolean().nullish(),
  flooding: z.boolean().nullish(),
  bbtCelsius: looseNum,
  cervicalMucus: z.string().nullish(),
  ovulationTest: z.string().nullish(),
  occurredAt: z.string().nullish(),
  timeText: z.string().nullish(),
  note: z.string().nullish(),
});

export const parsedFollowUpSchema = z.object({
  // Normalized to a valid FollowUpTargetType in draft.ts.
  targetType: z.string(),
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
  cycle: z.array(parsedCycleSchema).default([]),
  followUps: z.array(parsedFollowUpSchema).default([]),
  // A short natural-language recap, e.g. "Here's what we heard".
  recap: z.string().nullish(),
});

export type ParsedMeal = z.infer<typeof parsedMealSchema>;
export type ParsedSymptom = z.infer<typeof parsedSymptomSchema>;
export type ParsedMood = z.infer<typeof parsedMoodSchema>;
export type ParsedHydration = z.infer<typeof parsedHydrationSchema>;
export type ParsedCycle = z.infer<typeof parsedCycleSchema>;
export type ParsedFollowUp = z.infer<typeof parsedFollowUpSchema>;
export type ParseResult = z.infer<typeof parseResultSchema>;
