"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/lib/queries";

/**
 * Client-side auth gate, backed by a cached React Query so the session is fetched
 * once and reused across navigation (no repeated /api/auth/me). Redirects to
 * /login only when the session is genuinely absent.
 *
 * The persisted cache (including the last verified user) is restored
 * SYNCHRONOUSLY before paint in Providers, so a returning user renders signed-in
 * immediately while `/api/auth/me` revalidates in the background.
 */
export function useAuth(redirectIfMissing = true) {
  const router = useRouter();
  const { data, status, isPending, isFetching } = useCurrentUser();
  const user = data ?? null;

  useEffect(() => {
    // Only bounce to /login when the server definitively said "signed out" (a
    // successful check returning null). A failed check (offline, 5xx) keeps the
    // cached identity instead of logging a valid session out.
    if (status === "success" && !isFetching && !user && redirectIfMissing) {
      router.replace("/login");
    }
  }, [status, isFetching, user, redirectIfMissing, router]);

  return { user, loading: isPending };
}
