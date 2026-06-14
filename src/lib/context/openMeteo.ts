// Free weather + air-quality capture via Open-Meteo (no API key required).
// Non-commercial free tier; attribution: https://open-meteo.com/.
// Runs server-side only (called from /api/context).

import type { DayContextPatch } from "@/lib/store/dataStore";

const FORECAST = "https://api.open-meteo.com/v1/forecast";
const ARCHIVE = "https://archive-api.open-meteo.com/v1/archive";
const AIR = "https://air-quality-api.open-meteo.com/v1/air-quality";

function daysAgo(date: string): number {
  const target = new Date(`${date}T12:00:00Z`).getTime();
  const now = Date.now();
  return Math.round((now - target) / 86_400_000);
}

async function getJson(url: string, timeoutMs = 4500): Promise<Record<string, unknown> | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;
const round = (v: number | null, dp = 1): number | null =>
  v == null ? null : Math.round(v * 10 ** dp) / 10 ** dp;

function mean(xs: (number | null)[]): number | null {
  const vals = xs.filter((x): x is number => x != null);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/** Indices of an hourly time array that fall on the target local date. */
function hoursOnDate(times: unknown, date: string): number[] {
  if (!Array.isArray(times)) return [];
  const out: number[] = [];
  times.forEach((t, i) => {
    if (typeof t === "string" && t.startsWith(date)) out.push(i);
  });
  return out;
}

function pick<T>(arr: unknown, i: number): T | null {
  return Array.isArray(arr) && i >= 0 && i < arr.length ? (arr[i] as T) : null;
}

/** Weather aggregates for one local day. Empty object on any failure. */
export async function fetchWeatherForDay(
  lat: number,
  lon: number,
  date: string,
  tz: string,
): Promise<DayContextPatch> {
  const ago = daysAgo(date);
  const daily =
    "temperature_2m_max,temperature_2m_min,apparent_temperature_max,precipitation_sum,weather_code,wind_speed_10m_max,uv_index_max,daylight_duration";
  const hourly = "temperature_2m,relative_humidity_2m,pressure_msl";
  const base = `latitude=${lat}&longitude=${lon}&timezone=${encodeURIComponent(tz)}&daily=${daily}&hourly=${hourly}`;
  const url =
    ago > 5
      ? `${ARCHIVE}?${base}&start_date=${date}&end_date=${date}`
      : `${FORECAST}?${base}&past_days=${Math.min(7, Math.max(0, ago))}&forecast_days=1`;

  const data = await getJson(url);
  if (!data) return {};

  const dailyObj = data.daily as Record<string, unknown> | undefined;
  const hourlyObj = data.hourly as Record<string, unknown> | undefined;
  const di = Array.isArray(dailyObj?.time) ? (dailyObj!.time as string[]).indexOf(date) : -1;

  const patch: DayContextPatch = {};
  if (dailyObj && di >= 0) {
    patch.tempMaxC = round(num(pick<number>(dailyObj.temperature_2m_max, di)));
    patch.tempMinC = round(num(pick<number>(dailyObj.temperature_2m_min, di)));
    patch.apparentMaxC = round(num(pick<number>(dailyObj.apparent_temperature_max, di)));
    patch.precipitationMm = round(num(pick<number>(dailyObj.precipitation_sum, di)));
    patch.weatherCode = num(pick<number>(dailyObj.weather_code, di));
    patch.windMaxKph = round(num(pick<number>(dailyObj.wind_speed_10m_max, di)));
    patch.uvIndexMax = round(num(pick<number>(dailyObj.uv_index_max, di)));
    const daylightSec = num(pick<number>(dailyObj.daylight_duration, di));
    patch.daylightMinutes = daylightSec != null ? Math.round(daylightSec / 60) : null;
  }
  if (hourlyObj) {
    const idx = hoursOnDate(hourlyObj.time, date);
    const temps = idx.map((i) => num(pick<number>(hourlyObj.temperature_2m, i)));
    const hums = idx.map((i) => num(pick<number>(hourlyObj.relative_humidity_2m, i)));
    const press = idx.map((i) => num(pick<number>(hourlyObj.pressure_msl, i))).filter((x): x is number => x != null);
    patch.tempMeanC = round(mean(temps));
    patch.humidityMean = round(mean(hums), 0);
    if (press.length) {
      patch.pressureMeanHpa = round(mean(press), 0);
      patch.pressureRangeHpa = round(Math.max(...press) - Math.min(...press), 0);
    }
  }
  return patch;
}

/** Air-quality aggregates for one local day. Empty object on any failure. */
export async function fetchAirQualityForDay(
  lat: number,
  lon: number,
  date: string,
  tz: string,
): Promise<DayContextPatch> {
  const ago = daysAgo(date);
  const base = `latitude=${lat}&longitude=${lon}&timezone=${encodeURIComponent(tz)}&hourly=pm2_5,pm10,us_aqi`;
  const url =
    ago > 5
      ? `${AIR}?${base}&start_date=${date}&end_date=${date}`
      : `${AIR}?${base}&past_days=${Math.min(7, Math.max(0, ago))}&forecast_days=1`;

  const data = await getJson(url);
  const hourlyObj = data?.hourly as Record<string, unknown> | undefined;
  if (!hourlyObj) return {};

  const idx = hoursOnDate(hourlyObj.time, date);
  const pm25 = idx.map((i) => num(pick<number>(hourlyObj.pm2_5, i)));
  const pm10 = idx.map((i) => num(pick<number>(hourlyObj.pm10, i)));
  const aqi = idx.map((i) => num(pick<number>(hourlyObj.us_aqi, i))).filter((x): x is number => x != null);

  return {
    pm25Mean: round(mean(pm25), 0),
    pm10Mean: round(mean(pm10), 0),
    aqiUsMax: aqi.length ? Math.round(Math.max(...aqi)) : null,
  };
}

/** Resolve free-text location → coarse lat/lon/city via Open-Meteo geocoding. */
export async function geocode(
  name: string,
): Promise<{ latitude: number; longitude: number; city: string; region: string; country: string } | null> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`;
  const data = await getJson(url);
  const first = Array.isArray(data?.results) ? (data!.results as Record<string, unknown>[])[0] : null;
  if (!first) return null;
  return {
    latitude: first.latitude as number,
    longitude: first.longitude as number,
    city: (first.name as string) ?? "",
    region: (first.admin1 as string) ?? "",
    country: (first.country as string) ?? "",
  };
}
