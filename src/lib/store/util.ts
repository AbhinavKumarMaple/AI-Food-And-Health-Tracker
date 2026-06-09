import type { ISODate, ISODateTime } from "./types";

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

export function nowIso(): ISODateTime {
  return new Date().toISOString();
}

/** Local calendar date (YYYY-MM-DD) for a datetime, in the runtime's timezone. */
export function toISODate(d: Date | string): ISODate {
  const date = typeof d === "string" ? new Date(d) : d;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISODate(): ISODate {
  return toISODate(new Date());
}

/** Minutes between two instants (b - a). */
export function minutesBetween(a: ISODateTime, b: ISODateTime): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 60000;
}

export function compareDesc(a: ISODateTime, b: ISODateTime): number {
  return new Date(b).getTime() - new Date(a).getTime();
}

export function compareAsc(a: ISODateTime, b: ISODateTime): number {
  return new Date(a).getTime() - new Date(b).getTime();
}
