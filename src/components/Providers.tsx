"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { QueryClient, QueryClientProvider, dehydrate, hydrate } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { AppWarmup } from "./AppWarmup";
import { PERSIST_KEY } from "@/lib/queries";

const ONE_DAY = 1000 * 60 * 60 * 24;
const BUSTER = "v2";

// useLayoutEffect on the client (runs before paint), useEffect on the server.
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

type Persisted = { buster: string; timestamp: number; clientState: ReturnType<typeof dehydrate> };

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Cache-first / stale-while-revalidate: a revisit within staleTime
            // shows cached data with NO network call; when stale, the cached
            // data still shows instantly and a background refetch updates it
            // quietly on success. Freshness also comes from mutation
            // invalidation and the manual refresh button.
            staleTime: 5 * 60_000,
            gcTime: ONE_DAY,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            retry: 1,
          },
        },
      }),
  );

  // Restore the persisted cache SYNCHRONOUSLY, before the browser paints, so the
  // app shows the last-seen data immediately on open — no loading skeleton, no
  // flash. Stale queries then refetch in the background and swap in quietly.
  const [, force] = useState(0);
  useIsoLayoutEffect(() => {
    try {
      const raw = window.localStorage.getItem(PERSIST_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Persisted;
        if (parsed.buster === BUSTER && Date.now() - parsed.timestamp < ONE_DAY) {
          hydrate(queryClient, parsed.clientState);
          force((n) => n + 1); // ensure the tree re-renders with restored data pre-paint
        } else {
          window.localStorage.removeItem(PERSIST_KEY);
        }
      }
    } catch {
      // corrupt cache — ignore and start fresh
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient]);

  // Persist cache changes back to localStorage (throttled), and on unload.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const save = () => {
      try {
        const data: Persisted = {
          buster: BUSTER,
          timestamp: Date.now(),
          clientState: dehydrate(queryClient),
        };
        window.localStorage.setItem(PERSIST_KEY, JSON.stringify(data));
      } catch {
        // quota / serialization issues are non-fatal
      }
    };
    const unsub = queryClient.getQueryCache().subscribe(() => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        save();
      }, 1000);
    });
    window.addEventListener("pagehide", save);
    return () => {
      unsub();
      window.removeEventListener("pagehide", save);
      if (timer) clearTimeout(timer);
      save();
    };
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <AppWarmup />
      {children}
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "var(--color-surface)",
            color: "var(--color-ink)",
            border: "1px solid var(--color-line)",
            borderRadius: "16px",
            fontFamily: "var(--font-body)",
          },
        }}
      />
    </QueryClientProvider>
  );
}
