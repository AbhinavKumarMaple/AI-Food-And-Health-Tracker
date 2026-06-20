import type { LocalAuth } from "./auth";
import {
  getKVBackend,
  KEY_PREFIX,
  readJSON,
  writeJSON,
  type KVBackend,
} from "./kv";
import type {
  CycleLogPatch,
  DataStore,
  DateRange,
  DayContextPatch,
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
  DayContext,
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
  ParseStatus,
  Symptom,
  SymptomTrigger,
  User,
  UserSettings,
} from "./types";
import { compareDesc, newId, nowIso, toISODate } from "./util";
import { endOfDayIso, roundRating, timeWeightedRating } from "@/lib/patterns/dayRating";
import { moodLabel } from "@/lib/format";

const DEFAULT_MODEL = "gemini-2.5-flash-lite";

export class LocalDataStore implements DataStore {
  constructor(
    private auth: LocalAuth,
    private kv: KVBackend = getKVBackend(),
  ) {}

  private uid(): ID {
    const id = this.auth.currentUserId();
    if (!id) throw new Error("Not signed in");
    return id;
  }
  private key(name: string): string {
    return `${KEY_PREFIX}:u:${this.uid()}:${name}`;
  }
  private read<T>(name: string, fallback: T): T {
    return readJSON<T>(this.kv, this.key(name), fallback);
  }
  private write(name: string, value: unknown): void {
    writeJSON(this.kv, this.key(name), value);
  }
  private inRange(iso: string, range?: DateRange): boolean {
    if (!range) return true;
    return iso >= range.start && iso <= range.end;
  }

  // ---- profile & settings ----------------------------------------------------

  async getProfile(): Promise<User> {
    const u = this.auth.getUserRecord(this.uid());
    if (!u) throw new Error("Profile not found");
    return u;
  }
  async updateProfile(patch: Partial<User>): Promise<User> {
    return this.auth.updateUserRecord(this.uid(), patch);
  }

  async getSettings(): Promise<UserSettings> {
    const existing = this.read<UserSettings | null>("settings", null);
    if (existing) return existing;
    const def: UserSettings = {
      userId: this.uid(),
      geminiApiKey: null,
      selectedModel: DEFAULT_MODEL,
      units: "metric",
      followUpAggressiveness: "medium",
      cycleTrackingEnabled: false,
      cycleAvgLengthDays: 28,
      envTrackingEnabled: true,
      updatedAt: nowIso(),
    };
    this.write("settings", def);
    return def;
  }
  async updateSettings(patch: Partial<UserSettings>): Promise<UserSettings> {
    const cur = await this.getSettings();
    const next: UserSettings = {
      ...cur,
      ...patch,
      userId: this.uid(),
      updatedAt: nowIso(),
    };
    this.write("settings", next);
    return next;
  }

  // ---- log sessions ----------------------------------------------------------

  async createLogSession(input: NewLogSession): Promise<LogSession> {
    const sessions = this.read<LogSession[]>("sessions", []);
    const session: LogSession = {
      id: newId(),
      userId: this.uid(),
      inputType: input.inputType,
      audioDurationSeconds: input.audioDurationSeconds ?? null,
      transcript: input.transcript ?? null,
      typedTextBefore: input.typedTextBefore ?? null,
      typedTextAfter: input.typedTextAfter ?? null,
      geminiModelUsed: input.geminiModelUsed ?? null,
      rawAiResponse: input.rawAiResponse ?? null,
      parseStatus: input.parseStatus ?? "draft",
      entryCount: 0,
      error: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      confirmedAt: null,
    };
    sessions.unshift(session);
    this.write("sessions", sessions);
    return session;
  }
  async getLogSession(id: ID): Promise<LogSession | null> {
    return this.read<LogSession[]>("sessions", []).find((s) => s.id === id) ?? null;
  }
  async updateLogSession(id: ID, patch: Partial<LogSession>): Promise<LogSession> {
    const sessions = this.read<LogSession[]>("sessions", []);
    const idx = sessions.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error("Log session not found");
    sessions[idx] = { ...sessions[idx], ...patch, id, userId: this.uid(), updatedAt: nowIso() };
    this.write("sessions", sessions);
    return sessions[idx];
  }
  async listLogSessions(statuses?: ParseStatus[]): Promise<LogSession[]> {
    return this.read<LogSession[]>("sessions", [])
      .filter((s) => !statuses?.length || statuses.includes(s.parseStatus))
      .sort((a, b) => compareDesc(a.createdAt, b.createdAt));
  }

  // ---- meals -----------------------------------------------------------------

  async addMeal(meal: NewMeal): Promise<Meal> {
    const meals = this.read<Meal[]>("meals", []);
    const now = nowIso();
    const full: Meal = {
      ...meal,
      id: newId(),
      userId: this.uid(),
      items: meal.items.map((it) => ({ ...it, id: newId() })),
      createdAt: now,
      updatedAt: now,
    };
    meals.push(full);
    this.write("meals", meals);
    await this.recomputeDaySummary(toISODate(full.occurredAt));
    return full;
  }
  async updateMeal(id: ID, patch: Partial<Meal>): Promise<Meal> {
    const meals = this.read<Meal[]>("meals", []);
    const idx = meals.findIndex((m) => m.id === id);
    if (idx === -1) throw new Error("Meal not found");
    const prevDate = toISODate(meals[idx].occurredAt);
    meals[idx] = { ...meals[idx], ...patch, id, userId: this.uid(), updatedAt: nowIso() };
    this.write("meals", meals);
    await this.recomputeDaySummary(prevDate);
    const newDate = toISODate(meals[idx].occurredAt);
    if (newDate !== prevDate) await this.recomputeDaySummary(newDate);
    return meals[idx];
  }
  async deleteMeal(id: ID): Promise<void> {
    const meals = this.read<Meal[]>("meals", []);
    const meal = meals.find((m) => m.id === id);
    this.write("meals", meals.filter((m) => m.id !== id));
    if (meal) await this.recomputeDaySummary(toISODate(meal.occurredAt));
  }

  // ---- symptoms --------------------------------------------------------------

  async addSymptom(symptom: NewSymptom): Promise<Symptom> {
    const symptoms = this.read<Symptom[]>("symptoms", []);
    const now = nowIso();
    const full: Symptom = {
      ...symptom,
      id: newId(),
      userId: this.uid(),
      triggers: (symptom.triggers ?? []).map((t) => ({
        ...t,
        id: newId(),
        createdAt: now,
      })),
      createdAt: now,
      updatedAt: now,
    };
    symptoms.push(full);
    this.write("symptoms", symptoms);
    await this.recomputeDaySummary(toISODate(full.occurredAt));
    return full;
  }
  async updateSymptom(id: ID, patch: Partial<Symptom>): Promise<Symptom> {
    const symptoms = this.read<Symptom[]>("symptoms", []);
    const idx = symptoms.findIndex((s) => s.id === id);
    if (idx === -1) throw new Error("Symptom not found");
    symptoms[idx] = { ...symptoms[idx], ...patch, id, userId: this.uid(), updatedAt: nowIso() };
    this.write("symptoms", symptoms);
    return symptoms[idx];
  }
  async deleteSymptom(id: ID): Promise<void> {
    const symptoms = this.read<Symptom[]>("symptoms", []);
    const s = symptoms.find((x) => x.id === id);
    this.write("symptoms", symptoms.filter((x) => x.id !== id));
    if (s) await this.recomputeDaySummary(toISODate(s.occurredAt));
  }
  async addTrigger(
    symptomId: ID,
    trigger: Omit<SymptomTrigger, "id" | "createdAt">,
  ): Promise<Symptom> {
    const symptoms = this.read<Symptom[]>("symptoms", []);
    const idx = symptoms.findIndex((s) => s.id === symptomId);
    if (idx === -1) throw new Error("Symptom not found");
    symptoms[idx].triggers.push({ ...trigger, id: newId(), createdAt: nowIso() });
    symptoms[idx].updatedAt = nowIso();
    this.write("symptoms", symptoms);
    return symptoms[idx];
  }

  // ---- mood & hydration ------------------------------------------------------

  async addMood(mood: NewMood): Promise<Mood> {
    const moods = this.read<Mood[]>("moods", []);
    const now = nowIso();
    const full: Mood = { ...mood, id: newId(), userId: this.uid(), createdAt: now, updatedAt: now };
    moods.push(full);
    this.write("moods", moods);
    await this.recomputeDaySummary(toISODate(full.occurredAt));
    return full;
  }
  async updateMood(id: ID, patch: Partial<Mood>): Promise<Mood> {
    const moods = this.read<Mood[]>("moods", []);
    const idx = moods.findIndex((m) => m.id === id);
    if (idx === -1) throw new Error("Mood not found");
    moods[idx] = { ...moods[idx], ...patch, id, userId: this.uid(), updatedAt: nowIso() };
    this.write("moods", moods);
    await this.recomputeDaySummary(toISODate(moods[idx].occurredAt));
    return moods[idx];
  }
  async deleteMood(id: ID): Promise<void> {
    const moods = this.read<Mood[]>("moods", []);
    const m = moods.find((x) => x.id === id);
    this.write("moods", moods.filter((x) => x.id !== id));
    if (m) await this.recomputeDaySummary(toISODate(m.occurredAt));
  }

  async addHydration(h: NewHydration): Promise<HydrationLog> {
    const list = this.read<HydrationLog[]>("hydration", []);
    const full: HydrationLog = { ...h, id: newId(), userId: this.uid(), createdAt: nowIso() };
    list.push(full);
    this.write("hydration", list);
    await this.recomputeDaySummary(toISODate(full.occurredAt));
    return full;
  }
  async updateHydration(id: ID, patch: Partial<HydrationLog>): Promise<HydrationLog> {
    const list = this.read<HydrationLog[]>("hydration", []);
    const idx = list.findIndex((x) => x.id === id);
    if (idx === -1) throw new Error("Hydration log not found");
    list[idx] = { ...list[idx], ...patch, id, userId: this.uid() };
    this.write("hydration", list);
    await this.recomputeDaySummary(toISODate(list[idx].occurredAt));
    return list[idx];
  }
  async deleteHydration(id: ID): Promise<void> {
    const list = this.read<HydrationLog[]>("hydration", []);
    const h = list.find((x) => x.id === id);
    this.write("hydration", list.filter((x) => x.id !== id));
    if (h) await this.recomputeDaySummary(toISODate(h.occurredAt));
  }

  // ---- menstrual cycle -------------------------------------------------------

  async listCycleLogs(range?: { start: ISODate; end: ISODate }): Promise<CycleLog[]> {
    return this.read<CycleLog[]>("cycleLogs", [])
      .filter((c) => !range || (c.date >= range.start && c.date <= range.end))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  }
  async upsertCycleLog(date: ISODate, patch: CycleLogPatch): Promise<CycleLog> {
    const list = this.read<CycleLog[]>("cycleLogs", []);
    const idx = list.findIndex((c) => c.date === date);
    const now = nowIso();
    if (idx === -1) {
      const created: CycleLog = {
        id: newId(),
        userId: this.uid(),
        date,
        isPeriodStart: false,
        flow: null,
        clots: false,
        flooding: false,
        bbtCelsius: null,
        cervicalMucus: null,
        ovulationTest: null,
        intercourse: null,
        notes: null,
        source: "manual",
        createdAt: now,
        updatedAt: now,
        ...patch,
      };
      list.push(created);
      this.write("cycleLogs", list);
      return created;
    }
    list[idx] = { ...list[idx], ...patch, id: list[idx].id, date, userId: this.uid(), updatedAt: now };
    this.write("cycleLogs", list);
    return list[idx];
  }
  async deleteCycleLog(date: ISODate): Promise<void> {
    this.write("cycleLogs", this.read<CycleLog[]>("cycleLogs", []).filter((c) => c.date !== date));
  }

  // ---- day context -----------------------------------------------------------

  async getDayContext(date: ISODate): Promise<DayContext | null> {
    return this.read<DayContext[]>("dayContexts", []).find((c) => c.date === date) ?? null;
  }
  async listDayContexts(range?: { start: ISODate; end: ISODate }): Promise<DayContext[]> {
    return this.read<DayContext[]>("dayContexts", [])
      .filter((c) => !range || (c.date >= range.start && c.date <= range.end))
      .sort((a, b) => (a.date < b.date ? -1 : 1));
  }
  async upsertDayContext(date: ISODate, patch: DayContextPatch): Promise<DayContext> {
    const list = this.read<DayContext[]>("dayContexts", []);
    const idx = list.findIndex((c) => c.date === date);
    const now = nowIso();
    if (idx === -1) {
      const created = {
        id: newId(),
        userId: this.uid(),
        date,
        source: "auto" as const,
        createdAt: now,
        updatedAt: now,
        ...patch,
      } as DayContext;
      list.push(created);
      this.write("dayContexts", list);
      return created;
    }
    list[idx] = { ...list[idx], ...patch, id: list[idx].id, date, userId: this.uid(), updatedAt: now };
    this.write("dayContexts", list);
    return list[idx];
  }

  // ---- queries ---------------------------------------------------------------

  async listMeals(range?: DateRange): Promise<Meal[]> {
    return this.read<Meal[]>("meals", [])
      .filter((m) => this.inRange(m.occurredAt, range))
      .sort((a, b) => compareDesc(a.occurredAt, b.occurredAt));
  }
  async listSymptoms(range?: DateRange): Promise<Symptom[]> {
    return this.read<Symptom[]>("symptoms", [])
      .filter((s) => this.inRange(s.occurredAt, range))
      .sort((a, b) => compareDesc(a.occurredAt, b.occurredAt));
  }
  async listMoods(range?: DateRange): Promise<Mood[]> {
    return this.read<Mood[]>("moods", [])
      .filter((m) => this.inRange(m.occurredAt, range))
      .sort((a, b) => compareDesc(a.occurredAt, b.occurredAt));
  }
  async listHydration(range?: DateRange): Promise<HydrationLog[]> {
    return this.read<HydrationLog[]>("hydration", [])
      .filter((h) => this.inRange(h.occurredAt, range))
      .sort((a, b) => compareDesc(a.occurredAt, b.occurredAt));
  }

  // ---- day views & rollups ---------------------------------------------------

  async getDay(date: ISODate): Promise<DayDetail> {
    const onDate = <T extends { occurredAt: string }>(arr: T[]) =>
      arr.filter((x) => toISODate(x.occurredAt) === date);
    const summaries = this.read<DaySummary[]>("daySummaries", []);
    return {
      date,
      summary: summaries.find((s) => s.date === date) ?? null,
      meals: onDate(await this.listMeals()),
      symptoms: onDate(await this.listSymptoms()),
      moods: onDate(await this.listMoods()),
      hydration: onDate(await this.listHydration()),
    };
  }

  async listDaySummaries(range?: { start: ISODate; end: ISODate }): Promise<DaySummary[]> {
    return this.read<DaySummary[]>("daySummaries", [])
      .filter((s) => !range || (s.date >= range.start && s.date <= range.end))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }

  async upsertDaySummary(date: ISODate, patch: Partial<DaySummary>): Promise<DaySummary> {
    const summaries = this.read<DaySummary[]>("daySummaries", []);
    const idx = summaries.findIndex((s) => s.date === date);
    const now = nowIso();
    if (idx === -1) {
      const created: DaySummary = {
        id: newId(),
        userId: this.uid(),
        date,
        overallRating: null,
        ratingLabel: null,
        ratingCapturedAt: null,
        ratingSamples: [],
        isClosed: false,
        reflection: null,
        aiSummary: null,
        mealCount: 0,
        symptomCount: 0,
        moodAvg: null,
        totalWaterMl: 0,
        createdAt: now,
        updatedAt: now,
        ...patch,
      };
      summaries.push(created);
      this.write("daySummaries", summaries);
      return created;
    }
    summaries[idx] = { ...summaries[idx], ...patch, id: summaries[idx].id, date, userId: this.uid(), updatedAt: now };
    this.write("daySummaries", summaries);
    return summaries[idx];
  }

  async recordDayRating(
    date: ISODate,
    rating: number,
    at: string = nowIso(),
  ): Promise<DaySummary> {
    const current = await this.upsertDaySummary(date, {});
    // Keep the sample within the day it belongs to (e.g. editing a past day
    // shouldn't stamp the rating with "now", which would skew the weighting).
    const startMs = new Date(`${date}T00:00:00.000`).getTime();
    const endMs = new Date(`${date}T23:59:59.999`).getTime();
    const atMs = new Date(at).getTime();
    const clampedAt = new Date(
      Math.min(Math.max(Number.isNaN(atMs) ? endMs : atMs, startMs), endMs),
    ).toISOString();
    const samples = [...(current.ratingSamples ?? []), { rating, at: clampedAt }];
    const twa = timeWeightedRating(samples, endOfDayIso(date));
    const rounded = twa != null ? roundRating(twa) : null;
    return this.upsertDaySummary(date, {
      ratingSamples: samples,
      overallRating: rounded,
      ratingLabel: rounded != null ? moodLabel(Math.round(rounded)) : null,
      ratingCapturedAt: clampedAt,
    });
  }

  async recomputeDaySummary(date: ISODate): Promise<DaySummary> {
    const day = await this.getDay(date);
    const moodAvg =
      day.moods.length > 0
        ? day.moods.reduce((sum, m) => sum + m.rating, 0) / day.moods.length
        : null;
    const totalWaterMl = day.hydration.reduce((sum, h) => sum + (h.amountMl || 0), 0);
    return this.upsertDaySummary(date, {
      mealCount: day.meals.length,
      symptomCount: day.symptoms.length,
      moodAvg,
      totalWaterMl,
    });
  }

  // ---- follow-ups ------------------------------------------------------------

  async addFollowUps(items: NewFollowUp[]): Promise<FollowUpQuestion[]> {
    const list = this.read<FollowUpQuestion[]>("followUps", []);
    const now = nowIso();
    const created = items.map((it) => ({
      id: newId(),
      userId: this.uid(),
      logSessionId: it.logSessionId ?? null,
      targetType: it.targetType,
      targetId: it.targetId ?? null,
      questionText: it.questionText,
      fieldHint: it.fieldHint ?? null,
      status: "pending" as const,
      answerText: null,
      generatedBy: it.generatedBy ?? "ai",
      createdAt: now,
      answeredAt: null,
    }));
    this.write("followUps", [...created, ...list]);
    return created;
  }
  async listFollowUps(status?: FollowUpQuestion["status"]): Promise<FollowUpQuestion[]> {
    return this.read<FollowUpQuestion[]>("followUps", []).filter(
      (f) => !status || f.status === status,
    );
  }
  async answerFollowUp(id: ID, answer: string): Promise<FollowUpQuestion> {
    const list = this.read<FollowUpQuestion[]>("followUps", []);
    const idx = list.findIndex((f) => f.id === id);
    if (idx === -1) throw new Error("Follow-up not found");
    list[idx] = { ...list[idx], status: "answered", answerText: answer, answeredAt: nowIso() };
    this.write("followUps", list);
    return list[idx];
  }
  async dismissFollowUp(id: ID): Promise<FollowUpQuestion> {
    const list = this.read<FollowUpQuestion[]>("followUps", []);
    const idx = list.findIndex((f) => f.id === id);
    if (idx === -1) throw new Error("Follow-up not found");
    list[idx] = { ...list[idx], status: "dismissed" };
    this.write("followUps", list);
    return list[idx];
  }

  // ---- insights --------------------------------------------------------------

  async listInsights(): Promise<Insight[]> {
    return this.read<Insight[]>("insights", []);
  }
  async replaceInsights(
    insights: Omit<Insight, "id" | "userId" | "createdAt" | "updatedAt">[],
  ): Promise<Insight[]> {
    const now = nowIso();
    const full: Insight[] = insights.map((i) => ({
      ...i,
      id: newId(),
      userId: this.uid(),
      createdAt: now,
      updatedAt: now,
    }));
    this.write("insights", full);
    return full;
  }

  // ---- bulk ------------------------------------------------------------------

  async getCorrelationDataset(range?: DateRange): Promise<CorrelationDataset> {
    const dateRange = range
      ? { start: toISODate(range.start), end: toISODate(range.end) }
      : undefined;
    return {
      meals: await this.listMeals(range),
      symptoms: await this.listSymptoms(range),
      moods: await this.listMoods(range),
      hydration: await this.listHydration(range),
      cycleLogs: await this.listCycleLogs(dateRange),
    };
  }

  // ---- destructive --------------------------------------------------------

  async deleteDay(date: ISODate): Promise<void> {
    const notOnDate = <T extends { occurredAt: string }>(arr: T[]) =>
      arr.filter((x) => toISODate(x.occurredAt) !== date);
    this.write("meals", notOnDate(this.read<Meal[]>("meals", [])));
    this.write("symptoms", notOnDate(this.read<Symptom[]>("symptoms", [])));
    this.write("moods", notOnDate(this.read<Mood[]>("moods", [])));
    this.write("hydration", notOnDate(this.read<HydrationLog[]>("hydration", [])));
    this.write(
      "daySummaries",
      this.read<DaySummary[]>("daySummaries", []).filter((s) => s.date !== date),
    );
  }

  async clearAllData(): Promise<void> {
    for (const key of [
      "meals",
      "symptoms",
      "moods",
      "hydration",
      "cycleLogs",
      "dayContexts",
      "daySummaries",
      "sessions",
      "followUps",
      "insights",
    ]) {
      this.write(key, []);
    }
  }
}
