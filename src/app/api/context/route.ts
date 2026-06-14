import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/server/session";
import { PrismaDataStore } from "@/lib/server/prismaDataStore";
import type { DayContextPatch } from "@/lib/store/dataStore";
import { geoFromHeaders, type ResolvedLocation } from "@/lib/context/geo";
import { fetchWeatherForDay, fetchAirQualityForDay, geocode } from "@/lib/context/openMeteo";
import { moonPhaseFor, seasonFor } from "@/lib/context/compute";

export const maxDuration = 20;

type Body = { date?: string; lat?: number; lon?: number; force?: boolean };

const round2 = (n: number) => Math.round(n * 100) / 100;

function localToday(tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export async function POST(req: NextRequest) {
  const uid = await getSessionUserId();
  if (!uid) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const store = new PrismaDataStore(uid);

    const settings = await store.getSettings();
    if (!settings.envTrackingEnabled) {
      return NextResponse.json({ context: null, skipped: "disabled" });
    }

    const profile = await store.getProfile();
    const tz = profile.timezone || "UTC";
    const date = body.date ?? localToday(tz);

    // Don't refetch a day we already captured (with weather) unless forced.
    const existing = await store.getDayContext(date);
    if (existing && existing.tempMaxC != null && !body.force) {
      return NextResponse.json({ context: existing, cached: true });
    }

    // Resolve a coarse location: precise (client) → IP geo → geocoded profile text.
    let loc: ResolvedLocation | null = null;
    if (typeof body.lat === "number" && typeof body.lon === "number") {
      loc = { latitude: body.lat, longitude: body.lon, city: null, region: null, country: null, source: "precise" };
    } else {
      loc = geoFromHeaders(req);
      if (!loc && profile.location) {
        const g = await geocode(profile.location);
        if (g) loc = { ...g, source: "profile" };
      }
    }

    const moon = moonPhaseFor(date);
    const patch: DayContextPatch = {
      moonPhase: moon.phase,
      moonIllumination: moon.illumination,
      season: seasonFor(date, loc?.latitude ?? null),
      source: "auto",
    };

    if (loc) {
      const [weather, air] = await Promise.all([
        fetchWeatherForDay(loc.latitude, loc.longitude, date, tz),
        fetchAirQualityForDay(loc.latitude, loc.longitude, date, tz),
      ]);
      Object.assign(patch, weather, air, {
        latitude: round2(loc.latitude),
        longitude: round2(loc.longitude),
        city: loc.city,
        region: loc.region,
        country: loc.country,
        locationSource: loc.source,
      });
    }

    const context = await store.upsertDayContext(date, patch);
    return NextResponse.json({ context });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to capture context", context: null },
      { status: 500 },
    );
  }
}
