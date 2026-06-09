"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, MoreHorizontal, Utensils, Activity, Droplets, CheckCircle2 } from "lucide-react";
import { getStore } from "@/lib/store";
import { useAuth } from "@/lib/useAuth";
import type { DayDetail } from "@/lib/store/types";
import { formatLitres, formatTime, moodLabel } from "@/lib/format";
import { Screen } from "@/components/Screen";
import { Card, ActivityRow, type ActivityItem } from "@/components/cards";
import { Chip, Stars } from "@/components/ui";

function dayTitle(rating: number | null | undefined): string {
  if (rating == null) return "Your day";
  if (rating >= 4.5) return "A great day";
  if (rating >= 3.5) return "Solid day overall";
  if (rating >= 2.5) return "An okay day";
  return "A rough day";
}

export default function DayDetailPage() {
  const router = useRouter();
  const { date } = useParams<{ date: string }>();
  const { user, loading } = useAuth();
  const [day, setDay] = useState<DayDetail | null>(null);

  const refresh = useCallback(async () => {
    setDay(await getStore().getDay(date));
  }, [date]);

  useEffect(() => {
    if (user) refresh();
  }, [user, refresh]);

  const timeline = useMemo<ActivityItem[]>(() => {
    if (!day) return [];
    const items: ActivityItem[] = [
      ...day.meals.map((data) => ({ kind: "meal" as const, data })),
      ...day.symptoms.map((data) => ({ kind: "symptom" as const, data })),
      ...day.moods.map((data) => ({ kind: "mood" as const, data })),
      ...day.hydration.map((data) => ({ kind: "hydration" as const, data })),
    ];
    return items.sort((a, b) => new Date(a.data.occurredAt).getTime() - new Date(b.data.occurredAt).getTime());
  }, [day]);

  async function setRating(rating: number) {
    await getStore().recordDayRating(date, rating);
    refresh();
  }

  if (loading || !user || !day) {
    return <Screen><div className="p-6 text-sm text-muted">Loading…</div></Screen>;
  }

  const summary = day.summary;
  const dateObj = new Date(`${date}T12:00:00`);
  const waterMl = day.hydration.reduce((a, h) => a + h.amountMl, 0);
  const ratingSamples = summary?.ratingSamples ?? [];
  const lastSampleRating = ratingSamples.length
    ? ratingSamples[ratingSamples.length - 1].rating
    : (summary?.overallRating ?? 0);
  const twa = summary?.overallRating ?? null;

  return (
    <Screen>
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3">
        <button onClick={() => router.back()} className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface">
          <ChevronLeft size={20} />
        </button>
        <div className="flex flex-col items-center">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary" style={{ fontFamily: "var(--font-label)" }}>
            {dateObj.toLocaleDateString([], { weekday: "long" })}
          </span>
          <span className="text-[13px] font-semibold text-ink">
            {dateObj.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
          </span>
        </div>
        <button className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-muted">
          <MoreHorizontal size={18} />
        </button>
      </div>

      <div className="flex flex-col gap-5 px-5 pb-8 pt-1">
        <div>
          <h1 className="text-[28px] font-extrabold text-ink" style={{ fontFamily: "var(--font-display)" }}>
            {summary?.aiSummary || dayTitle(summary?.overallRating)}
          </h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <Chip><span className="inline-flex items-center gap-1"><Utensils size={11} /> {day.meals.length} meals</span></Chip>
            <Chip tone="danger"><span className="inline-flex items-center gap-1"><Activity size={11} /> {day.symptoms.length} symptom{day.symptoms.length === 1 ? "" : "s"}</span></Chip>
            <Chip><span className="inline-flex items-center gap-1"><Droplets size={11} /> {formatLitres(waterMl)}</span></Chip>
          </div>
        </div>

        {/* Day rating */}
        <Card>
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wide text-primary" style={{ fontFamily: "var(--font-label)" }}>
                Day rating
              </span>
              <span className="text-[16px] font-bold text-ink" style={{ fontFamily: "var(--font-display)" }}>How you felt</span>
            </div>
            {ratingSamples.length > 1 ? (
              <span className="rounded-md bg-warm px-2 py-1 text-[10px] font-bold text-muted">
                {ratingSamples.length} check-ins
              </span>
            ) : summary?.isClosed ? (
              <span className="flex items-center gap-1 rounded-md bg-warm px-2 py-1 text-[10px] font-bold text-muted">
                <CheckCircle2 size={11} /> Day closed
              </span>
            ) : null}
          </div>
          <div className="mt-3 flex items-center justify-between">
            <Stars value={lastSampleRating} size={32} onChange={setRating} />
          </div>
          {twa != null ? (
            <p className="mt-2 text-[13px] text-muted">
              <span className="font-semibold text-ink">{twa.toFixed(1)} / 5</span> ·{" "}
              {summary?.ratingLabel || moodLabel(Math.round(twa))}
              {ratingSamples.length > 1 && <span className="text-faint"> · weighted across your day</span>}
              {summary?.ratingCapturedAt && (
                <span className="text-faint"> · updated {formatTime(summary.ratingCapturedAt)}</span>
              )}
            </p>
          ) : (
            <p className="mt-2 text-[13px] text-muted">Tap the stars to rate your day</p>
          )}
        </Card>

        {/* Timeline */}
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-[16px] font-bold text-ink" style={{ fontFamily: "var(--font-display)" }}>Day timeline</h2>
            <span className="text-[11px] font-semibold text-faint" style={{ fontFamily: "var(--font-label)" }}>By time</span>
          </div>
          {timeline.length === 0 ? (
            <p className="px-1 text-[13px] text-muted">No entries for this day.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {timeline.map((item) => (
                <ActivityRow key={`${item.kind}-${item.data.id}`} item={item} />
              ))}
            </div>
          )}
        </section>
      </div>
    </Screen>
  );
}
