"use client";

import { useEffect, useState } from "react";
import { Signal, Wifi, BatteryFull } from "lucide-react";
import { cn } from "@/lib/cn";

/** Faux device status bar to match the mobile design chrome. */
export function StatusBar({ dark = false }: { dark?: boolean }) {
  const [time, setTime] = useState("");

  useEffect(() => {
    const update = () =>
      setTime(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
      );
    update();
    const id = setInterval(update, 10_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      className={cn(
        "flex items-center justify-between px-6 pt-3 pb-1 text-[13px] font-semibold select-none",
        dark ? "text-white" : "text-ink",
      )}
      style={{ fontFamily: "var(--font-label)" }}
    >
      <span suppressHydrationWarning>{time || " "}</span>
      <span className="flex items-center gap-1.5">
        <Signal size={15} strokeWidth={2.5} />
        <Wifi size={15} strokeWidth={2.5} />
        <BatteryFull size={17} strokeWidth={2.2} />
      </span>
    </div>
  );
}
