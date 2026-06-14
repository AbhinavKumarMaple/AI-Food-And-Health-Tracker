import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/crypto";
import { endOfDayIso, roundRating, timeWeightedRating } from "@/lib/patterns/dayRating";
import { moodLabel } from "@/lib/format";
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
} from "@/lib/store/dataStore";
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
  ISODateTime,
  Macros,
  Meal,
  MealItem,
  Mood,
  Symptom,
  SymptomTrigger,
  User,
  UserSettings,
} from "@/lib/store/types";

const newId = () => crypto.randomUUID();
const nowIso = (): ISODateTime => new Date().toISOString();
const iso = (d: Date | null): ISODateTime | null => (d ? d.toISOString() : null);
const J = (v: unknown): Prisma.InputJsonValue =>
  (v === null || v === undefined ? Prisma.JsonNull : v) as Prisma.InputJsonValue;

function userLocalDate(isoStr: string, tz: string): ISODate {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(isoStr));
  } catch {
    return new Date(isoStr).toISOString().slice(0, 10);
  }
}

// Prisma row → domain mappers ------------------------------------------------

type Row = Record<string, unknown>;

function mealToDomain(r: Row): Meal {
  return {
    id: r.id as string,
    userId: r.userId as string,
    logSessionId: (r.logSessionId as string) ?? null,
    occurredAt: (r.occurredAt as Date).toISOString(),
    timeConfidence: r.timeConfidence as Meal["timeConfidence"],
    mealType: r.mealType as string,
    title: r.title as string,
    description: (r.description as string) ?? null,
    location: (r.location as string) ?? null,
    restaurantName: (r.restaurantName as string) ?? null,
    socialContext: (r.socialContext as string) ?? null,
    hungerBefore: (r.hungerBefore as number) ?? null,
    fullnessAfter: (r.fullnessAfter as number) ?? null,
    preparation: (r.preparation as string) ?? null,
    estimatedCalories: (r.estimatedCalories as number) ?? null,
    macros: (r.macros as Macros) ?? null,
    portionSize: (r.portionSize as string) ?? null,
    completenessScore: r.completenessScore as number,
    aiConfidence: (r.aiConfidence as number) ?? null,
    source: r.source as Meal["source"],
    notes: (r.notes as string) ?? null,
    items: (r.items as MealItem[]) ?? [],
    createdAt: (r.createdAt as Date).toISOString(),
    updatedAt: (r.updatedAt as Date).toISOString(),
  };
}

function symptomToDomain(r: Row): Symptom {
  return {
    id: r.id as string,
    userId: r.userId as string,
    logSessionId: (r.logSessionId as string) ?? null,
    occurredAt: (r.occurredAt as Date).toISOString(),
    timeConfidence: r.timeConfidence as Symptom["timeConfidence"],
    symptomType: r.symptomType as string,
    title: r.title as string,
    severity: r.severity as number,
    durationMinutes: (r.durationMinutes as number) ?? null,
    isOngoing: r.isOngoing as boolean,
    resolvedAt: iso((r.resolvedAt as Date) ?? null),
    bodyLocation: (r.bodyLocation as string) ?? null,
    description: (r.description as string) ?? null,
    completenessScore: r.completenessScore as number,
    aiConfidence: (r.aiConfidence as number) ?? null,
    source: r.source as Symptom["source"],
    triggers: (r.triggers as SymptomTrigger[]) ?? [],
    createdAt: (r.createdAt as Date).toISOString(),
    updatedAt: (r.updatedAt as Date).toISOString(),
  };
}

function moodToDomain(r: Row): Mood {
  return {
    id: r.id as string,
    userId: r.userId as string,
    logSessionId: (r.logSessionId as string) ?? null,
    occurredAt: (r.occurredAt as Date).toISOString(),
    rating: r.rating as number,
    label: (r.label as string) ?? null,
    energyLevel: (r.energyLevel as number) ?? null,
    stressLevel: (r.stressLevel as number) ?? null,
    notes: (r.notes as string) ?? null,
    source: r.source as Mood["source"],
    createdAt: (r.createdAt as Date).toISOString(),
    updatedAt: (r.updatedAt as Date).toISOString(),
  };
}

function hydrationToDomain(r: Row): HydrationLog {
  return {
    id: r.id as string,
    userId: r.userId as string,
    logSessionId: (r.logSessionId as string) ?? null,
    occurredAt: (r.occurredAt as Date).toISOString(),
    amountMl: r.amountMl as number,
    beverageType: r.beverageType as string,
    notes: (r.notes as string) ?? null,
    source: r.source as HydrationLog["source"],
    createdAt: (r.createdAt as Date).toISOString(),
  };
}

function cycleLogToDomain(r: Row): CycleLog {
  return {
    id: r.id as string,
    userId: r.userId as string,
    date: r.date as string,
    isPeriodStart: r.isPeriodStart as boolean,
    flow: (r.flow as CycleLog["flow"]) ?? null,
    clots: r.clots as boolean,
    flooding: r.flooding as boolean,
    bbtCelsius: (r.bbtCelsius as number) ?? null,
    cervicalMucus: (r.cervicalMucus as CycleLog["cervicalMucus"]) ?? null,
    ovulationTest: (r.ovulationTest as CycleLog["ovulationTest"]) ?? null,
    intercourse: (r.intercourse as boolean) ?? null,
    notes: (r.notes as string) ?? null,
    source: r.source as CycleLog["source"],
    createdAt: (r.createdAt as Date).toISOString(),
    updatedAt: (r.updatedAt as Date).toISOString(),
  };
}

function dayContextToDomain(r: Row): DayContext {
  return {
    id: r.id as string,
    userId: r.userId as string,
    date: r.date as string,
    city: (r.city as string) ?? null,
    region: (r.region as string) ?? null,
    country: (r.country as string) ?? null,
    latitude: (r.latitude as number) ?? null,
    longitude: (r.longitude as number) ?? null,
    locationSource: (r.locationSource as DayContext["locationSource"]) ?? null,
    tempMinC: (r.tempMinC as number) ?? null,
    tempMaxC: (r.tempMaxC as number) ?? null,
    tempMeanC: (r.tempMeanC as number) ?? null,
    apparentMaxC: (r.apparentMaxC as number) ?? null,
    humidityMean: (r.humidityMean as number) ?? null,
    pressureMeanHpa: (r.pressureMeanHpa as number) ?? null,
    pressureRangeHpa: (r.pressureRangeHpa as number) ?? null,
    precipitationMm: (r.precipitationMm as number) ?? null,
    windMaxKph: (r.windMaxKph as number) ?? null,
    uvIndexMax: (r.uvIndexMax as number) ?? null,
    weatherCode: (r.weatherCode as number) ?? null,
    daylightMinutes: (r.daylightMinutes as number) ?? null,
    pm25Mean: (r.pm25Mean as number) ?? null,
    pm10Mean: (r.pm10Mean as number) ?? null,
    aqiUsMax: (r.aqiUsMax as number) ?? null,
    moonPhase: (r.moonPhase as DayContext["moonPhase"]) ?? null,
    moonIllumination: (r.moonIllumination as number) ?? null,
    season: (r.season as DayContext["season"]) ?? null,
    source: (r.source as DayContext["source"]) ?? "auto",
    createdAt: (r.createdAt as Date).toISOString(),
    updatedAt: (r.updatedAt as Date).toISOString(),
  };
}

function summaryToDomain(r: Row): DaySummary {
  return {
    id: r.id as string,
    userId: r.userId as string,
    date: r.date as string,
    overallRating: (r.overallRating as number) ?? null,
    ratingLabel: (r.ratingLabel as string) ?? null,
    ratingCapturedAt: iso((r.ratingCapturedAt as Date) ?? null),
    ratingSamples: (r.ratingSamples as DaySummary["ratingSamples"]) ?? [],
    isClosed: r.isClosed as boolean,
    reflection: (r.reflection as string) ?? null,
    aiSummary: (r.aiSummary as string) ?? null,
    mealCount: r.mealCount as number,
    symptomCount: r.symptomCount as number,
    moodAvg: (r.moodAvg as number) ?? null,
    totalWaterMl: r.totalWaterMl as number,
    createdAt: (r.createdAt as Date).toISOString(),
    updatedAt: (r.updatedAt as Date).toISOString(),
  };
}

function userToDomain(r: Row): User {
  return {
    id: r.id as string,
    email: r.email as string,
    name: (r.name as string) ?? null,
    timezone: r.timezone as string,
    dateOfBirth: iso((r.dateOfBirth as Date) ?? null),
    sex: (r.sex as string) ?? null,
    heightCm: (r.heightCm as number) ?? null,
    weightKg: (r.weightKg as number) ?? null,
    knownAllergies: (r.knownAllergies as string[]) ?? [],
    intolerances: (r.intolerances as string[]) ?? [],
    chronicConditions: (r.chronicConditions as string[]) ?? [],
    medications: (r.medications as string[]) ?? [],
    dietaryPattern: (r.dietaryPattern as string) ?? null,
    healthGoals: (r.healthGoals as string[]) ?? [],
    location: (r.location as string) ?? null,
    languages: (r.languages as string[]) ?? [],
    createdAt: (r.createdAt as Date).toISOString(),
    updatedAt: (r.updatedAt as Date).toISOString(),
  };
}

function followUpToDomain(r: Row): FollowUpQuestion {
  return {
    id: r.id as string,
    userId: r.userId as string,
    logSessionId: (r.logSessionId as string) ?? null,
    targetType: r.targetType as FollowUpQuestion["targetType"],
    targetId: (r.targetId as string) ?? null,
    questionText: r.questionText as string,
    fieldHint: (r.fieldHint as string) ?? null,
    status: r.status as FollowUpQuestion["status"],
    answerText: (r.answerText as string) ?? null,
    generatedBy: r.generatedBy as string,
    createdAt: (r.createdAt as Date).toISOString(),
    answeredAt: iso((r.answeredAt as Date) ?? null),
  };
}

function insightToDomain(r: Row): Insight {
  return {
    id: r.id as string,
    userId: r.userId as string,
    insightType: r.insightType as Insight["insightType"],
    subjectKind: (r.subjectKind as string) ?? null,
    subjectValue: (r.subjectValue as string) ?? null,
    objectKind: (r.objectKind as string) ?? null,
    objectValue: (r.objectValue as string) ?? null,
    title: r.title as string,
    description: r.description as string,
    strength: (r.strength as number) ?? null,
    supportCount: (r.supportCount as number) ?? null,
    exposureCount: (r.exposureCount as number) ?? null,
    confidence: (r.confidence as number) ?? null,
    avgLagMinutes: (r.avgLagMinutes as number) ?? null,
    periodStart: iso((r.periodStart as Date) ?? null),
    periodEnd: iso((r.periodEnd as Date) ?? null),
    status: r.status as Insight["status"],
    evidence: r.evidence ?? null,
    createdAt: (r.createdAt as Date).toISOString(),
    updatedAt: (r.updatedAt as Date).toISOString(),
  };
}

/** Server implementation of DataStore backed by Prisma / Supabase. */
export class PrismaDataStore implements DataStore {
  private tzCache?: string;
  constructor(private userId: ID) {}

  private async tz(): Promise<string> {
    if (!this.tzCache) {
      const u = await prisma.user.findUnique({
        where: { id: this.userId },
        select: { timezone: true },
      });
      this.tzCache = u?.timezone ?? "UTC";
    }
    return this.tzCache;
  }

  // ---- profile & settings ---------------------------------------------------

  async getProfile(): Promise<User> {
    const u = await prisma.user.findUnique({ where: { id: this.userId } });
    if (!u) throw new Error("Profile not found");
    return userToDomain(u as Row);
  }

  async updateProfile(patch: Partial<User>): Promise<User> {
    const u = await prisma.user.update({
      where: { id: this.userId },
      data: {
        name: patch.name ?? undefined,
        timezone: patch.timezone ?? undefined,
        dateOfBirth: patch.dateOfBirth ? new Date(patch.dateOfBirth) : undefined,
        sex: patch.sex ?? undefined,
        heightCm: patch.heightCm ?? undefined,
        weightKg: patch.weightKg ?? undefined,
        knownAllergies: patch.knownAllergies ?? undefined,
        intolerances: patch.intolerances ?? undefined,
        chronicConditions: patch.chronicConditions ?? undefined,
        medications: patch.medications ?? undefined,
        dietaryPattern: patch.dietaryPattern ?? undefined,
        healthGoals: patch.healthGoals ?? undefined,
        location: patch.location ?? undefined,
        languages: patch.languages ?? undefined,
      },
    });
    return userToDomain(u as Row);
  }

  async getSettings(): Promise<UserSettings> {
    const row = await prisma.userSettings.upsert({
      where: { userId: this.userId },
      create: { userId: this.userId },
      update: {},
    });
    let geminiApiKey: string | null = null;
    if (row.geminiApiKeyCiphertext && row.geminiApiKeyIv && row.geminiApiKeyTag) {
      try {
        geminiApiKey = decrypt({
          ciphertext: row.geminiApiKeyCiphertext,
          iv: row.geminiApiKeyIv,
          tag: row.geminiApiKeyTag,
        });
      } catch {
        geminiApiKey = null;
      }
    }
    return {
      userId: this.userId,
      geminiApiKey,
      selectedModel: row.selectedModel,
      units: row.units,
      followUpAggressiveness: row.followUpAggressiveness,
      cycleTrackingEnabled: row.cycleTrackingEnabled,
      cycleAvgLengthDays: row.cycleAvgLengthDays,
      envTrackingEnabled: row.envTrackingEnabled,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async updateSettings(patch: Partial<UserSettings>): Promise<UserSettings> {
    const data: Record<string, unknown> = {};
    if ("geminiApiKey" in patch) {
      if (patch.geminiApiKey) {
        const enc = encrypt(patch.geminiApiKey);
        data.geminiApiKeyCiphertext = enc.ciphertext;
        data.geminiApiKeyIv = enc.iv;
        data.geminiApiKeyTag = enc.tag;
      } else {
        data.geminiApiKeyCiphertext = null;
        data.geminiApiKeyIv = null;
        data.geminiApiKeyTag = null;
      }
    }
    if (patch.selectedModel !== undefined) data.selectedModel = patch.selectedModel;
    if (patch.units !== undefined) data.units = patch.units;
    if (patch.followUpAggressiveness !== undefined)
      data.followUpAggressiveness = patch.followUpAggressiveness;
    if (patch.cycleTrackingEnabled !== undefined)
      data.cycleTrackingEnabled = patch.cycleTrackingEnabled;
    if (patch.cycleAvgLengthDays !== undefined)
      data.cycleAvgLengthDays = patch.cycleAvgLengthDays;
    if (patch.envTrackingEnabled !== undefined)
      data.envTrackingEnabled = patch.envTrackingEnabled;

    await prisma.userSettings.upsert({
      where: { userId: this.userId },
      create: { userId: this.userId, ...data } as Prisma.UserSettingsUncheckedCreateInput,
      update: data as Prisma.UserSettingsUncheckedUpdateInput,
    });
    return this.getSettings();
  }

  // ---- log sessions ---------------------------------------------------------

  async createLogSession(input: NewLogSession) {
    const row = await prisma.logSession.create({
      data: {
        userId: this.userId,
        inputType: input.inputType,
        audioDurationSeconds: input.audioDurationSeconds ?? null,
        transcript: input.transcript ?? null,
        typedTextBefore: input.typedTextBefore ?? null,
        typedTextAfter: input.typedTextAfter ?? null,
        geminiModelUsed: input.geminiModelUsed ?? null,
        rawAiResponse: J(input.rawAiResponse),
        parseStatus: input.parseStatus ?? "draft",
      },
    });
    return this.logSessionToDomain(row as Row);
  }
  async getLogSession(id: ID) {
    const row = await prisma.logSession.findFirst({ where: { id, userId: this.userId } });
    return row ? this.logSessionToDomain(row as Row) : null;
  }
  async updateLogSession(id: ID, patch: Partial<import("@/lib/store/types").LogSession>) {
    await this.assertOwns("logSession", id);
    const row = await prisma.logSession.update({
      where: { id },
      data: {
        transcript: patch.transcript ?? undefined,
        typedTextBefore: patch.typedTextBefore ?? undefined,
        typedTextAfter: patch.typedTextAfter ?? undefined,
        geminiModelUsed: patch.geminiModelUsed ?? undefined,
        rawAiResponse: patch.rawAiResponse !== undefined ? J(patch.rawAiResponse) : undefined,
        parseStatus: patch.parseStatus ?? undefined,
        entryCount: patch.entryCount ?? undefined,
        error: patch.error ?? undefined,
        confirmedAt: patch.confirmedAt ? new Date(patch.confirmedAt) : undefined,
      },
    });
    return this.logSessionToDomain(row as Row);
  }
  private logSessionToDomain(r: Row): import("@/lib/store/types").LogSession {
    return {
      id: r.id as string,
      userId: r.userId as string,
      inputType: r.inputType as import("@/lib/store/types").InputType,
      audioDurationSeconds: (r.audioDurationSeconds as number) ?? null,
      transcript: (r.transcript as string) ?? null,
      typedTextBefore: (r.typedTextBefore as string) ?? null,
      typedTextAfter: (r.typedTextAfter as string) ?? null,
      geminiModelUsed: (r.geminiModelUsed as string) ?? null,
      rawAiResponse: r.rawAiResponse ?? null,
      parseStatus: r.parseStatus as import("@/lib/store/types").ParseStatus,
      entryCount: r.entryCount as number,
      error: (r.error as string) ?? null,
      createdAt: (r.createdAt as Date).toISOString(),
      confirmedAt: iso((r.confirmedAt as Date) ?? null),
    };
  }

  // ---- meals ----------------------------------------------------------------

  async addMeal(meal: NewMeal): Promise<Meal> {
    const row = await prisma.meal.create({
      data: {
        userId: this.userId,
        logSessionId: meal.logSessionId ?? null,
        occurredAt: new Date(meal.occurredAt),
        timeConfidence: meal.timeConfidence,
        mealType: meal.mealType,
        title: meal.title,
        description: meal.description ?? null,
        location: meal.location ?? null,
        restaurantName: meal.restaurantName ?? null,
        socialContext: meal.socialContext ?? null,
        hungerBefore: meal.hungerBefore ?? null,
        fullnessAfter: meal.fullnessAfter ?? null,
        preparation: meal.preparation ?? null,
        estimatedCalories: meal.estimatedCalories ?? null,
        macros: J(meal.macros),
        portionSize: meal.portionSize ?? null,
        completenessScore: meal.completenessScore,
        aiConfidence: meal.aiConfidence ?? null,
        source: meal.source,
        notes: meal.notes ?? null,
        items: meal.items.map((it) => ({ ...it, id: newId() })) as unknown as Prisma.InputJsonValue,
      },
    });
    const full = mealToDomain(row as Row);
    await this.recomputeDaySummary(userLocalDate(full.occurredAt, await this.tz()));
    return full;
  }

  async updateMeal(id: ID, patch: Partial<Meal>): Promise<Meal> {
    const existing = mealToDomain((await this.ownedOrThrow("meal", id)) as Row);
    const prevDate = userLocalDate(existing.occurredAt, await this.tz());
    const row = await prisma.meal.update({
      where: { id },
      data: {
        logSessionId: patch.logSessionId ?? undefined,
        occurredAt: patch.occurredAt ? new Date(patch.occurredAt) : undefined,
        timeConfidence: patch.timeConfidence ?? undefined,
        mealType: patch.mealType ?? undefined,
        title: patch.title ?? undefined,
        description: patch.description ?? undefined,
        location: patch.location ?? undefined,
        restaurantName: patch.restaurantName ?? undefined,
        socialContext: patch.socialContext ?? undefined,
        hungerBefore: patch.hungerBefore ?? undefined,
        fullnessAfter: patch.fullnessAfter ?? undefined,
        preparation: patch.preparation ?? undefined,
        estimatedCalories: patch.estimatedCalories ?? undefined,
        macros: patch.macros !== undefined ? J(patch.macros) : undefined,
        portionSize: patch.portionSize ?? undefined,
        completenessScore: patch.completenessScore ?? undefined,
        aiConfidence: patch.aiConfidence ?? undefined,
        notes: patch.notes ?? undefined,
        items: patch.items ? (patch.items as unknown as Prisma.InputJsonValue) : undefined,
      },
    });
    const full = mealToDomain(row as Row);
    const tz = await this.tz();
    await this.recomputeDaySummary(prevDate);
    const newDate = userLocalDate(full.occurredAt, tz);
    if (newDate !== prevDate) await this.recomputeDaySummary(newDate);
    return full;
  }

  async deleteMeal(id: ID): Promise<void> {
    const existing = mealToDomain((await this.ownedOrThrow("meal", id)) as Row);
    await prisma.meal.delete({ where: { id } });
    await this.recomputeDaySummary(userLocalDate(existing.occurredAt, await this.tz()));
  }

  // ---- symptoms -------------------------------------------------------------

  async addSymptom(s: NewSymptom): Promise<Symptom> {
    const triggers = (s.triggers ?? []).map((t) => ({ ...t, id: newId(), createdAt: nowIso() }));
    const row = await prisma.symptom.create({
      data: {
        userId: this.userId,
        logSessionId: s.logSessionId ?? null,
        occurredAt: new Date(s.occurredAt),
        timeConfidence: s.timeConfidence,
        symptomType: s.symptomType,
        title: s.title,
        severity: s.severity,
        durationMinutes: s.durationMinutes ?? null,
        isOngoing: s.isOngoing,
        resolvedAt: s.resolvedAt ? new Date(s.resolvedAt) : null,
        bodyLocation: s.bodyLocation ?? null,
        description: s.description ?? null,
        completenessScore: s.completenessScore,
        aiConfidence: s.aiConfidence ?? null,
        source: s.source,
        triggers: triggers as unknown as Prisma.InputJsonValue,
      },
    });
    const full = symptomToDomain(row as Row);
    await this.recomputeDaySummary(userLocalDate(full.occurredAt, await this.tz()));
    return full;
  }

  async updateSymptom(id: ID, patch: Partial<Symptom>): Promise<Symptom> {
    await this.ownedOrThrow("symptom", id);
    const row = await prisma.symptom.update({
      where: { id },
      data: {
        occurredAt: patch.occurredAt ? new Date(patch.occurredAt) : undefined,
        timeConfidence: patch.timeConfidence ?? undefined,
        symptomType: patch.symptomType ?? undefined,
        title: patch.title ?? undefined,
        severity: patch.severity ?? undefined,
        durationMinutes: patch.durationMinutes ?? undefined,
        isOngoing: patch.isOngoing ?? undefined,
        resolvedAt: patch.resolvedAt ? new Date(patch.resolvedAt) : undefined,
        bodyLocation: patch.bodyLocation ?? undefined,
        description: patch.description ?? undefined,
        completenessScore: patch.completenessScore ?? undefined,
        aiConfidence: patch.aiConfidence ?? undefined,
        triggers: patch.triggers ? (patch.triggers as unknown as Prisma.InputJsonValue) : undefined,
      },
    });
    return symptomToDomain(row as Row);
  }

  async deleteSymptom(id: ID): Promise<void> {
    const existing = symptomToDomain((await this.ownedOrThrow("symptom", id)) as Row);
    await prisma.symptom.delete({ where: { id } });
    await this.recomputeDaySummary(userLocalDate(existing.occurredAt, await this.tz()));
  }

  async addTrigger(symptomId: ID, trigger: Omit<SymptomTrigger, "id" | "createdAt">): Promise<Symptom> {
    const existing = symptomToDomain((await this.ownedOrThrow("symptom", symptomId)) as Row);
    const triggers = [...existing.triggers, { ...trigger, id: newId(), createdAt: nowIso() }];
    const row = await prisma.symptom.update({
      where: { id: symptomId },
      data: { triggers: triggers as unknown as Prisma.InputJsonValue },
    });
    return symptomToDomain(row as Row);
  }

  // ---- mood & hydration -----------------------------------------------------

  async addMood(m: NewMood): Promise<Mood> {
    const row = await prisma.mood.create({
      data: {
        userId: this.userId,
        logSessionId: m.logSessionId ?? null,
        occurredAt: new Date(m.occurredAt),
        rating: m.rating,
        label: m.label ?? null,
        energyLevel: m.energyLevel ?? null,
        stressLevel: m.stressLevel ?? null,
        notes: m.notes ?? null,
        source: m.source,
      },
    });
    const full = moodToDomain(row as Row);
    await this.recomputeDaySummary(userLocalDate(full.occurredAt, await this.tz()));
    return full;
  }
  async updateMood(id: ID, patch: Partial<Mood>): Promise<Mood> {
    await this.ownedOrThrow("mood", id);
    const row = await prisma.mood.update({
      where: { id },
      data: {
        occurredAt: patch.occurredAt ? new Date(patch.occurredAt) : undefined,
        rating: patch.rating ?? undefined,
        label: patch.label ?? undefined,
        energyLevel: patch.energyLevel ?? undefined,
        stressLevel: patch.stressLevel ?? undefined,
        notes: patch.notes ?? undefined,
      },
    });
    const full = moodToDomain(row as Row);
    await this.recomputeDaySummary(userLocalDate(full.occurredAt, await this.tz()));
    return full;
  }
  async deleteMood(id: ID): Promise<void> {
    const existing = moodToDomain((await this.ownedOrThrow("mood", id)) as Row);
    await prisma.mood.delete({ where: { id } });
    await this.recomputeDaySummary(userLocalDate(existing.occurredAt, await this.tz()));
  }

  async addHydration(h: NewHydration): Promise<HydrationLog> {
    const row = await prisma.hydrationLog.create({
      data: {
        userId: this.userId,
        logSessionId: h.logSessionId ?? null,
        occurredAt: new Date(h.occurredAt),
        amountMl: h.amountMl,
        beverageType: h.beverageType,
        notes: h.notes ?? null,
        source: h.source,
      },
    });
    const full = hydrationToDomain(row as Row);
    await this.recomputeDaySummary(userLocalDate(full.occurredAt, await this.tz()));
    return full;
  }
  async updateHydration(id: ID, patch: Partial<HydrationLog>): Promise<HydrationLog> {
    await this.ownedOrThrow("hydrationLog", id);
    const row = await prisma.hydrationLog.update({
      where: { id },
      data: {
        occurredAt: patch.occurredAt ? new Date(patch.occurredAt) : undefined,
        amountMl: patch.amountMl ?? undefined,
        beverageType: patch.beverageType ?? undefined,
        notes: patch.notes ?? undefined,
      },
    });
    const full = hydrationToDomain(row as Row);
    await this.recomputeDaySummary(userLocalDate(full.occurredAt, await this.tz()));
    return full;
  }
  async deleteHydration(id: ID): Promise<void> {
    const existing = hydrationToDomain((await this.ownedOrThrow("hydrationLog", id)) as Row);
    await prisma.hydrationLog.delete({ where: { id } });
    await this.recomputeDaySummary(userLocalDate(existing.occurredAt, await this.tz()));
  }

  // ---- menstrual cycle ------------------------------------------------------

  async listCycleLogs(range?: { start: ISODate; end: ISODate }): Promise<CycleLog[]> {
    const rows = await prisma.cycleLog.findMany({
      where: {
        userId: this.userId,
        ...(range ? { date: { gte: range.start, lte: range.end } } : {}),
      },
      orderBy: { date: "asc" },
    });
    return rows.map((r) => cycleLogToDomain(r as Row));
  }

  async upsertCycleLog(date: ISODate, patch: CycleLogPatch): Promise<CycleLog> {
    const data: Record<string, unknown> = {};
    if (patch.isPeriodStart !== undefined) data.isPeriodStart = patch.isPeriodStart;
    if (patch.flow !== undefined) data.flow = patch.flow;
    if (patch.clots !== undefined) data.clots = patch.clots;
    if (patch.flooding !== undefined) data.flooding = patch.flooding;
    if (patch.bbtCelsius !== undefined) data.bbtCelsius = patch.bbtCelsius;
    if (patch.cervicalMucus !== undefined) data.cervicalMucus = patch.cervicalMucus;
    if (patch.ovulationTest !== undefined) data.ovulationTest = patch.ovulationTest;
    if (patch.intercourse !== undefined) data.intercourse = patch.intercourse;
    if (patch.notes !== undefined) data.notes = patch.notes;
    if (patch.source !== undefined) data.source = patch.source;

    const row = await prisma.cycleLog.upsert({
      where: { userId_date: { userId: this.userId, date } },
      create: { userId: this.userId, date, ...data } as Prisma.CycleLogUncheckedCreateInput,
      update: data as Prisma.CycleLogUncheckedUpdateInput,
    });
    return cycleLogToDomain(row as Row);
  }

  async deleteCycleLog(date: ISODate): Promise<void> {
    await prisma.cycleLog.deleteMany({ where: { userId: this.userId, date } });
  }

  // ---- day context (environment) --------------------------------------------

  async getDayContext(date: ISODate): Promise<DayContext | null> {
    const row = await prisma.dayContext.findUnique({
      where: { userId_date: { userId: this.userId, date } },
    });
    return row ? dayContextToDomain(row as Row) : null;
  }

  async listDayContexts(range?: { start: ISODate; end: ISODate }): Promise<DayContext[]> {
    const rows = await prisma.dayContext.findMany({
      where: {
        userId: this.userId,
        ...(range ? { date: { gte: range.start, lte: range.end } } : {}),
      },
      orderBy: { date: "asc" },
    });
    return rows.map((r) => dayContextToDomain(r as Row));
  }

  async upsertDayContext(date: ISODate, patch: DayContextPatch): Promise<DayContext> {
    const data: Record<string, unknown> = {};
    const keys: (keyof DayContextPatch)[] = [
      "city", "region", "country", "latitude", "longitude", "locationSource",
      "tempMinC", "tempMaxC", "tempMeanC", "apparentMaxC", "humidityMean",
      "pressureMeanHpa", "pressureRangeHpa", "precipitationMm", "windMaxKph",
      "uvIndexMax", "weatherCode", "daylightMinutes", "pm25Mean", "pm10Mean",
      "aqiUsMax", "moonPhase", "moonIllumination", "season", "source",
    ];
    for (const k of keys) if (patch[k] !== undefined) data[k] = patch[k];

    const row = await prisma.dayContext.upsert({
      where: { userId_date: { userId: this.userId, date } },
      create: { userId: this.userId, date, ...data } as Prisma.DayContextUncheckedCreateInput,
      update: data as Prisma.DayContextUncheckedUpdateInput,
    });
    return dayContextToDomain(row as Row);
  }

  // ---- queries --------------------------------------------------------------

  private rangeWhere(range?: DateRange) {
    if (!range) return {};
    return { occurredAt: { gte: new Date(range.start), lte: new Date(range.end) } };
  }

  async listMeals(range?: DateRange): Promise<Meal[]> {
    const rows = await prisma.meal.findMany({
      where: { userId: this.userId, ...this.rangeWhere(range) },
      orderBy: { occurredAt: "desc" },
    });
    return rows.map((r) => mealToDomain(r as Row));
  }
  async listSymptoms(range?: DateRange): Promise<Symptom[]> {
    const rows = await prisma.symptom.findMany({
      where: { userId: this.userId, ...this.rangeWhere(range) },
      orderBy: { occurredAt: "desc" },
    });
    return rows.map((r) => symptomToDomain(r as Row));
  }
  async listMoods(range?: DateRange): Promise<Mood[]> {
    const rows = await prisma.mood.findMany({
      where: { userId: this.userId, ...this.rangeWhere(range) },
      orderBy: { occurredAt: "desc" },
    });
    return rows.map((r) => moodToDomain(r as Row));
  }
  async listHydration(range?: DateRange): Promise<HydrationLog[]> {
    const rows = await prisma.hydrationLog.findMany({
      where: { userId: this.userId, ...this.rangeWhere(range) },
      orderBy: { occurredAt: "desc" },
    });
    return rows.map((r) => hydrationToDomain(r as Row));
  }

  // ---- day views & rollups --------------------------------------------------

  async getDay(date: ISODate): Promise<DayDetail> {
    const tz = await this.tz();
    // Pull a generous instant window around the local day, then filter precisely.
    const start = new Date(`${date}T00:00:00.000Z`);
    start.setUTCDate(start.getUTCDate() - 1);
    const end = new Date(`${date}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 2);
    const range: DateRange = { start: start.toISOString(), end: end.toISOString() };
    const onDate = <T extends { occurredAt: string }>(arr: T[]) =>
      arr.filter((x) => userLocalDate(x.occurredAt, tz) === date);

    const [summaryRow, meals, symptoms, moods, hydration] = await Promise.all([
      prisma.daySummary.findUnique({ where: { userId_date: { userId: this.userId, date } } }),
      this.listMeals(range),
      this.listSymptoms(range),
      this.listMoods(range),
      this.listHydration(range),
    ]);
    return {
      date,
      summary: summaryRow ? summaryToDomain(summaryRow as Row) : null,
      meals: onDate(meals),
      symptoms: onDate(symptoms),
      moods: onDate(moods),
      hydration: onDate(hydration),
    };
  }

  async listDaySummaries(range?: { start: ISODate; end: ISODate }): Promise<DaySummary[]> {
    const rows = await prisma.daySummary.findMany({
      where: {
        userId: this.userId,
        ...(range ? { date: { gte: range.start, lte: range.end } } : {}),
      },
      orderBy: { date: "desc" },
    });
    return rows.map((r) => summaryToDomain(r as Row));
  }

  async upsertDaySummary(date: ISODate, patch: Partial<DaySummary>): Promise<DaySummary> {
    const data: Record<string, unknown> = {};
    if (patch.overallRating !== undefined) data.overallRating = patch.overallRating;
    if (patch.ratingLabel !== undefined) data.ratingLabel = patch.ratingLabel;
    if (patch.ratingCapturedAt !== undefined)
      data.ratingCapturedAt = patch.ratingCapturedAt ? new Date(patch.ratingCapturedAt) : null;
    if (patch.ratingSamples !== undefined)
      data.ratingSamples = patch.ratingSamples as unknown as Prisma.InputJsonValue;
    if (patch.isClosed !== undefined) data.isClosed = patch.isClosed;
    if (patch.reflection !== undefined) data.reflection = patch.reflection;
    if (patch.aiSummary !== undefined) data.aiSummary = patch.aiSummary;
    if (patch.mealCount !== undefined) data.mealCount = patch.mealCount;
    if (patch.symptomCount !== undefined) data.symptomCount = patch.symptomCount;
    if (patch.moodAvg !== undefined) data.moodAvg = patch.moodAvg;
    if (patch.totalWaterMl !== undefined) data.totalWaterMl = patch.totalWaterMl;

    const row = await prisma.daySummary.upsert({
      where: { userId_date: { userId: this.userId, date } },
      create: { userId: this.userId, date, ...data } as Prisma.DaySummaryUncheckedCreateInput,
      update: data as Prisma.DaySummaryUncheckedUpdateInput,
    });
    return summaryToDomain(row as Row);
  }

  async recomputeDaySummary(date: ISODate): Promise<DaySummary> {
    const day = await this.getDay(date);
    const moodAvg =
      day.moods.length > 0
        ? day.moods.reduce((sum, m) => sum + m.rating, 0) / day.moods.length
        : null;
    const totalWaterMl = day.hydration.reduce((s, h) => s + (h.amountMl || 0), 0);
    return this.upsertDaySummary(date, {
      mealCount: day.meals.length,
      symptomCount: day.symptoms.length,
      moodAvg,
      totalWaterMl,
    });
  }

  async recordDayRating(date: ISODate, rating: number, at: string = nowIso()): Promise<DaySummary> {
    const current = await this.upsertDaySummary(date, {});
    const startMs = new Date(`${date}T00:00:00.000Z`).getTime();
    const endMs = new Date(`${date}T23:59:59.999Z`).getTime();
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

  // ---- follow-ups -----------------------------------------------------------

  async addFollowUps(items: NewFollowUp[]): Promise<FollowUpQuestion[]> {
    const created: FollowUpQuestion[] = [];
    for (const it of items) {
      const row = await prisma.followUpQuestion.create({
        data: {
          userId: this.userId,
          logSessionId: it.logSessionId ?? null,
          targetType: it.targetType,
          targetId: it.targetId ?? null,
          questionText: it.questionText,
          fieldHint: it.fieldHint ?? null,
          generatedBy: it.generatedBy ?? "ai",
        },
      });
      created.push(followUpToDomain(row as Row));
    }
    return created;
  }
  async listFollowUps(status?: FollowUpQuestion["status"]): Promise<FollowUpQuestion[]> {
    const rows = await prisma.followUpQuestion.findMany({
      where: { userId: this.userId, ...(status ? { status } : {}) },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((r) => followUpToDomain(r as Row));
  }
  async answerFollowUp(id: ID, answer: string): Promise<FollowUpQuestion> {
    await this.ownedOrThrow("followUpQuestion", id);
    const row = await prisma.followUpQuestion.update({
      where: { id },
      data: { status: "answered", answerText: answer, answeredAt: new Date() },
    });
    return followUpToDomain(row as Row);
  }
  async dismissFollowUp(id: ID): Promise<FollowUpQuestion> {
    await this.ownedOrThrow("followUpQuestion", id);
    const row = await prisma.followUpQuestion.update({
      where: { id },
      data: { status: "dismissed" },
    });
    return followUpToDomain(row as Row);
  }

  // ---- insights -------------------------------------------------------------

  async listInsights(): Promise<Insight[]> {
    const rows = await prisma.insight.findMany({ where: { userId: this.userId } });
    return rows.map((r) => insightToDomain(r as Row));
  }
  async replaceInsights(
    insights: Omit<Insight, "id" | "userId" | "createdAt" | "updatedAt">[],
  ): Promise<Insight[]> {
    await prisma.insight.deleteMany({ where: { userId: this.userId } });
    const created: Insight[] = [];
    for (const i of insights) {
      const row = await prisma.insight.create({
        data: {
          userId: this.userId,
          insightType: i.insightType,
          subjectKind: i.subjectKind ?? null,
          subjectValue: i.subjectValue ?? null,
          objectKind: i.objectKind ?? null,
          objectValue: i.objectValue ?? null,
          title: i.title,
          description: i.description,
          strength: i.strength ?? null,
          supportCount: i.supportCount ?? null,
          exposureCount: i.exposureCount ?? null,
          confidence: i.confidence ?? null,
          avgLagMinutes: i.avgLagMinutes ?? null,
          periodStart: i.periodStart ? new Date(i.periodStart) : null,
          periodEnd: i.periodEnd ? new Date(i.periodEnd) : null,
          status: i.status,
          evidence: J(i.evidence),
        },
      });
      created.push(insightToDomain(row as Row));
    }
    return created;
  }

  // ---- bulk & destructive ---------------------------------------------------

  async getCorrelationDataset(range?: DateRange): Promise<CorrelationDataset> {
    const dateRange = range
      ? { start: userLocalDate(range.start, await this.tz()), end: userLocalDate(range.end, await this.tz()) }
      : undefined;
    const [meals, symptoms, moods, hydration, cycleLogs] = await Promise.all([
      this.listMeals(range),
      this.listSymptoms(range),
      this.listMoods(range),
      this.listHydration(range),
      this.listCycleLogs(dateRange),
    ]);
    return { meals, symptoms, moods, hydration, cycleLogs };
  }

  async deleteDay(date: ISODate): Promise<void> {
    const day = await this.getDay(date);
    await prisma.meal.deleteMany({ where: { id: { in: day.meals.map((m) => m.id) } } });
    await prisma.symptom.deleteMany({ where: { id: { in: day.symptoms.map((s) => s.id) } } });
    await prisma.mood.deleteMany({ where: { id: { in: day.moods.map((m) => m.id) } } });
    await prisma.hydrationLog.deleteMany({ where: { id: { in: day.hydration.map((h) => h.id) } } });
    await prisma.daySummary.deleteMany({ where: { userId: this.userId, date } });
  }

  async clearAllData(): Promise<void> {
    const where = { userId: this.userId };
    await prisma.meal.deleteMany({ where });
    await prisma.symptom.deleteMany({ where });
    await prisma.mood.deleteMany({ where });
    await prisma.hydrationLog.deleteMany({ where });
    await prisma.cycleLog.deleteMany({ where });
    await prisma.dayContext.deleteMany({ where });
    await prisma.daySummary.deleteMany({ where });
    await prisma.logSession.deleteMany({ where });
    await prisma.followUpQuestion.deleteMany({ where });
    await prisma.insight.deleteMany({ where });
  }

  // ---- helpers --------------------------------------------------------------

  private async ownedOrThrow(
    model: "meal" | "symptom" | "mood" | "hydrationLog" | "logSession" | "followUpQuestion",
    id: ID,
  ): Promise<Row> {
    const delegate = (
      prisma as unknown as Record<
        string,
        { findUnique(arg: { where: { id: string } }): Promise<{ userId: string } | null> }
      >
    )[model];
    const row = await delegate.findUnique({ where: { id } });
    if (!row || row.userId !== this.userId) throw new Error("Not found");
    return row as unknown as Row;
  }
  private async assertOwns(
    model: "meal" | "symptom" | "mood" | "hydrationLog" | "logSession" | "followUpQuestion",
    id: ID,
  ): Promise<void> {
    await this.ownedOrThrow(model, id);
  }
}
