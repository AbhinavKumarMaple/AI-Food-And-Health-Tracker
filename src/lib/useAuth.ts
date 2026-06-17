"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/lib/queries";

/**
 * Client-side auth gate, backed by a cached React Query so the session is fetched
 * once and reused across navigation (no repeated /api/auth/me). Redirects to
 * /login only when the session is genuinely absent.
 *
 * The persisted cache is restored SYNCHRONOUSLY (before paint, in Providers), so
 * a returning user's session is already in cache on first render — no skeleton,
 * no premature bounce to /login. `isPending` is true only while there is no data
 * yet (the very first `/api/auth/me` fetch), so we never redirect mid-fetch.
 */
export function useAuth(redirectIfMissing = true) {
  const router = useRouter();
  const { data, isPending } = useCurrentUser();
  const user = data ?? null;

  useEffect(() => {
    if (!isPending && !user && redirectIfMissing) {
      router.replace("/login");
    }
  }, [isPending, user, redirectIfMissing, router]);

  return { user, loading: isPending };
}
