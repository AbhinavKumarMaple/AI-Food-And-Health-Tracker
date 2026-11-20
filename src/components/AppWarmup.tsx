"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { getStore } from "@/lib/store";
import { qk, useCurrentUser, ensureDayContext } from "@/lib/queries";
import { resumePendingCaptures } from "@/lib/capture";
import { todayISODate } from "@/lib/store/util";

/** Delay before warming data the capture flow doesn't need (history, stats…). */
const DEFERRED_WARMUP_MS = 2000;

/**
 * Once the user is known, prefetch what Today needs right away, and the data the
 * other tabs need a moment later — so opening the app and recording never compete
 * with background fetches. prefetchQuery respects staleTime, so it's a no-op when
 * the cache is already fresh. Also resumes uploads of recordings the server never
 * received (e.g. the app was closed mid-upload).
 */
export function AppWarmup() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { data: user } = useCurrentUser();

  useEffect(() => {
    if (!user) return;
    const store = getStore();
    const today = todayISODate();
    queryClient.prefetchQuery({ queryKey: qk.day(today), queryFn: () => store.getDay(today) });
    queryClient.prefetchQuery({ queryKey: qk.settings, queryFn: () => store.getSettings() });
    void resumePendingCaptures(queryClient, (jobId) => router.push(`/review/${jobId}`));

    let timer: ReturnType<typeof setTimeout>;
    const warmRest = () => {
      // Don't compete with a recording or its upload — check again shortly.
      if (window.location.pathname === "/record") {
        timer = setTimeout(warmRest, DEFERRED_WARMUP_MS);
        return;
      }
      queryClient.prefetchQuery({ queryKey: qk.daySummaries, queryFn: () => store.listDaySummaries() });
      queryClient.prefetchQuery({ queryKey: qk.correlation, queryFn: () => store.getCorrelationDataset() });
      queryClient.prefetchQuery({ queryKey: qk.profile, queryFn: () => store.getProfile() });
      queryClient.prefetchQuery({ queryKey: qk.cycleLogs, queryFn: () => store.listCycleLogs() });
      queryClient.prefetchQuery({ queryKey: qk.dayContext(today), queryFn: () => store.getDayContext(today) });
      // Auto-capture today's free environmental context (no-ops if disabled).
      void ensureDayContext(queryClient);
    };
    timer = setTimeout(warmRest, DEFERRED_WARMUP_MS);
    return () => clearTimeout(timer);
  }, [user, queryClient, router]);

  return null;
}
