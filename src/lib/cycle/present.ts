// Plain-language presentation helpers for cycle data (shared by the Today card
// and the Cycle screen). Keeps copy honest and non-clinical.

import type { CyclePhase } from "@/lib/store/types";
import type { CyclePrediction, PredictionConfidence } from "./engine";

export const PHASE_META: Record<CyclePhase, { label: string; tip: string }> = {
  menstrual: { label: "Menstrual", tip: "Your period" },
  follicular: { label: "Follicular", tip: "Building toward ovulation" },
  ovulatory: { label: "Ovulation", tip: "Around your fertile window" },
  luteal: { label: "Luteal", tip: "The premenstrual stretch" },
  unknown: { label: "Not tracked yet", tip: "Log a period to start" },
};

/** One-line "next period" summary, honest about overdue/uncertainty. */
export function predictionLine(p: CyclePrediction | null): string {
  if (!p) return "Log the day your period starts to begin predictions.";
  if (p.daysUntil < -1) return `Your period is about ${Math.abs(p.daysUntil)} days past its usual window.`;
  if (p.daysUntil <= 0) return "Your period is expected around today.";
  if (p.daysUntil === 1) return "Your period is likely tomorrow.";
  return `Your period is likely in about ${p.daysUntil} days.`;
}

export function confidenceNote(c: PredictionConfidence): string {
  if (c === "low") return "Early estimate — a few more cycles will sharpen this.";
  if (c === "medium") return "Based on your recent cycles.";
  return "Based on several of your cycles.";
}

export function fmtDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric" });
}
