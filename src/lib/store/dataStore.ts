import type {
  DayDetail,
  DaySummary,
  FollowUpQuestion,
  HydrationLog,
  ID,
  Insight,
  ISODate,
  ISODateTime,
  LogSession,
  Meal,
  Mood,
  Symptom,
  SymptomTrigger,
  CorrelationDataset,
  User,
  UserSettings,
} from "./types";

// Input shapes for creation: callers supply the meaningful fields; the store
// fills id / userId / timestamps / defaults.
export type NewMeal = Omit<
  Meal,
  "id" | "userId" | "createdAt" | "updatedAt" | "items"
> & { items: Omit<Meal["items"][number], "id">[] };

export type NewSymptom = Omit<
  Symptom,
  "id" | "userId" | "createdAt" | "updatedAt" | "triggers"
> & { triggers?: Omit<SymptomTrigger, "id" | "createdAt">[] };

export type NewMood = Omit<Mood, "id" | "userId" | "createdAt" | "updatedAt">;
export type NewHydration = Omit<HydrationLog, "id" | "userId" | "createdAt">;

export type NewFollowUp = Omit<
  FollowUpQuestion,
  "id" | "userId" | "status" | "answerText" | "createdAt" | "answeredAt"
>;

export type NewLogSession = Pick<LogSession, "inputType"> &
  Partial<
    Pick<
      LogSession,
      | "audioDurationSeconds"
      | "transcript"
      | "typedTextBefore"
      | "typedTextAfter"
      | "geminiModelUsed"
      | "rawAiResponse"
      | "parseStatus"
    >
  >;

export interface DateRange {
  start: ISODateTime;
  end: ISODateTime;
}

/**
 * Backend-agnostic persistence interface. The localStorage implementation backs
 * the app today; an API/Postgres implementation can be dropped in later without
 * touching any screen. Every method operates on behalf of the current user.
 */
export interface DataStore {
  // profile & settings
  getProfile(): Promise<User>;
  updateProfile(patch: Partial<User>): Promise<User>;
  getSettings(): Promise<UserSettings>;
  updateSettings(patch: Partial<UserSettings>): Promise<UserSettings>;

  // capture sessions
  createLogSession(input: NewLogSession): Promise<LogSession>;
  getLogSession(id: ID): Promise<LogSession | null>;
  updateLogSession(id: ID, patch: Partial<LogSession>): Promise<LogSession>;

  // meals
  addMeal(meal: NewMeal): Promise<Meal>;
  updateMeal(id: ID, patch: Partial<Meal>): Promise<Meal>;
  deleteMeal(id: ID): Promise<void>;

  // symptoms (+ suspected-food triggers)
  addSymptom(symptom: NewSymptom): Promise<Symptom>;
  updateSymptom(id: ID, patch: Partial<Symptom>): Promise<Symptom>;
  deleteSymptom(id: ID): Promise<void>;
  addTrigger(
    symptomId: ID,
    trigger: Omit<SymptomTrigger, "id" | "createdAt">,
  ): Promise<Symptom>;

  // mood & hydration
  addMood(mood: NewMood): Promise<Mood>;
  updateMood(id: ID, patch: Partial<Mood>): Promise<Mood>;
  deleteMood(id: ID): Promise<void>;
  addHydration(h: NewHydration): Promise<HydrationLog>;
  updateHydration(id: ID, patch: Partial<HydrationLog>): Promise<HydrationLog>;
  deleteHydration(id: ID): Promise<void>;

  // queries by time window
  listMeals(range?: DateRange): Promise<Meal[]>;
  listSymptoms(range?: DateRange): Promise<Symptom[]>;
  listMoods(range?: DateRange): Promise<Mood[]>;
  listHydration(range?: DateRange): Promise<HydrationLog[]>;

  // day views & rollups
  getDay(date: ISODate): Promise<DayDetail>;
  listDaySummaries(range?: { start: ISODate; end: ISODate }): Promise<DaySummary[]>;
  upsertDaySummary(date: ISODate, patch: Partial<DaySummary>): Promise<DaySummary>;
  /** Recompute denormalized rollups (counts, water, mood avg) for a date. */
  recomputeDaySummary(date: ISODate): Promise<DaySummary>;

  // follow-ups (ask-more)
  addFollowUps(items: NewFollowUp[]): Promise<FollowUpQuestion[]>;
  listFollowUps(status?: FollowUpQuestion["status"]): Promise<FollowUpQuestion[]>;
  answerFollowUp(id: ID, answer: string): Promise<FollowUpQuestion>;
  dismissFollowUp(id: ID): Promise<FollowUpQuestion>;

  // insights (pattern engine output)
  listInsights(): Promise<Insight[]>;
  replaceInsights(insights: Omit<Insight, "id" | "userId" | "createdAt" | "updatedAt">[]): Promise<Insight[]>;

  // bulk read for stats / correlation
  getCorrelationDataset(range?: DateRange): Promise<CorrelationDataset>;
}
