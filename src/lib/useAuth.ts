"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/lib/queries";

/**
 * Client-side auth gate, backed by a cached React Query so the session is fetched
 * once and reused across navigation (no repeated /api/auth/me). Redirects to
 * /login when there is no session.
 */
export function useAuth(redirectIfMissing = true) {
  const router = useRouter();
  const { data, isLoading } = useCurrentUser();
  const user = data ?? null;

  useEffect(() => {
    if (!isLoading && !user && redirectIfMissing) {
      router.replace("/login");
    }
  }, [isLoading, user, redirectIfMissing, router]);

  return { user, loading: isLoading };
}
