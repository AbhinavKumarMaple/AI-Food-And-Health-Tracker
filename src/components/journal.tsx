"use client";

import { Utensils, Activity, Droplets, Star, TrendingUp, TrendingDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { dayOfMonth, formatLitres, shortMonth } from "@/lib/format";
import type { DaySummary } from "@/lib/store/types";
import { Card } from "./cards";
import { IconBadge } from "./ui";

/* ---- Stat pill (Stats grid) ---------------------------------------------- */

export function StatPill({
  icon,
  tone = "orange",
  value,
  label,
  delta,
  deltaGood,
}: {
  icon: LucideIcon;
  tone?: "orange" | "danger" | "warm" | "success";
  value: string;
  label: string;
  delta?: string;
  /** Whether this delta is a positive outcome. Defaults to "not a decrease". */
  deltaGood?: boolean;
}) {
  const down = delta?.trim().startsWith("-");
  const good = deltaGood ?? !down;
  return (
    <Card>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <IconBadge icon={icon} tone={tone} size={32} />
          {delta && (
            <span
              className={cn("inline-flex items-center gap-1 text-[10px] font-semibold", good ? "text-success" : "text-danger")}
              style={{ fontFamily: "var(--font-label)" }}
            >
              {down ? <TrendingDown size={11} strokeWidth={2.6} /> : <TrendingUp size={11} strokeWidth={2.6} />}
              {delta}
            </span>
          )}
        </div>
        <span className="text-[28px] font-bold leading-none tracking-tight text-ink" style={{ fontFamily: "var(--font-display)" }}>
          {value}
        </span>
        <span className="text-[11px] font-medium text-muted" style={{ fontFamily: "var(--font-label)" }}>
          {label}
        </span>
      </div>
    </Card>
  );
}

/* ---- History row (a logged day) ------------------------------------------ */

export function HistoryRow({
  summary,
  onClick,
  highlight = false,
}: {
  summary: DaySummary;
  onClick?: () => void;
  highlight?: boolean;
}) {
  return (
    <Card onClick={onClick} className={cn(highlight && "border-primary/40 ring-1 ring-primary/20")}>
      <div className="flex items-center gap-3.5">
        <div className="flex h-[52px] w-[52px] flex-col items-center justify-center rounded-xl bg-warm">
          <span className="text-[9px] font-bold tracking-wide text-primary" style={{ fontFamily: "var(--font-label)" }}>
            {shortMonth(summary.date)}
          </span>
          <span className="text-[20px] font-bold leading-none text-ink" style={{ fontFamily: "var(--font-display)" }}>
            {dayOfMonth(summary.date)}
          </span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-semibold text-ink" style={{ fontFamily: "var(--font-display)" }}>
              {new Date(summary.date).toLocaleDateString([], { weekday: "long" })}
            </span>
            {summary.overallRating != null && (
              <span className="flex items-center gap-1 text-[12px] font-semibold text-ink">
                <Star size={12} className="text-primary" fill="currentColor" />
                {summary.overallRating.toFixed(1)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted" style={{ fontFamily: "var(--font-label)" }}>
            <span className="flex items-center gap-1">
              <Utensils size={12} className="text-faint" /> {summary.mealCount} meals
            </span>
            <span className="flex items-center gap-1">
              <Activity size={12} className="text-faint" /> {summary.symptomCount} symptom
              {summary.symptomCount === 1 ? "" : "s"}
            </span>
            <span className="flex items-center gap-1">
              <Droplets size={12} className="text-faint" /> {formatLitres(summary.totalWaterMl)}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
