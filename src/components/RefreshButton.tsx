"use client";

import { useState } from "react";
import { RotateCw } from "lucide-react";
import { cn } from "@/lib/cn";

/** Manual data refresh. Spins only while the user-initiated refresh is in flight
 * — background (stale-while-revalidate) refetches stay silent so the UI doesn't
 * change while data updates underneath. `loading` can force the spinner if needed. */
export function RefreshButton({
  onRefresh,
  loading = false,
  light = false,
  className,
}: {
  onRefresh: () => Promise<unknown> | void;
  loading?: boolean;
  light?: boolean;
  className?: string;
}) {
  const [spinning, setSpinning] = useState(false);
  const isSpinning = spinning || loading;

  async function handle() {
    if (spinning) return;
    setSpinning(true);
    try {
      await onRefresh();
    } finally {
      setSpinning(false);
    }
  }

  return (
    <button
      onClick={handle}
      aria-label="Refresh"
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full border transition active:scale-95",
        light ? "border-white/30 text-white" : "border-line bg-surface text-muted",
        className,
      )}
    >
      <RotateCw size={16} className={isSpinning ? "animate-spin" : ""} />
    </button>
  );
}
