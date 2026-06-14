"use client";

import { MapPin } from "lucide-react";
import type { DayContext } from "@/lib/store/types";
import { weatherCodeInfo, moonEmoji, moonLabel, aqiBand } from "@/lib/context/compute";
import { Card } from "./cards";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col rounded-xl bg-canvas px-3 py-2">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-faint" style={{ fontFamily: "var(--font-label)" }}>
        {label}
      </span>
      <span className="truncate text-[13px] font-bold text-ink">{value}</span>
    </div>
  );
}

/** Read-only display of a day's auto-captured environmental context. */
export function EnvCard({ ctx }: { ctx: DayContext }) {
  const weather = weatherCodeInfo(ctx.weatherCode);
  const aqi = aqiBand(ctx.aqiUsMax);
  const place = [ctx.city, ctx.region].filter(Boolean).join(", ");

  const temp =
    ctx.tempMinC != null && ctx.tempMaxC != null
      ? `${Math.round(ctx.tempMinC)}–${Math.round(ctx.tempMaxC)}°C`
      : ctx.tempMeanC != null
        ? `${Math.round(ctx.tempMeanC)}°C`
        : null;
  const daylight =
    ctx.daylightMinutes != null
      ? `${Math.floor(ctx.daylightMinutes / 60)}h ${ctx.daylightMinutes % 60}m`
      : null;

  return (
    <Card>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[13px] font-bold text-ink" style={{ fontFamily: "var(--font-display)" }}>
          {weather.emoji && <span className="text-[18px]">{weather.emoji}</span>}
          <span>{weather.label !== "—" ? weather.label : "Conditions"}</span>
        </div>
        {place && (
          <span className="flex items-center gap-1 text-[11px] text-muted">
            <MapPin size={12} className="text-faint" /> {place}
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {temp && <Stat label="Temp" value={temp} />}
        {ctx.apparentMaxC != null && <Stat label="Feels like" value={`${Math.round(ctx.apparentMaxC)}°C`} />}
        {ctx.humidityMean != null && <Stat label="Humidity" value={`${Math.round(ctx.humidityMean)}%`} />}
        {ctx.aqiUsMax != null && <Stat label={`Air · ${aqi.label}`} value={`AQI ${ctx.aqiUsMax}`} />}
        {ctx.pm25Mean != null && <Stat label="PM2.5" value={`${Math.round(ctx.pm25Mean)}`} />}
        {ctx.uvIndexMax != null && <Stat label="UV index" value={`${Math.round(ctx.uvIndexMax)}`} />}
        {daylight && <Stat label="Daylight" value={daylight} />}
        {ctx.windMaxKph != null && <Stat label="Wind" value={`${Math.round(ctx.windMaxKph)} km/h`} />}
        {ctx.pressureMeanHpa != null && <Stat label="Pressure" value={`${Math.round(ctx.pressureMeanHpa)} hPa`} />}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-muted">
        {ctx.moonPhase && (
          <span>
            {moonEmoji(ctx.moonPhase)} {moonLabel(ctx.moonPhase)}
          </span>
        )}
        {ctx.season && <span className="capitalize">{ctx.season}</span>}
        {ctx.pressureRangeHpa != null && ctx.pressureRangeHpa >= 6 && (
          <span className="text-faint">Pressure swing {Math.round(ctx.pressureRangeHpa)} hPa</span>
        )}
      </div>
    </Card>
  );
}
