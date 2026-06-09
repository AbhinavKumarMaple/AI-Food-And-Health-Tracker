"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuth } from "@/lib/store";
import type { User } from "@/lib/store/types";

/**
 * Client-side auth gate. Reads the local session after mount (localStorage is
 * unavailable during SSR) and redirects to /login when required.
 */
export function useAuth(redirectIfMissing = true) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u = getAuth().getCurrentUser();
    setUser(u);
    setLoading(false);
    if (!u && redirectIfMissing) {
      router.replace("/login");
    }
  }, [redirectIfMissing, router]);

  return { user, loading };
}
