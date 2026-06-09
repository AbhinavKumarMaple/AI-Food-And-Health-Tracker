export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDayName(iso: string): string {
  return new Date(iso).toLocaleDateString([], { weekday: "long" });
}

export function formatMonthDay(iso: string): string {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

export function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** "1.4L" from millilitres. */
export function formatLitres(ml: number): string {
  return `${(ml / 1000).toFixed(1)}L`;
}

export function shortMonth(iso: string): string {
  return new Date(iso).toLocaleDateString([], { month: "short" }).toUpperCase();
}

export function dayOfMonth(iso: string): string {
  return String(new Date(iso).getDate());
}

const MOOD_LABELS = ["", "Rough", "Low", "Okay", "Pretty good", "Amazing"];
export function moodLabel(rating: number): string {
  return MOOD_LABELS[Math.max(1, Math.min(5, Math.round(rating)))] ?? "";
}
