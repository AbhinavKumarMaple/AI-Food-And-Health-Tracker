"use client";

import { useCallback, useEffect, useState } from "react";
import { Utensils, Droplets, Activity, Flame, Sparkles } from "lucide-react";
import { getStore } from "@/lib/store";
import { useAuth } from "@/lib/useAuth";
import { computeStats, type Stats } from "@/lib/patterns/stats";
import {
  computeCorrelations,
  correlationsToInsights,
  type InsightEvidence,
  type EvidenceTier,
} from "@/lib/patterns/correlate";
import type { Insight } from "@/lib/store/types";
import { Screen } from "@/components/Screen";
import { PageHeader } from "@/components/PageHeader";
import { RefreshButton } from "@/components/RefreshButton";
import { StatsSkeleton } from "@/components/skeletons";
import { GradientPanel } from "@/components/GradientPanel";
import { Card } from "@/components/cards";
import { StatPill } from "@/components/journal";
import { IconBadge } from "@/components/ui";

type Insightish = Omit<Insight, "id" | "userId" | "createdAt" | "updatedAt">;

function signed(n: number, suffix = ""): string {
  return `${n > 0 ? "+" : ""}${n}${suffix}`;
}

export default function StatsPage() {
  const { user, loading } = useAuth();
  const [range, setRange] = useState(30);
  const [stats, setStats] = useState<Stats | null>(null);
  const [insights, setInsights] = useState<Insightish[]>([]);

  const load = useCallback(async () => {
    const store = getStore();
    const data = await store.getCorrelationDataset();
    setStats(computeStats(data, range));
    const correlations = computeCorrelations(data);
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - range);
    const ins = correlationsToInsights(correlations, {
      start: start.toISOString(),
      end: end.toISOString(),
    });
    setInsights(ins);
    store.replaceInsights(ins);
  }, [range]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  if (loading || !user || !stats) {
    return (
      <Screen>
        <StatsSkeleton />
      </Screen>
    );
  }

  const maxBar = 5;

  return (
    <Screen>
      <PageHeader
        title="Stats"
        eyebrow="Insights"
        back={false}
        right={
          <div className="flex items-center gap-2">
            <RefreshButton onRefresh={load} />
            <select
              value={range}
              onChange={(e) => setRange(Number(e.target.value))}
              className="rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] font-semibold text-ink outline-none"
            >
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </select>
          </div>
        }
      />

      <div className="flex flex-col gap-5 px-5 pb-8 pt-2">
        {/* Mood hero */}
        <GradientPanel variant="orange" className="p-5">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/80" style={{ fontFamily: "var(--font-label)" }}>
            Average mood
          </span>
          <div className="mt-1 flex items-end justify-between">
            <div className="flex items-baseline gap-1">
              <span className="text-[46px] font-extrabold leading-none text-white" style={{ fontFamily: "var(--font-display)" }}>
                {stats.avgMood?.toFixed(1) ?? "—"}
              </span>
              <span className="text-[16px] font-semibold text-white/80">/ {maxBar}</span>
            </div>
            {stats.moodDelta != null && (
              <span className="rounded-full bg-white/20 px-2.5 py-1 text-[12px] font-bold text-white">
                {signed(stats.moodDelta)}
              </span>
            )}
          </div>
          <div className="mt-4 flex h-20 items-end gap-[3px]">
            {stats.moodSeries.map((d, i) => (
              <div
                key={i}
                className="flex-1 rounded-sm bg-white"
                style={{ height: d.value ? `${(d.value / maxBar) * 100}%` : "8%", opacity: d.value ? 0.9 : 0.3 }}
              />
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-[10px] text-white/70" style={{ fontFamily: "var(--font-label)" }}>
            <span>{stats.moodSeries[0]?.date.slice(5)}</span>
            <span>{stats.moodSeries[stats.moodSeries.length - 1]?.date.slice(5)}</span>
          </div>
        </GradientPanel>

        {/* Stat grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatPill icon={Utensils} value={stats.mealsPerDay.toFixed(1)} label="Meals / day" delta={stats.mealsDelta != null ? signed(stats.mealsDelta) : undefined} />
          <StatPill icon={Droplets} tone="warm" value={`${stats.hydrationPerDayL.toFixed(1)}L`} label="Hydration" delta={stats.hydrationDeltaL != null ? signed(stats.hydrationDeltaL, "L") : undefined} />
          <StatPill icon={Activity} tone="danger" value={String(stats.symptomCount)} label="Symptoms" delta={stats.symptomDelta != null ? signed(stats.symptomDelta) : undefined} deltaGood={(stats.symptomDelta ?? 0) <= 0} />
          <StatPill icon={Flame} tone="success" value={String(stats.dayStreak)} label="Day streak" />
        </div>

        {/* Patterns */}
        <section className="flex flex-col gap-2.5">
          <h2 className="flex items-center gap-2 px-1 text-[15px] font-bold text-ink" style={{ fontFamily: "var(--font-display)" }}>
            <Sparkles size={16} className="text-primary" /> Patterns detected
          </h2>
          {insights.length === 0 ? (
            <Card>
              <p className="text-[13px] text-muted">
                Keep logging meals and how you feel — once a food shows up enough times, Avni will
                surface likely triggers here, with the statistical strength behind each one.
              </p>
            </Card>
          ) : (
            insights.map((ins, i) => {
              const ev = ins.evidence as InsightEvidence | undefined;
              return (
                <Card key={i}>
                  <div className="flex items-start gap-3">
                    <IconBadge icon={Sparkles} tone="orange" size={36} />
                    <div className="flex flex-1 flex-col gap-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[15px] font-semibold capitalize text-ink" style={{ fontFamily: "var(--font-display)" }}>
                          {ins.title}
                        </span>
                        {ev && <TierBadge tier={ev.tier} />}
                      </div>
                      <p className="text-[13px] leading-snug text-muted">{ins.description}</p>
                      {ev && (
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-faint" style={{ fontFamily: "var(--font-label)" }}>
                          <span>{ev.lift >= 99 ? "≫ usual" : `${ev.lift.toFixed(1)}× lift`}</span>
                          <span>{ev.hits}/{ev.exposures} times</span>
                          <span>{ev.windowHours}h window</span>
                          <span>p {ev.qValue < 0.001 ? "<0.001" : ev.qValue.toFixed(3)}</span>
                        </div>
                      )}
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-line">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((ins.strength ?? 0) * 100)}%` }} />
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </section>
      </div>
    </Screen>
  );
}

function TierBadge({ tier }: { tier: EvidenceTier }) {
  const map = {
    strong: { label: "Strong", cls: "bg-success-tint text-success" },
    likely: { label: "Likely", cls: "bg-primary-tint text-primary-press" },
    emerging: { label: "Emerging", cls: "bg-warm text-muted" },
  } as const;
  const t = map[tier];
  return (
    <span
      className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${t.cls}`}
      style={{ fontFamily: "var(--font-label)" }}
    >
      {t.label}
    </span>
  );
}
