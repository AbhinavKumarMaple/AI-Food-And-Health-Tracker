"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getStore } from "@/lib/store";
import { qk, useCurrentUser } from "@/lib/queries";
import { todayISODate } from "@/lib/store/util";

/**
 * Once the user is known, prefetch the data every tab needs — in parallel — so
 * navigating anywhere finds a warm cache (no skeleton, no wait). prefetchQuery
 * respects staleTime, so it's a no-op when the cache is already fresh.
 */
export function AppWarmup() {
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();

  useEffect(() => {
    if (!user) return;
    const store = getStore();
    const today = todayISODate();
    queryClient.prefetchQuery({ queryKey: qk.day(today), queryFn: () => store.getDay(today) });
    queryClient.prefetchQuery({ queryKey: qk.daySummaries, queryFn: () => store.listDaySummaries() });
    queryClient.prefetchQuery({ queryKey: qk.correlation, queryFn: () => store.getCorrelationDataset() });
    queryClient.prefetchQuery({ queryKey: qk.settings, queryFn: () => store.getSettings() });
    queryClient.prefetchQuery({ queryKey: qk.profile, queryFn: () => store.getProfile() });
    queryClient.prefetchQuery({ queryKey: qk.cycleLogs, queryFn: () => store.listCycleLogs() });
  }, [user, queryClient]);

  return null;
}
