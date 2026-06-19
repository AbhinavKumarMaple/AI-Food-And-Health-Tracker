"use client";

import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getStore } from "@/lib/store";
import { qk, invalidateEntries } from "@/lib/queries";
import type { Drafts } from "@/lib/draft";
import type {
  DayDetail,
  DaySummary,
  HydrationLog,
  ISODate,
  LogSession,
  Meal,
  Mood,
  Symptom,
} from "@/lib/store/types";
import { newId, nowIso } from "@/lib/store/util";
import { moodLabel } from "@/lib/format";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Run `fn`, retrying on failure with linear backoff. Throws after all attempts. */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 3, delayMs = 700): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) await sleep(delayMs * (i + 1));
    }
  }
  throw lastErr;
}

export type EntryKind = "meal" | "symptom" | "mood" | "hydration";

/**
 * Delete a day entry WITHOUT making the user wait: remove it from the day cache
 * immediately, then delete on the server in the background (with retries). If it
 * ultimately fails, the entry is restored and a toast is shown.
 */
export function deleteEntryOptimistic(
  queryClient: QueryClient,
  date: ISODate,
  kind: EntryKind,
  id: string,
): void {
  const key = qk.day(date);
  const prev = queryClient.getQueryData<DayDetail>(key);

  queryClient.setQueryData<DayDetail>(key, (old) => {
    if (!old) return old;
    if (kind === "meal") return { ...old, meals: old.meals.filter((m) => m.id !== id) };
    if (kind === "symptom") return { ...old, symptoms: old.symptoms.filter((s) => s.id !== id) };
    if (kind === "mood") return { ...old, moods: old.moods.filter((m) => m.id !== id) };
    return { ...old, hydration: old.hydration.filter((h) => h.id !== id) };
  });

  void (async () => {
    const store = getStore();
    try {
      await withRetry(() => {
        if (kind === "meal") return store.deleteMeal(id);
        if (kind === "symptom") return store.deleteSymptom(id);
        if (kind === "mood") return store.deleteMood(id);
        return store.deleteHydration(id);
      });
      invalidateEntries(queryClient);
    } catch {
      if (prev) queryClient.setQueryData(key, prev); // rollback
      toast.error("Couldn't delete that — it's back in your log.");
    }
  })();
}

/**
 * Discard a capture WITHOUT waiting: drop it from the Inbox cache immediately,
 * then mark it discarded on the server in the background (with retries). If it
 * fails, it reappears and a toast is shown.
 */
export function discardSessionOptimistic(queryClient: QueryClient, id: string): void {
  queryClient.setQueryData<LogSession[]>(qk.logSessions, (old) =>
    old ? old.filter((s) => s.id !== id) : old,
  );
  void (async () => {
    try {
      await withRetry(() => getStore().updateLogSession(id, { parseStatus: "discarded" }));
      queryClient.invalidateQueries({ queryKey: qk.logSessions });
    } catch {
      queryClient.invalidateQueries({ queryKey: qk.logSessions }); // it'll come back
      toast.error("Couldn't discard that — it's back in your Inbox.");
    }
  })();
}

/**
 * Rate a day WITHOUT waiting: reflect the new rating in the day cache instantly,
 * then persist (which computes the true time-weighted average) in the background
 * and reconcile. Rolls back + toasts on failure.
 */
export function recordDayRatingOptimistic(
  queryClient: QueryClient,
  date: ISODate,
  rating: number,
): void {
  const key = qk.day(date);
  const prev = queryClient.getQueryData<DayDetail>(key);
  const now = nowIso();

  queryClient.setQueryData<DayDetail>(key, (old) => {
    if (!old) return old;
    const samples = [...(old.summary?.ratingSamples ?? []), { rating, at: now }];
    const summary: DaySummary = old.summary
      ? {
          ...old.summary,
          ratingSamples: samples,
          overallRating: rating,
          ratingLabel: moodLabel(rating),
          ratingCapturedAt: now,
          updatedAt: now,
        }
      : {
          id: `temp-${date}`,
          userId: "",
          date,
          overallRating: rating,
          ratingLabel: moodLabel(rating),
          ratingCapturedAt: now,
          ratingSamples: samples,
          isClosed: false,
          reflection: null,
          aiSummary: null,
          mealCount: old.meals.length,
          symptomCount: old.symptoms.length,
          moodAvg: null,
          totalWaterMl: old.hydration.reduce((s, h) => s + (h.amountMl || 0), 0),
          createdAt: now,
          updatedAt: now,
        };
    return { ...old, summary };
  });

  void (async () => {
    try {
      await withRetry(() => getStore().recordDayRating(date, rating));
      queryClient.invalidateQueries({ queryKey: key }); // reconcile with true weighted avg
      queryClient.invalidateQueries({ queryKey: qk.daySummaries });
    } catch {
      queryClient.setQueryData(key, prev); // rollback
      toast.error("Couldn't save your rating. Tap to try again.");
    }
  })();
}

// ---- optimistic save (review → day) ---------------------------------------

const tmp = () => `temp-${newId()}`;

function optimisticMeal(m: Drafts["meals"][number]): Meal {
  const now = nowIso();
  return {
    ...m,
    id: tmp(),
    userId: "",
    items: m.items.map((it) => ({ ...it, id: tmp() })),
    createdAt: now,
    updatedAt: now,
  };
}
function optimisticSymptom(s: Drafts["symptoms"][number]): Symptom {
  const now = nowIso();
  return {
    ...s,
    id: tmp(),
    userId: "",
    triggers: (s.triggers ?? []).map((t) => ({ ...t, id: tmp(), createdAt: now })),
    createdAt: now,
    updatedAt: now,
  };
}
function optimisticMood(m: Drafts["moods"][number]): Mood {
  const now = nowIso();
  return { ...m, id: tmp(), userId: "", createdAt: now, updatedAt: now };
}
function optimisticHydration(h: Drafts["hydration"][number]): HydrationLog {
  return { ...h, id: tmp(), userId: "", createdAt: nowIso() };
}

/**
 * Persist a reviewed log WITHOUT making the user wait: paint the new entries
 * into the day cache immediately (caller navigates straight to the day), then
 * create them on the server in the background with retries. A toast appears only
 * if something ultimately fails.
 */
export function saveLogOptimistic(args: {
  queryClient: QueryClient;
  drafts: Drafts;
  sessionId: string;
  date: ISODate;
}): void {
  const { queryClient, drafts, sessionId, date } = args;

  // 1. Optimistic paint into the target day.
  queryClient.setQueryData<DayDetail>(qk.day(date), (old) => {
    const base: DayDetail =
      old ?? { date, summary: null, meals: [], symptoms: [], moods: [], hydration: [] };
    return {
      ...base,
      meals: [...base.meals, ...drafts.meals.map(optimisticMeal)],
      symptoms: [...base.symptoms, ...drafts.symptoms.map(optimisticSymptom)],
      moods: [...base.moods, ...drafts.moods.map(optimisticMood)],
      hydration: [...base.hydration, ...drafts.hydration.map(optimisticHydration)],
    };
  });

  // 2. Real writes in the background (retried), then reconcile.
  void (async () => {
    const store = getStore();
    try {
      const mealIds: string[] = [];
      for (const m of drafts.meals) mealIds.push((await withRetry(() => store.addMeal(m))).id);
      const symptomIds: string[] = [];
      for (const s of drafts.symptoms) symptomIds.push((await withRetry(() => store.addSymptom(s))).id);
      const moodIds: string[] = [];
      for (const m of drafts.moods) moodIds.push((await withRetry(() => store.addMood(m))).id);
      const hydrationIds: string[] = [];
      for (const h of drafts.hydration) hydrationIds.push((await withRetry(() => store.addHydration(h))).id);
      for (const c of drafts.cycle) await withRetry(() => store.upsertCycleLog(c.date, c.patch));

      const fuPayload = drafts.followUps.map((f) => {
        let targetId: string | null = null;
        if (f.targetIndex != null) {
          if (f.targetType === "meal") targetId = mealIds[f.targetIndex] ?? null;
          else if (f.targetType === "symptom") targetId = symptomIds[f.targetIndex] ?? null;
          else if (f.targetType === "mood") targetId = moodIds[f.targetIndex] ?? null;
          else if (f.targetType === "hydration") targetId = hydrationIds[f.targetIndex] ?? null;
        }
        return {
          logSessionId: sessionId,
          targetType: f.targetType,
          targetId,
          questionText: f.questionText,
          fieldHint: f.fieldHint,
          generatedBy: "ai",
        };
      });
      if (fuPayload.length) {
        const createdFu = await withRetry(() => store.addFollowUps(fuPayload));
        for (let i = 0; i < drafts.followUps.length; i++) {
          const ans = drafts.followUps[i].answerText;
          if (ans && ans.trim()) await withRetry(() => store.answerFollowUp(createdFu[i].id, ans.trim()));
        }
      }

      await withRetry(() =>
        store.updateLogSession(sessionId, {
          parseStatus: "confirmed",
          confirmedAt: nowIso(),
          entryCount: mealIds.length + symptomIds.length + moodIds.length + hydrationIds.length,
        }),
      );
      invalidateEntries(queryClient);
      queryClient.invalidateQueries({ queryKey: qk.logSessions }); // drop from Inbox
    } catch {
      toast.error("Some entries didn't save. Open the day and tap refresh to check.");
      invalidateEntries(queryClient);
    }
  })();
}
