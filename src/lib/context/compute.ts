// Pure, free, no-API environmental computations: moon phase, season, and a
// human-friendly mapping for WMO weather codes. Used by the context capture
// route and the UI.

import type { MoonPhase, Season } from "@/lib/store/types";

const SYNODIC_MONTH = 29.530588853; // days
// A known new moon (2000-01-06 18:14 UTC) as the reference epoch.
const KNOWN_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14, 0);

/** Moon phase + illumination (0..1) for a local calendar date (uses local noon). */
export function moonPhaseFor(date: string): { phase: MoonPhase; illumination: number } {
  const t = new Date(`${date}T12:00:00`).getTime();
  const days = (t - KNOWN_NEW_MOON_MS) / 86_400_000;
  let frac = (days / SYNODIC_MONTH) % 1;
  if (frac < 0) frac += 1; // 0 = new, 0.5 = full
  const illumination = (1 - Math.cos(2 * Math.PI * frac)) / 2;

  const phases: MoonPhase[] = [
    "new",
    "waxing_crescent",
    "first_quarter",
    "waxing_gibbous",
    "full",
    "waning_gibbous",
    "last_quarter",
    "waning_crescent",
  ];
  // 8 equal segments centred on the principal phases.
  const idx = Math.floor((frac + 1 / 16) * 8) % 8;
  return { phase: phases[idx], illumination: Math.round(illumination * 100) / 100 };
}

/** Meteorological season for a date, accounting for hemisphere (from latitude). */
export function seasonFor(date: string, latitude: number | null | undefined): Season {
  const month = Number(date.slice(5, 7)); // 1-12
  const northern: Season[] = [
    "winter", "winter", "spring", "spring", "spring", "summer",
    "summer", "summer", "autumn", "autumn", "autumn", "winter",
  ];
  const n = northern[month - 1];
  if (latitude != null && latitude < 0) {
    const flip: Record<Season, Season> = {
      winter: "summer",
      summer: "winter",
      spring: "autumn",
      autumn: "spring",
    };
    return flip[n];
  }
  return n;
}

const MOON_LABELS: Record<MoonPhase, string> = {
  new: "New moon",
  waxing_crescent: "Waxing crescent",
  first_quarter: "First quarter",
  waxing_gibbous: "Waxing gibbous",
  full: "Full moon",
  waning_gibbous: "Waning gibbous",
  last_quarter: "Last quarter",
  waning_crescent: "Waning crescent",
};
const MOON_EMOJI: Record<MoonPhase, string> = {
  new: "🌑",
  waxing_crescent: "🌒",
  first_quarter: "🌓",
  waxing_gibbous: "🌔",
  full: "🌕",
  waning_gibbous: "🌖",
  last_quarter: "🌗",
  waning_crescent: "🌘",
};
export function moonLabel(p: MoonPhase): string {
  return MOON_LABELS[p];
}
export function moonEmoji(p: MoonPhase): string {
  return MOON_EMOJI[p];
}

/** WMO weather code → short label + emoji (Open-Meteo `weather_code`). */
export function weatherCodeInfo(code: number | null | undefined): { label: string; emoji: string } {
  if (code == null) return { label: "—", emoji: "" };
  const map: Record<number, { label: string; emoji: string }> = {
    0: { label: "Clear", emoji: "☀️" },
    1: { label: "Mainly clear", emoji: "🌤️" },
    2: { label: "Partly cloudy", emoji: "⛅" },
    3: { label: "Overcast", emoji: "☁️" },
    45: { label: "Fog", emoji: "🌫️" },
    48: { label: "Rime fog", emoji: "🌫️" },
    51: { label: "Light drizzle", emoji: "🌦️" },
    53: { label: "Drizzle", emoji: "🌦️" },
    55: { label: "Heavy drizzle", emoji: "🌧️" },
    61: { label: "Light rain", emoji: "🌧️" },
    63: { label: "Rain", emoji: "🌧️" },
    65: { label: "Heavy rain", emoji: "🌧️" },
    66: { label: "Freezing rain", emoji: "🌧️" },
    67: { label: "Freezing rain", emoji: "🌧️" },
    71: { label: "Light snow", emoji: "🌨️" },
    73: { label: "Snow", emoji: "🌨️" },
    75: { label: "Heavy snow", emoji: "❄️" },
    77: { label: "Snow grains", emoji: "🌨️" },
    80: { label: "Rain showers", emoji: "🌦️" },
    81: { label: "Rain showers", emoji: "🌧️" },
    82: { label: "Violent showers", emoji: "⛈️" },
    85: { label: "Snow showers", emoji: "🌨️" },
    86: { label: "Snow showers", emoji: "❄️" },
    95: { label: "Thunderstorm", emoji: "⛈️" },
    96: { label: "Thunderstorm", emoji: "⛈️" },
    99: { label: "Thunderstorm", emoji: "⛈️" },
  };
  return map[code] ?? { label: "—", emoji: "" };
}

/** Coarse US-AQI band → label + tone for display. */
export function aqiBand(aqi: number | null | undefined): { label: string; tone: "success" | "warm" | "orange" | "danger" } {
  if (aqi == null) return { label: "—", tone: "warm" };
  if (aqi <= 50) return { label: "Good", tone: "success" };
  if (aqi <= 100) return { label: "Moderate", tone: "warm" };
  if (aqi <= 150) return { label: "Unhealthy (sensitive)", tone: "orange" };
  return { label: "Unhealthy", tone: "danger" };
}
