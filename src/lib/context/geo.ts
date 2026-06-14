// Resolve a coarse location from the incoming request's IP-geolocation headers.
// On Vercel these are present on every request for free, with no user prompt.

import type { LocationSource } from "@/lib/store/types";

export type ResolvedLocation = {
  latitude: number;
  longitude: number;
  city: string | null;
  region: string | null;
  country: string | null;
  source: LocationSource;
};

function dec(v: string | null): string | null {
  if (!v) return null;
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

/** Read Vercel's `x-vercel-ip-*` geo headers (also Cloudflare `cf-ip*` as fallback). */
export function geoFromHeaders(req: Request): ResolvedLocation | null {
  const h = req.headers;
  const lat = parseFloat(h.get("x-vercel-ip-latitude") ?? h.get("cf-iplatitude") ?? "");
  const lon = parseFloat(h.get("x-vercel-ip-longitude") ?? h.get("cf-iplongitude") ?? "");
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  return {
    latitude: lat,
    longitude: lon,
    city: dec(h.get("x-vercel-ip-city")) ?? dec(h.get("cf-ipcity")),
    region: dec(h.get("x-vercel-ip-country-region")),
    country: h.get("x-vercel-ip-country") ?? h.get("cf-ipcountry"),
    source: "ip",
  };
}
