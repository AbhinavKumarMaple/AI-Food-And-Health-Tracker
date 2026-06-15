"use client";

import { Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatTime, moodLabel } from "@/lib/format";
import { mealIcon, symptomIcon, beverageIcon } from "@/lib/icons";
import type { Meal, Symptom, Mood, HydrationLog } from "@/lib/store/types";
import { Chip, CompletenessRing, IconBadge, Stars } from "./ui";

export function Card({
  className,
  children,
  onClick,
}: {
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-2xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
        onClick && "cursor-pointer transition active:scale-[0.99]",
        className,
      )}
    >
      {children}
    </div>
  );
}

function SeverityBars({ severity }: { severity: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={cn("h-1 w-[18px] rounded-full", i <= severity ? "bg-danger" : "bg-line")}
        />
      ))}
    </div>
  );
}

function mealSummary(meal: Meal): string {
  if (meal.description) return meal.description;
  return meal.items.map((i) => i.name).join(" · ");
}

/* ---- Full entry cards (Review / detail) ---------------------------------- */

export function MealCard({
  meal,
  onEdit,
  showCompleteness = false,
}: {
  meal: Meal;
  onEdit?: () => void;
  showCompleteness?: boolean;
}) {
  const Icon = mealIcon(meal.mealType);
  return (
    <Card>
      <div className="flex gap-3.5">
        <IconBadge icon={Icon} tone="orange" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[15px] font-semibold text-ink" style={{ fontFamily: "var(--font-display)" }}>
              {meal.title}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted" style={{ fontFamily: "var(--font-label)" }}>
                {formatTime(meal.occurredAt)}
              </span>
              {showCompleteness && <CompletenessRing value={meal.completenessScore} />}
              {onEdit && (
                <button onClick={onEdit} className="text-primary-press" aria-label="Edit">
                  <Pencil size={14} />
                </button>
              )}
            </div>
          </div>
          <p className="text-[13px] leading-snug text-muted">{mealSummary(meal)}</p>
          {meal.items.some((i) => i.tags.length) && (
            <div className="mt-0.5 flex flex-wrap gap-1.5">
              {Array.from(new Set(meal.items.flatMap((i) => i.tags)))
                .slice(0, 5)
                .map((tag) => (
                  <Chip key={tag} tone={tag.toLowerCase() === "caffeine" ? "orange" : "warm"}>
                    {tag}
                  </Chip>
                ))}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

export function SymptomCard({
  symptom,
  onEdit,
  showCompleteness = false,
}: {
  symptom: Symptom;
  onEdit?: () => void;
  showCompleteness?: boolean;
}) {
  const Icon = symptomIcon(symptom.symptomType);
  return (
    <Card>
      <div className="flex gap-3.5">
        <IconBadge icon={Icon} tone="danger" />
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[15px] font-semibold text-ink" style={{ fontFamily: "var(--font-display)" }}>
              {symptom.title}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted" style={{ fontFamily: "var(--font-label)" }}>
                {formatTime(symptom.occurredAt)}
              </span>
              {showCompleteness && <CompletenessRing value={symptom.completenessScore} />}
              {onEdit && (
                <button onClick={onEdit} className="text-primary-press" aria-label="Edit">
                  <Pencil size={14} />
                </button>
              )}
            </div>
          </div>
          {symptom.description && (
            <p className="text-[13px] leading-snug text-muted">{symptom.description}</p>
          )}
          <div className="mt-1 flex items-center gap-3">
            <SeverityBars severity={symptom.severity} />
            {symptom.durationMinutes ? (
              <span className="text-[11px] text-faint" style={{ fontFamily: "var(--font-label)" }}>
                {symptom.durationMinutes} min
              </span>
            ) : null}
            {symptom.triggers.length > 0 && (
              <Chip tone="orange">
                ↳ {symptom.triggers[0].suspectedFoodText ?? "suspected trigger"}
              </Chip>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

export function MoodCard({
  mood,
  onEdit,
}: {
  mood: Mood;
  onEdit?: () => void;
}) {
  return (
    <Card>
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[15px] font-semibold text-ink" style={{ fontFamily: "var(--font-display)" }}>
              How you felt
            </span>
            <span className="text-[11px] text-faint" style={{ fontFamily: "var(--font-label)" }}>
              {formatTime(mood.occurredAt)}
            </span>
          </div>
          {onEdit && (
            <button onClick={onEdit} className="flex items-center gap-1 rounded-md bg-primary-tint px-2 py-1 text-[9px] font-bold tracking-wide text-primary-press">
              <Pencil size={10} /> EDIT
            </button>
          )}
        </div>
        <div className="flex items-center justify-between">
          <Stars value={mood.rating} size={32} />
        </div>
        <div className="flex items-center justify-between text-[11px] text-faint" style={{ fontFamily: "var(--font-label)" }}>
          <span>Rough</span>
          <span className="text-[13px] font-semibold text-ink">
            {mood.rating} / 5 · {mood.label || moodLabel(mood.rating)}
          </span>
          <span>Amazing</span>
        </div>
      </div>
    </Card>
  );
}

/* ---- Compact activity row (Today feed / Day timeline) -------------------- */

type ActivityItem =
  | { kind: "meal"; data: Meal }
  | { kind: "symptom"; data: Symptom }
  | { kind: "mood"; data: Mood }
  | { kind: "hydration"; data: HydrationLog };

export function ActivityRow({
  item,
  onClick,
  onDelete,
}: {
  item: ActivityItem;
  onClick?: () => void;
  onDelete?: () => void;
}) {
  let Icon, tone: "orange" | "danger" | "warm", title: string, subtitle: string, time: string;
  if (item.kind === "meal") {
    Icon = mealIcon(item.data.mealType);
    tone = "orange";
    title = item.data.title;
    subtitle = mealSummary(item.data);
    time = formatTime(item.data.occurredAt);
  } else if (item.kind === "symptom") {
    Icon = symptomIcon(item.data.symptomType);
    tone = "danger";
    title = item.data.title;
    subtitle = item.data.description ?? `Severity ${item.data.severity}/5`;
    time = formatTime(item.data.occurredAt);
  } else if (item.kind === "hydration") {
    Icon = beverageIcon(item.data.beverageType);
    tone = "warm";
    title = item.data.beverageType.charAt(0).toUpperCase() + item.data.beverageType.slice(1);
    subtitle = `${item.data.amountMl} ml`;
    time = formatTime(item.data.occurredAt);
  } else {
    Icon = mealIcon("drink");
    tone = "warm";
    title = "Mood";
    subtitle = `${item.data.rating}/5 · ${item.data.label || moodLabel(item.data.rating)}`;
    time = formatTime(item.data.occurredAt);
  }

  return (
    <Card onClick={onClick}>
      <div className="flex items-center gap-3">
        <IconBadge icon={Icon} tone={tone} size={36} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[14px] font-semibold text-ink" style={{ fontFamily: "var(--font-display)" }}>
            {title}
          </span>
          <span className="truncate text-[12px] text-muted">{subtitle}</span>
        </div>
        <span className="shrink-0 text-[11px] font-medium text-faint" style={{ fontFamily: "var(--font-label)" }}>
          {time}
        </span>
        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            aria-label="Delete entry"
            className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-faint transition active:scale-95 hover:bg-danger-tint hover:text-danger"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </Card>
  );
}

export type { ActivityItem };
