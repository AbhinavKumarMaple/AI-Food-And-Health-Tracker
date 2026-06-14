"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useIsRestoring } from "@tanstack/react-query";
import { useCurrentUser } from "@/lib/queries";

/**
 * Client-side auth gate, backed by a cached React Query so the session is fetched
 * once and reused across navigation (no repeated /api/auth/me). Redirects to
 * /login when there is no session.
 *
 * IMPORTANT: redirect only once the session is actually KNOWN. On a hard reload
 * the persisted (localStorage) query cache restores asynchronously; during that
 * window React Query pauses queries, so `isLoading` is false while there's still
 * no data (in v5 `isLoading = isPending && isFetching`). Gating on `isLoading`
 * here would bounce a logged-in user to /login on every refresh. We instead wait
 * for cache restoration AND the query to leave the pending state.
 */
export function useAuth(redirectIfMissing = true) {
  const router = useRouter();
  const isRestoring = useIsRestoring();
  const { data, isPending } = useCurrentUser();
  const user = data ?? null;
  const loading = isRestoring || isPending;

  useEffect(() => {
    if (!loading && !user && redirectIfMissing) {
      router.replace("/login");
    }
  }, [loading, user, redirectIfMissing, router]);

  return { user, loading };
}
