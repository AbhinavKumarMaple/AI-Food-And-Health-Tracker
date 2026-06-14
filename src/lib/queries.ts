"use client";

import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { getAuth, getStore } from "@/lib/store";
import type { ISODate } from "@/lib/store/types";

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
};

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

/** Invalidate everything that depends on logged entries (after add/edit/delete). */
export function invalidateEntries(client: QueryClient) {
  client.invalidateQueries({ queryKey: ["day"] });
  client.invalidateQueries({ queryKey: qk.daySummaries });
  client.invalidateQueries({ queryKey: qk.correlation });
  client.invalidateQueries({ queryKey: qk.cycleLogs });
}

export { useQueryClient };
