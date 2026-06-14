"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mic, Utensils, Droplets, Star, ChevronRight, Sparkles, Bell, Info, Droplet } from "lucide-react";
import { todayISODate } from "@/lib/store/util";
import { useAuth } from "@/lib/useAuth";
import { useDay, useSettings, useCycleLogs, useQueryClient, invalidateEntries } from "@/lib/queries";
import { buildPhaseResolver } from "@/lib/cycle/engine";
import { PHASE_META, predictionLine } from "@/lib/cycle/present";
import { seedDemoData } from "@/lib/seed";
import { formatLitres } from "@/lib/format";
import { Screen } from "@/components/Screen";
import { GradientPanel } from "@/components/GradientPanel";
import { SectionHeader } from "@/components/ui";
import { StatPill } from "@/components/journal";
import { ActivityRow, type ActivityItem } from "@/components/cards";
import { SayGuideSheet } from "@/components/SayGuideSheet";
import { RefreshButton } from "@/components/RefreshButton";
import { TodaySkeleton, Skeleton, StatPillSkeleton, RowsSkeleton } from "@/components/skeletons";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function TodayPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, loading } = useAuth();
  const today = todayISODate();
  const dayQ = useDay(today, !!user);
  const settingsQ = useSettings(!!user);
  const cycleEnabled = settingsQ.data?.cycleTrackingEnabled ?? false;
  const cycleQ = useCycleLogs(!!user && cycleEnabled);
  const [showGuide, setShowGuide] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const day = dayQ.data;
  const settings = settingsQ.data;

  const cycleStatus = useMemo(() => {
    if (!cycleEnabled || !cycleQ.data) return null;
    const r = buildPhaseResolver(cycleQ.data, {
      today,
      avgPrior: settingsQ.data?.cycleAvgLengthDays ?? 28,
    });
    return { phase: r.phaseOf(today), prediction: r.prediction };
  }, [cycleEnabled, cycleQ.data, today, settingsQ.data?.cycleAvgLengthDays]);

  const activities = useMemo<ActivityItem[]>(() => {
    if (!day) return [];
    const items: ActivityItem[] = [
      ...day.meals.map((data) => ({ kind: "meal" as const, data })),
      ...day.symptoms.map((data) => ({ kind: "symptom" as const, data })),
      ...day.moods.map((data) => ({ kind: "mood" as const, data })),
      ...day.hydration.map((data) => ({ kind: "hydration" as const, data })),
    ];
    return items.sort(
      (a, b) => new Date(b.data.occurredAt).getTime() - new Date(a.data.occurredAt).getTime(),
    );
  }, [day]);

  async function loadSample() {
    setSeeding(true);
    await seedDemoData();
    invalidateEntries(queryClient);
    setSeeding(false);
  }

  // Only a true first load (session not yet known) shows the full skeleton.
  if (loading || !user) {
    return (
      <Screen>
        <TodaySkeleton />
      </Screen>
    );
  }

  const dateLabel = new Date()
    .toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })
    .toUpperCase();
  const moodAvg = day?.summary?.moodAvg;
  const waterMl = day?.summary?.totalWaterMl ?? 0;

  return (
    <Screen>
      {/* Header — static, renders immediately */}
      <GradientPanel variant="amber" rounded="rounded-b-[2rem]" className="px-6 pb-16 pt-5">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold tracking-[0.12em] text-white/80" style={{ fontFamily: "var(--font-label)" }}>
            {dateLabel}
          </p>
          <div className="flex items-center gap-2">
            <RefreshButton
              light
              loading={dayQ.isFetching}
              onRefresh={() => Promise.all([dayQ.refetch(), settingsQ.refetch()])}
            />
            <Bell size={18} className="text-white/85" />
          </div>
        </div>
        <p className="mt-3 text-[15px] text-white/85">{greeting()},</p>
        <h1 className="text-[34px] font-extrabold leading-tight text-white" style={{ fontFamily: "var(--font-display)" }}>
          {user.name?.split(" ")[0] || "there"}.
        </h1>
        {day ? (
          <p className="mt-1 text-[13px] text-white/80">
            You&apos;ve logged <span className="font-semibold text-white">{day.meals.length} meals</span> and{" "}
            <span className="font-semibold text-white">{day.symptoms.length} symptoms</span> so far
          </p>
        ) : (
          <Skeleton className="mt-2 h-3 w-52 bg-white/25" />
        )}
      </GradientPanel>

      <div className="flex flex-col gap-5 px-5 pb-8">
        {/* Tap to talk — static */}
        <Link
          href="/record"
          className="relative z-10 -mt-10 flex items-center gap-4 rounded-3xl border border-line bg-surface p-4 shadow-[0_8px_24px_rgba(124,52,15,0.18)]"
        >
          <div className="flex flex-1 flex-col gap-1">
            <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-wide text-success" style={{ fontFamily: "var(--font-label)" }}>
              <span className="h-1.5 w-1.5 rounded-full bg-success" /> READY
            </span>
            <span className="text-[19px] font-bold text-ink" style={{ fontFamily: "var(--font-display)" }}>
              Tap to talk
            </span>
            <span className="text-[12px] text-muted">Describe your meals, symptoms &amp; mood</span>
          </div>
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg">
            <Mic size={24} />
          </span>
        </Link>

        <button
          onClick={() => setShowGuide(true)}
          className="-mt-1 flex items-center gap-1.5 self-center rounded-full px-3 py-1 text-[12.5px] font-medium text-muted"
        >
          <Info size={14} className="text-primary" /> What can I say?
        </button>

        {settings && !settings.geminiApiKey && (
          <Link href="/settings" className="flex items-center gap-2 rounded-2xl bg-primary-tint px-4 py-3 text-[12px] font-medium text-primary-press">
            <Sparkles size={15} /> Add your Gemini API key in Settings to enable voice logging
            <ChevronRight size={15} className="ml-auto" />
          </Link>
        )}

        {/* Cycle (only when the optional module is on) */}
        {cycleEnabled && cycleStatus && (
          <Link
            href="/cycle"
            className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-tint text-primary">
              <Droplet size={18} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-[13px] font-bold text-ink" style={{ fontFamily: "var(--font-display)" }}>
                {cycleStatus.phase.phase !== "unknown"
                  ? `${PHASE_META[cycleStatus.phase.phase].label} phase${cycleStatus.phase.cycleDay ? ` · day ${cycleStatus.phase.cycleDay}` : ""}`
                  : "Cycle tracker"}
              </span>
              <span className="truncate text-[12px] text-muted">{predictionLine(cycleStatus.prediction)}</span>
            </div>
            <ChevronRight size={18} className="text-faint" />
          </Link>
        )}

        {/* Snapshot */}
        <section className="flex flex-col gap-3">
          <SectionHeader
            title="Today's snapshot"
            action={
              <Link href="/stats" className="flex items-center gap-0.5 text-[12px] font-semibold text-primary-press">
                View all <ChevronRight size={14} />
              </Link>
            }
          />
          {day ? (
            <div className="grid grid-cols-3 gap-3">
              <StatPill icon={Utensils} value={String(day.meals.length)} label="Meals" />
              <StatPill icon={Droplets} tone="warm" value={formatLitres(waterMl)} label="Water" />
              <StatPill icon={Star} tone="success" value={moodAvg ? moodAvg.toFixed(1) : "—"} label="Mood" />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <StatPillSkeleton />
              <StatPillSkeleton />
              <StatPillSkeleton />
            </div>
          )}
        </section>

        {/* Recent activity */}
        <section className="flex flex-col gap-3">
          <SectionHeader title="Recent activity" />
          {!day ? (
            <RowsSkeleton count={3} />
          ) : activities.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line bg-surface/60 px-6 py-10 text-center">
              <p className="text-[13px] text-muted">No entries yet today.</p>
              <button
                onClick={loadSample}
                disabled={seeding}
                className="rounded-full bg-primary px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
              >
                {seeding ? "Loading…" : "Load sample data"}
              </button>
              <Link href="/record" className="text-[13px] font-semibold text-primary-press">
                or record your first log →
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {activities.map((item) => (
                <ActivityRow
                  key={`${item.kind}-${item.data.id}`}
                  item={item}
                  onClick={() => router.push(`/day/${today}`)}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <SayGuideSheet open={showGuide} onClose={() => setShowGuide(false)} />
    </Screen>
  );
}
