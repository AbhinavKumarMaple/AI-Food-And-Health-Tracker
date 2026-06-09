"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuth } from "@/lib/store";
import type { User } from "@/lib/store/types";

/**
 * Client-side auth gate. Fetches the current session from the server after mount
 * and redirects to /login when required.
 */
export function useAuth(redirectIfMissing = true) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getAuth()
      .getCurrentUser()
      .then((u) => {
        if (!active) return;
        setUser(u);
        setLoading(false);
        if (!u && redirectIfMissing) router.replace("/login");
      })
      .catch(() => {
        if (!active) return;
        setLoading(false);
        if (redirectIfMissing) router.replace("/login");
      });
    return () => {
      active = false;
    };
  }, [redirectIfMissing, router]);

  return { user, loading };
}
