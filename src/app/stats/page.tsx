"use client";

import { useEffect, useState } from "react";
import { Utensils, Droplets, Activity, Flame, Sparkles } from "lucide-react";
import { getStore } from "@/lib/store";
import { useAuth } from "@/lib/useAuth";
import { computeStats, type Stats } from "@/lib/patterns/stats";
import { computeCorrelations, correlationsToInsights } from "@/lib/patterns/correlate";
import type { Insight } from "@/lib/store/types";
import { Screen } from "@/components/Screen";
import { PageHeader } from "@/components/PageHeader";
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

  useEffect(() => {
    if (!user) return;
    (async () => {
      const store = getStore();
      const data = await store.getCorrelationDataset();
      setStats(computeStats(data, range));
      const correlations = computeCorrelations(data, { lagWindowHours: 6 });
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - range);
      const ins = correlationsToInsights(correlations, {
        start: start.toISOString(),
        end: end.toISOString(),
      });
      setInsights(ins);
      store.replaceInsights(ins);
    })();
  }, [user, range]);

  if (loading || !user || !stats) {
    return <Screen><div className="p-6 text-sm text-muted">Loading…</div></Screen>;
  }

  const maxBar = 5;

  return (
    <Screen>
      <PageHeader
        title="Stats"
        eyebrow="Insights"
        back={false}
        right={
          <select
            value={range}
            onChange={(e) => setRange(Number(e.target.value))}
            className="rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] font-semibold text-ink outline-none"
          >
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </select>
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
                surface likely triggers here.
              </p>
            </Card>
          ) : (
            insights.map((ins, i) => (
              <Card key={i}>
                <div className="flex items-start gap-3">
                  <IconBadge icon={Sparkles} tone="orange" size={36} />
                  <div className="flex flex-1 flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[15px] font-semibold capitalize text-ink" style={{ fontFamily: "var(--font-display)" }}>
                        {ins.title}
                      </span>
                      <span className="rounded bg-primary-tint px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-primary-press">AI</span>
                    </div>
                    <p className="text-[13px] leading-snug text-muted">{ins.description}</p>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-line">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round((ins.strength ?? 0) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              </Card>
            ))
          )}
        </section>
      </div>
    </Screen>
  );
}
