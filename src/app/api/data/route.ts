import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/server/session";
import { PrismaDataStore } from "@/lib/server/prismaDataStore";

export const maxDuration = 30;

// Whitelisted DataStore methods callable over the RPC bridge.
const ALLOWED = new Set<string>([
  "getProfile",
  "updateProfile",
  "getSettings",
  "updateSettings",
  "createLogSession",
  "getLogSession",
  "updateLogSession",
  "listLogSessions",
  "addMeal",
  "updateMeal",
  "deleteMeal",
  "addSymptom",
  "updateSymptom",
  "deleteSymptom",
  "addTrigger",
  "addMood",
  "updateMood",
  "deleteMood",
  "addHydration",
  "updateHydration",
  "deleteHydration",
  "listCycleLogs",
  "upsertCycleLog",
  "deleteCycleLog",
  "listFoodNotes",
  "upsertFoodNote",
  "deleteFoodNote",
  "getDayContext",
  "listDayContexts",
  "upsertDayContext",
  "listMeals",
  "listSymptoms",
  "listMoods",
  "listHydration",
  "getDay",
  "listDaySummaries",
  "upsertDaySummary",
  "recomputeDaySummary",
  "recordDayRating",
  "addFollowUps",
  "listFollowUps",
  "answerFollowUp",
  "dismissFollowUp",
  "listInsights",
  "replaceInsights",
  "getCorrelationDataset",
  "deleteDay",
  "clearAllData",
]);

export async function POST(req: NextRequest) {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  let body: { method?: string; args?: unknown[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { method, args } = body;
  if (typeof method !== "string" || !ALLOWED.has(method)) {
    return NextResponse.json({ error: `Unknown method: ${method}` }, { status: 400 });
  }

  try {
    const store = new PrismaDataStore(uid) as unknown as Record<
      string,
      (...a: unknown[]) => Promise<unknown>
    >;
    const result = await store[method](...(Array.isArray(args) ? args : []));
    return NextResponse.json({ result });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Request failed" },
      { status: 500 },
    );
  }
}
