"use client";

import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { getAuth, getStore } from "@/lib/store";
import type { ISODate, LogSession, ParseStatus } from "@/lib/store/types";
import type { GeminiModel } from "@/lib/gemini/models";

/** localStorage key the query cache is persisted under. */
export const PERSIST_KEY = "avni-query-cache";

/** Clear the in-memory + persisted cache (on logout). */
export function clearAllCache(client: QueryClient) {
  client.clear();
  if (typeof window !== "undefined") window.localStorage.removeItem(PERSIST_KEY);
}

// Query keys (single source of truth)
export const qk = {
  currentUser: ["currentUser"] as const,
  profile: ["profile"] as const,
  settings: ["settings"] as const,
  day: (date: ISODate) => ["day", date] as const,
  daySummaries: ["daySummaries"] as const,
  correlation: ["correlationDataset"] as const,
  cycleLogs: ["cycleLogs"] as const,
  dayContext: (date: ISODate) => ["dayContext", date] as const,
  logSessions: ["logSessions"] as const,
};

/** Statuses that belong in the Inbox (still in flight or awaiting review). */
export const INBOX_STATUSES: ParseStatus[] = ["processing", "parsed", "failed"];

export function useCurrentUser() {
  return useQuery({
    queryKey: qk.currentUser,
    queryFn: () => getAuth().getCurrentUser(),
    staleTime: 10 * 60_000, // the session rarely changes; cache it across navigation
  });
}

export function useProfile(enabled = true) {
  return useQuery({ queryKey: qk.profile, queryFn: () => getStore().getProfile(), enabled });
}

export function useSettings(enabled = true) {
  return useQuery({ queryKey: qk.settings, queryFn: () => getStore().getSettings(), enabled });
}

export function useDay(date: ISODate, enabled = true) {
  return useQuery({ queryKey: qk.day(date), queryFn: () => getStore().getDay(date), enabled });
}

export function useDaySummaries(enabled = true) {
  return useQuery({
    queryKey: qk.daySummaries,
    queryFn: () => getStore().listDaySummaries(),
    enabled,
  });
}

export function useCorrelationDataset(enabled = true) {
  return useQuery({
    queryKey: qk.correlation,
    queryFn: () => getStore().getCorrelationDataset(),
    enabled,
  });
}

export function useCycleLogs(enabled = true) {
  return useQuery({
    queryKey: qk.cycleLogs,
    queryFn: () => getStore().listCycleLogs(),
    enabled,
  });
}

/**
 * Live list of Gemini models the user's key can use, cached so the Settings
 * picker is populated on open (not only after clicking a button). Keyed by a
 * short non-sensitive suffix so changing the key refetches without persisting
 * the full key into the localStorage query cache.
 */
export function useGeminiModels(apiKey: string | null | undefined) {
  return useQuery({
    queryKey: ["geminiModels", apiKey ? `${apiKey.length}:${apiKey.slice(-4)}` : "none"],
    enabled: !!apiKey,
    staleTime: 60 * 60_000, // the catalogue rarely changes
    retry: 0,
    queryFn: async () => {
      const res = await fetch("/api/gemini/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load models");
      return data.models as GeminiModel[];
    },
  });
}

export function useDayContext(date: ISODate, enabled = true) {
  return useQuery({
    queryKey: qk.dayContext(date),
    queryFn: () => getStore().getDayContext(date),
    enabled,
  });
}

/**
 * Ask the server to auto-capture (or backfill) the environmental context for a
 * day — coarse location + weather + air quality + moon/season — then seed the
 * cache. No-ops silently if env tracking is off or the network fails.
 */
export async function ensureDayContext(client: QueryClient, date?: ISODate): Promise<void> {
  try {
    const res = await fetch("/api/context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(date ? { date } : {}),
    });
    if (!res.ok) return;
    const { context } = (await res.json()) as { context: import("@/lib/store/types").DayContext | null };
    if (context) client.setQueryData(qk.dayContext(context.date), context);
  } catch {
    // best-effort; env context is non-critical
  }
}

/**
 * The Inbox: capture jobs that are processing / ready to review / failed. Polls
 * every 2.5s ONLY while something is still processing, then stops.
 */
export function useLogSessions(enabled = true) {
  return useQuery({
    queryKey: qk.logSessions,
    queryFn: () => getStore().listLogSessions(INBOX_STATUSES),
    enabled,
    staleTime: 0, // status changes matter — always revalidate (cached data still shows instantly)
    refetchInterval: (query) => {
      const data = query.state.data as LogSession[] | undefined;
      return data?.some((s) => s.parseStatus === "processing") ? 2500 : false;
    },
  });
}

export function invalidateLogSessions(client: QueryClient) {
  client.invalidateQueries({ queryKey: qk.logSessions });
}

/** Invalidate everything that depends on logged entries (after add/edit/delete). */
export function invalidateEntries(client: QueryClient) {
  client.invalidateQueries({ queryKey: ["day"] });
  client.invalidateQueries({ queryKey: qk.daySummaries });
  client.invalidateQueries({ queryKey: qk.correlation });
  client.invalidateQueries({ queryKey: qk.cycleLogs });
}

export { useQueryClient };
