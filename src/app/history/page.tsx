"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Star } from "lucide-react";
import { getStore } from "@/lib/store";
import { useAuth } from "@/lib/useAuth";
import type { DaySummary } from "@/lib/store/types";
import { toISODate } from "@/lib/store/util";
import { formatLitres } from "@/lib/format";
import { Screen } from "@/components/Screen";
import { PageHeader } from "@/components/PageHeader";
import { GradientPanel } from "@/components/GradientPanel";
import { SectionHeader } from "@/components/ui";
import { HistoryRow } from "@/components/journal";
import { cn } from "@/lib/cn";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export default function HistoryPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [summaries, setSummaries] = useState<DaySummary[]>([]);

  useEffect(() => {
    if (user) getStore().listDaySummaries().then(setSummaries);
  }, [user]);

  const today = toISODate(new Date());

  const week = useMemo(() => {
    const out: { date: string; logged: boolean }[] = [];
    const base = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(base);
      d.setDate(base.getDate() - i);
      const iso = toISODate(d);
      out.push({ date: iso, logged: summaries.some((s) => s.date === iso) });
    }
    return out;
  }, [summaries]);

  const month = useMemo(() => {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const inMonth = summaries.filter((s) => s.date.startsWith(monthKey));
    const ratings = inMonth.map((s) => s.overallRating).filter((r): r is number => r != null);
    return {
      label: now.toLocaleDateString([], { month: "long", year: "numeric" }).toUpperCase(),
      daysLogged: inMonth.length,
      avgRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
      meals: inMonth.reduce((a, s) => a + s.mealCount, 0),
      symptoms: inMonth.reduce((a, s) => a + s.symptomCount, 0),
    };
  }, [summaries]);

  if (loading || !user) {
    return <Screen><div className="p-6 text-sm text-muted">Loading…</div></Screen>;
  }

  return (
    <Screen>
      <PageHeader
        title="History"
        eyebrow="Your journal"
        back={false}
        right={
          <button className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-muted">
            <Search size={17} />
          </button>
        }
      />

      <div className="flex flex-col gap-5 px-5 pb-8 pt-2">
        {/* Month hero */}
        <GradientPanel variant="dark" className="p-5">
          <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/70" style={{ fontFamily: "var(--font-label)" }}>
            {month.label}
          </span>
          <h2 className="mt-1 text-[26px] font-extrabold text-white" style={{ fontFamily: "var(--font-display)" }}>
            {month.daysLogged} days logged
          </h2>
          <div className="mt-4 flex gap-6">
            <HeroStat value={month.avgRating ? month.avgRating.toFixed(1) : "—"} label="avg mood" />
            <HeroStat value={String(month.meals)} label="meals" />
            <HeroStat value={String(month.symptoms)} label="symptoms" />
          </div>
        </GradientPanel>

        {/* This week */}
        <section className="flex flex-col gap-3">
          <SectionHeader title="This week" />
          <div className="flex justify-between">
            {week.map((d) => {
              const isToday = d.date === today;
              const dow = new Date(d.date).getDay();
              return (
                <button
                  key={d.date}
                  onClick={() => router.push(`/day/${d.date}`)}
                  className="flex flex-col items-center gap-1.5"
                >
                  <span className="text-[11px] font-semibold text-faint" style={{ fontFamily: "var(--font-label)" }}>
                    {WEEKDAYS[dow]}
                  </span>
                  <span
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-xl text-[14px] font-bold",
                      isToday ? "bg-primary text-white" : d.logged ? "bg-warm text-ink" : "bg-surface text-faint border border-line",
                    )}
                  >
                    {new Date(d.date).getDate()}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Recent entries */}
        <section className="flex flex-col gap-3">
          <SectionHeader title="Recent entries" />
          {summaries.length === 0 ? (
            <p className="px-1 text-[13px] text-muted">No days logged yet.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {summaries.map((s) => (
                <HistoryRow
                  key={s.id}
                  summary={s}
                  highlight={s.date === today}
                  onClick={() => router.push(`/day/${s.date}`)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </Screen>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="flex items-center gap-1 text-[20px] font-extrabold text-white" style={{ fontFamily: "var(--font-display)" }}>
        {label === "avg mood" && <Star size={14} className="text-primary" fill="currentColor" />}
        {value}
      </span>
      <span className="text-[11px] text-white/60" style={{ fontFamily: "var(--font-label)" }}>{label}</span>
    </div>
  );
}
