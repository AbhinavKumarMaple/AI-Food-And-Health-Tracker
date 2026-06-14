import type {
  CycleLogPatch,
  DataStore,
  DateRange,
  NewFollowUp,
  NewHydration,
  NewLogSession,
  NewMeal,
  NewMood,
  NewSymptom,
} from "./dataStore";
import type {
  CorrelationDataset,
  CycleLog,
  DayDetail,
  DaySummary,
  FollowUpQuestion,
  HydrationLog,
  ID,
  Insight,
  ISODate,
  LogSession,
  Meal,
  Mood,
  Symptom,
  SymptomTrigger,
  User,
  UserSettings,
} from "./types";

async function rpc<T>(method: string, args: unknown[] = []): Promise<T> {
  const res = await fetch("/api/data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method, args }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data.result as T;
}

/** Client DataStore: every call is an authenticated RPC to /api/data (Supabase). */
export class ApiDataStore implements DataStore {
  getProfile() {
    return rpc<User>("getProfile");
  }
  updateProfile(patch: Partial<User>) {
    return rpc<User>("updateProfile", [patch]);
  }
  getSettings() {
    return rpc<UserSettings>("getSettings");
  }
  updateSettings(patch: Partial<UserSettings>) {
    return rpc<UserSettings>("updateSettings", [patch]);
  }

  createLogSession(input: NewLogSession) {
    return rpc<LogSession>("createLogSession", [input]);
  }
  getLogSession(id: ID) {
    return rpc<LogSession | null>("getLogSession", [id]);
  }
  updateLogSession(id: ID, patch: Partial<LogSession>) {
    return rpc<LogSession>("updateLogSession", [id, patch]);
  }

  addMeal(meal: NewMeal) {
    return rpc<Meal>("addMeal", [meal]);
  }
  updateMeal(id: ID, patch: Partial<Meal>) {
    return rpc<Meal>("updateMeal", [id, patch]);
  }
  deleteMeal(id: ID) {
    return rpc<void>("deleteMeal", [id]);
  }

  addSymptom(symptom: NewSymptom) {
    return rpc<Symptom>("addSymptom", [symptom]);
  }
  updateSymptom(id: ID, patch: Partial<Symptom>) {
    return rpc<Symptom>("updateSymptom", [id, patch]);
  }
  deleteSymptom(id: ID) {
    return rpc<void>("deleteSymptom", [id]);
  }
  addTrigger(symptomId: ID, trigger: Omit<SymptomTrigger, "id" | "createdAt">) {
    return rpc<Symptom>("addTrigger", [symptomId, trigger]);
  }

  addMood(mood: NewMood) {
    return rpc<Mood>("addMood", [mood]);
  }
  updateMood(id: ID, patch: Partial<Mood>) {
    return rpc<Mood>("updateMood", [id, patch]);
  }
  deleteMood(id: ID) {
    return rpc<void>("deleteMood", [id]);
  }
  addHydration(h: NewHydration) {
    return rpc<HydrationLog>("addHydration", [h]);
  }
  updateHydration(id: ID, patch: Partial<HydrationLog>) {
    return rpc<HydrationLog>("updateHydration", [id, patch]);
  }
  deleteHydration(id: ID) {
    return rpc<void>("deleteHydration", [id]);
  }

  listCycleLogs(range?: { start: ISODate; end: ISODate }) {
    return rpc<CycleLog[]>("listCycleLogs", [range]);
  }
  upsertCycleLog(date: ISODate, patch: CycleLogPatch) {
    return rpc<CycleLog>("upsertCycleLog", [date, patch]);
  }
  deleteCycleLog(date: ISODate) {
    return rpc<void>("deleteCycleLog", [date]);
  }

  listMeals(range?: DateRange) {
    return rpc<Meal[]>("listMeals", [range]);
  }
  listSymptoms(range?: DateRange) {
    return rpc<Symptom[]>("listSymptoms", [range]);
  }
  listMoods(range?: DateRange) {
    return rpc<Mood[]>("listMoods", [range]);
  }
  listHydration(range?: DateRange) {
    return rpc<HydrationLog[]>("listHydration", [range]);
  }

  getDay(date: ISODate) {
    return rpc<DayDetail>("getDay", [date]);
  }
  listDaySummaries(range?: { start: ISODate; end: ISODate }) {
    return rpc<DaySummary[]>("listDaySummaries", [range]);
  }
  upsertDaySummary(date: ISODate, patch: Partial<DaySummary>) {
    return rpc<DaySummary>("upsertDaySummary", [date, patch]);
  }
  recomputeDaySummary(date: ISODate) {
    return rpc<DaySummary>("recomputeDaySummary", [date]);
  }
  recordDayRating(date: ISODate, rating: number, at?: string) {
    return rpc<DaySummary>("recordDayRating", [date, rating, at]);
  }

  addFollowUps(items: NewFollowUp[]) {
    return rpc<FollowUpQuestion[]>("addFollowUps", [items]);
  }
  listFollowUps(status?: FollowUpQuestion["status"]) {
    return rpc<FollowUpQuestion[]>("listFollowUps", [status]);
  }
  answerFollowUp(id: ID, answer: string) {
    return rpc<FollowUpQuestion>("answerFollowUp", [id, answer]);
  }
  dismissFollowUp(id: ID) {
    return rpc<FollowUpQuestion>("dismissFollowUp", [id]);
  }

  listInsights() {
    return rpc<Insight[]>("listInsights");
  }
  replaceInsights(insights: Omit<Insight, "id" | "userId" | "createdAt" | "updatedAt">[]) {
    return rpc<Insight[]>("replaceInsights", [insights]);
  }

  getCorrelationDataset(range?: DateRange) {
    return rpc<CorrelationDataset>("getCorrelationDataset", [range]);
  }

  deleteDay(date: ISODate) {
    return rpc<void>("deleteDay", [date]);
  }
  clearAllData() {
    return rpc<void>("clearAllData");
  }
}
