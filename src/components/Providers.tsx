"use client";

import { useState } from "react";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { AppWarmup } from "./AppWarmup";
import { PERSIST_KEY } from "@/lib/queries";

const ONE_DAY = 1000 * 60 * 60 * 24;

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Cache-first: a revisit within staleTime shows cached data with NO
            // network call. Freshness comes from mutation invalidation + the
            // manual refresh button, not from constant background refetching.
            staleTime: 5 * 60_000,
            gcTime: ONE_DAY, // keep for the persister
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            retry: 1,
          },
        },
      }),
  );

  const [persister] = useState(() =>
    createSyncStoragePersister({
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      key: PERSIST_KEY,
    }),
  );

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: ONE_DAY, buster: "v1" }}
    >
      <AppWarmup />
      {children}
    </PersistQueryClientProvider>
  );
}
