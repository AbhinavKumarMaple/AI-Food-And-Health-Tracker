// Domain types shared across the app. These mirror the Prisma schema (the future
// Postgres backend) but use plain TypeScript + ISO-8601 string timestamps so they
// serialize cleanly into localStorage today. Meals embed their items and symptoms
// embed their triggers (denormalized) for simple local persistence; the future
// API/Postgres backend maps these to/from normalized tables.

export type ID = string;
export type ISODateTime = string; // e.g. "2026-06-09T08:30:00.000Z"
export type ISODate = string; // e.g. "2026-06-09"

export type EntrySource = "voice" | "text" | "manual";
export type InputType = "voice" | "text" | "mixed";
export type ParseStatus = "draft" | "parsed" | "confirmed" | "discarded";
export type TimeConfidence = "exact" | "approx" | "inferred";
export type Units = "metric" | "imperial";
export type FollowUpAggressiveness = "low" | "medium" | "high";
export type FollowUpTargetType =
  | "meal"
  | "symptom"
  | "mood"
  | "hydration"
  | "day"
  | "general";
export type FollowUpStatus = "pending" | "answered" | "dismissed";
export type TriggerSource = "user" | "ai";
export type InsightStatus = "active" | "dismissed" | "confirmed";
export type InsightType =
  | "food_symptom_correlation"
  | "trend"
  | "streak"
  | "trigger"
  | "general";

export interface User {
  id: ID;
  email: string;
  name?: string | null;
  timezone: string;
  dateOfBirth?: ISODate | null;
  sex?: string | null;
  heightCm?: number | null;
  weightKg?: number | null;
  knownAllergies: string[];
  intolerances: string[];
  chronicConditions: string[];
  medications: string[];
  dietaryPattern?: string | null;
  healthGoals: string[];
  /** Region/city, e.g. "Pune, Maharashtra, India" — helps the AI read regional food names. */
  location?: string | null;
  /** Languages the user mixes when speaking, e.g. ["Marathi", "Hindi", "English"]. */
  languages: string[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface UserSettings {
  userId: ID;
  // Stored in plaintext in localStorage for the local-first phase; the future
  // Postgres backend encrypts this at rest via lib/crypto.
  geminiApiKey?: string | null;
  selectedModel: string;
  units: Units;
  followUpAggressiveness: FollowUpAggressiveness;
  updatedAt: ISODateTime;
}

export interface Macros {
  protein_g?: number | null;
  carbs_g?: number | null;
  fat_g?: number | null;
  fiber_g?: number | null;
  sugar_g?: number | null;
  sodium_mg?: number | null;
}

export interface MealItem {
  id: ID;
  name: string;
  canonicalName: string;
  quantity?: number | null;
  unit?: string | null;
  foodCategory?: string | null;
  tags: string[];
  isPotentialAllergen: boolean;
  allergenType?: string | null;
  estimatedCalories?: number | null;
}

export interface Meal {
  id: ID;
  userId: ID;
  logSessionId?: ID | null;
  occurredAt: ISODateTime;
  timeConfidence: TimeConfidence;
  mealType: string; // breakfast|lunch|dinner|snack|drink|other
  title: string;
  description?: string | null;
  location?: string | null;
  restaurantName?: string | null;
  socialContext?: string | null;
  hungerBefore?: number | null;
  fullnessAfter?: number | null;
  preparation?: string | null;
  estimatedCalories?: number | null;
  macros?: Macros | null;
  portionSize?: string | null;
  completenessScore: number;
  aiConfidence?: number | null;
  source: EntrySource;
  notes?: string | null;
  items: MealItem[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface SymptomTrigger {
  id: ID;
  suspectedMealId?: ID | null;
  suspectedMealItemId?: ID | null;
  suspectedFoodText?: string | null;
  relationNote?: string | null;
  source: TriggerSource;
  userConfidence?: number | null;
  createdAt: ISODateTime;
}

export interface Symptom {
  id: ID;
  userId: ID;
  logSessionId?: ID | null;
  occurredAt: ISODateTime; // onset
  timeConfidence: TimeConfidence;
  symptomType: string; // bloating|headache|nausea|fatigue|...
  title: string;
  severity: number; // 1-5
  durationMinutes?: number | null;
  isOngoing: boolean;
  resolvedAt?: ISODateTime | null;
  bodyLocation?: string | null;
  description?: string | null;
  completenessScore: number;
  aiConfidence?: number | null;
  source: EntrySource;
  triggers: SymptomTrigger[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface Mood {
  id: ID;
  userId: ID;
  logSessionId?: ID | null;
  occurredAt: ISODateTime;
  rating: number; // 1-5
  label?: string | null;
  energyLevel?: number | null;
  stressLevel?: number | null;
  notes?: string | null;
  source: EntrySource;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface HydrationLog {
  id: ID;
  userId: ID;
  logSessionId?: ID | null;
  occurredAt: ISODateTime;
  amountMl: number;
  beverageType: string; // water|coffee|tea|...
  notes?: string | null;
  source: EntrySource;
  createdAt: ISODateTime;
}

/** One rating the user entered for a day, with when they entered it. */
export interface DayRatingSample {
  rating: number; // 1-5
  at: ISODateTime;
}

export interface DaySummary {
  id: ID;
  userId: ID;
  date: ISODate;
  /** Time-weighted average of ratingSamples (the day's "general feel"). */
  overallRating?: number | null;
  ratingLabel?: string | null;
  ratingCapturedAt?: ISODateTime | null;
  /** Every rating entered through the day; overallRating is derived from these. */
  ratingSamples: DayRatingSample[];
  isClosed: boolean;
  reflection?: string | null;
  aiSummary?: string | null;
  mealCount: number;
  symptomCount: number;
  moodAvg?: number | null;
  totalWaterMl: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface FollowUpQuestion {
  id: ID;
  userId: ID;
  logSessionId?: ID | null;
  targetType: FollowUpTargetType;
  targetId?: ID | null;
  questionText: string;
  fieldHint?: string | null;
  status: FollowUpStatus;
  answerText?: string | null;
  generatedBy: string;
  createdAt: ISODateTime;
  answeredAt?: ISODateTime | null;
}

export interface Insight {
  id: ID;
  userId: ID;
  insightType: InsightType;
  subjectKind?: string | null;
  subjectValue?: string | null;
  objectKind?: string | null;
  objectValue?: string | null;
  title: string;
  description: string;
  strength?: number | null;
  supportCount?: number | null;
  exposureCount?: number | null;
  confidence?: number | null;
  avgLagMinutes?: number | null;
  periodStart?: ISODateTime | null;
  periodEnd?: ISODateTime | null;
  status: InsightStatus;
  evidence?: unknown;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface LogSession {
  id: ID;
  userId: ID;
  inputType: InputType;
  audioDurationSeconds?: number | null;
  transcript?: string | null;
  typedTextBefore?: string | null;
  typedTextAfter?: string | null;
  geminiModelUsed?: string | null;
  rawAiResponse?: unknown;
  parseStatus: ParseStatus;
  entryCount: number;
  error?: string | null;
  createdAt: ISODateTime;
  confirmedAt?: ISODateTime | null;
}

/** All entries that occurred on a given day, plus its summary. */
export interface DayDetail {
  date: ISODate;
  summary: DaySummary | null;
  meals: Meal[];
  symptoms: Symptom[];
  moods: Mood[];
  hydration: HydrationLog[];
}

/** Everything needed by the correlation engine. */
export interface CorrelationDataset {
  meals: Meal[];
  symptoms: Symptom[];
  moods: Mood[];
  hydration: HydrationLog[];
}
