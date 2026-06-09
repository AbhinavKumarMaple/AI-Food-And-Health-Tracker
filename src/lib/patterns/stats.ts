import type { CorrelationDataset } from "@/lib/store/types";
import { toISODate } from "@/lib/store/util";

export type DailyValue = { date: string; value: number | null };

export type Stats = {
  avgMood: number | null;
  moodDelta: number | null;
  moodSeries: DailyValue[];
  mealsPerDay: number;
  mealsDelta: number | null;
  hydrationPerDayL: number;
  hydrationDeltaL: number | null;
  symptomCount: number;
  symptomDelta: number | null;
  dayStreak: number;
};

function lastNDates(days: number): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push(toISODate(d));
  }
  return out;
}

function inWindow(iso: string, startDate: string, endDate: string): boolean {
  const d = toISODate(iso);
  return d >= startDate && d <= endDate;
}

export function computeStats(data: CorrelationDataset, days: number): Stats {
  const dates = lastNDates(days);
  const start = dates[0];
  const end = dates[dates.length - 1];

  // previous window of equal length (for deltas)
  const prevDates = (() => {
    const out: string[] = [];
    const first = new Date(start);
    for (let i = days; i >= 1; i--) {
      const d = new Date(first);
      d.setDate(first.getDate() - i);
      out.push(toISODate(d));
    }
    return out;
  })();
  const prevStart = prevDates[0];
  const prevEnd = prevDates[prevDates.length - 1];

  // mood series + averages
  const moodByDate = new Map<string, number[]>();
  for (const m of data.moods) {
    const d = toISODate(m.occurredAt);
    const arr = moodByDate.get(d) ?? [];
    arr.push(m.rating);
    moodByDate.set(d, arr);
  }
  const moodSeries: DailyValue[] = dates.map((d) => {
    const arr = moodByDate.get(d);
    return { date: d, value: arr && arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null };
  });
  const curMoods = data.moods.filter((m) => inWindow(m.occurredAt, start, end)).map((m) => m.rating);
  const prevMoods = data.moods.filter((m) => inWindow(m.occurredAt, prevStart, prevEnd)).map((m) => m.rating);
  const avgMood = avg(curMoods);
  const avgPrevMood = avg(prevMoods);
  const moodDelta = avgMood != null && avgPrevMood != null ? round1(avgMood - avgPrevMood) : null;

  // meals / day
  const curMeals = data.meals.filter((m) => inWindow(m.occurredAt, start, end)).length;
  const prevMeals = data.meals.filter((m) => inWindow(m.occurredAt, prevStart, prevEnd)).length;
  const mealsPerDay = round1(curMeals / days);
  const mealsDelta = round1(curMeals / days - prevMeals / days);

  // hydration L / day
  const curWater = data.hydration.filter((h) => inWindow(h.occurredAt, start, end)).reduce((a, h) => a + h.amountMl, 0);
  const prevWater = data.hydration.filter((h) => inWindow(h.occurredAt, prevStart, prevEnd)).reduce((a, h) => a + h.amountMl, 0);
  const hydrationPerDayL = round1(curWater / days / 1000);
  const hydrationDeltaL = round1((curWater - prevWater) / days / 1000);

  // symptoms
  const symptomCount = data.symptoms.filter((s) => inWindow(s.occurredAt, start, end)).length;
  const prevSymptoms = data.symptoms.filter((s) => inWindow(s.occurredAt, prevStart, prevEnd)).length;
  const symptomDelta = symptomCount - prevSymptoms;

  // streak: consecutive days (ending today) with at least one entry
  const activeDates = new Set<string>([
    ...data.meals.map((m) => toISODate(m.occurredAt)),
    ...data.symptoms.map((s) => toISODate(s.occurredAt)),
    ...data.moods.map((m) => toISODate(m.occurredAt)),
    ...data.hydration.map((h) => toISODate(h.occurredAt)),
  ]);
  let dayStreak = 0;
  const cursor = new Date();
  // allow streak to count from yesterday if nothing logged today yet
  if (!activeDates.has(toISODate(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (activeDates.has(toISODate(cursor))) {
    dayStreak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return {
    avgMood: avgMood != null ? round1(avgMood) : null,
    moodDelta,
    moodSeries,
    mealsPerDay,
    mealsDelta,
    hydrationPerDayL,
    hydrationDeltaL,
    symptomCount,
    symptomDelta,
    dayStreak,
  };
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
