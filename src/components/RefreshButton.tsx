"use client";

import { useState } from "react";
import { RotateCw } from "lucide-react";
import { cn } from "@/lib/cn";

/** Manual data refresh. Spins while the provided loader runs. */
export function RefreshButton({
  onRefresh,
  light = false,
  className,
}: {
  onRefresh: () => Promise<unknown> | void;
  light?: boolean;
  className?: string;
}) {
  const [spinning, setSpinning] = useState(false);

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
      <RotateCw size={16} className={spinning ? "animate-spin" : ""} />
    </button>
  );
}
