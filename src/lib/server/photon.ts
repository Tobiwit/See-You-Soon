import "server-only";

/**
 * Place search / reverse geocoding via Photon (OpenStreetMap data, komoot).
 * Free, keyless, fair-use. Data © OpenStreetMap contributors.
 */
const BASE = "https://photon.komoot.io";
const UA = "see-you-soon-private-app/1.0";

export interface PlaceResult {
  providerId: string;
  name: string;
  label: string;
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  lat: number;
  lon: number;
}

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: Record<string, string | undefined>;
}

function normalise(f: PhotonFeature): PlaceResult | null {
  const p = f.properties;
  const [lon, lat] = f.geometry?.coordinates ?? [];
  if (typeof lat !== "number" || typeof lon !== "number") return null;
  const city = p.city ?? (["city", "town", "village"].includes(p.type ?? "") ? p.name : undefined) ?? p.county;
  const name = p.name ?? city ?? p.state ?? p.country ?? "Unnamed place";
  const parts = [name, city && city !== name ? city : undefined, p.country].filter(Boolean);
  return {
    providerId: `osm:${p.osm_type ?? ""}${p.osm_id ?? ""}`,
    name,
    label: parts.join(", "),
    city,
    region: p.state,
    country: p.country,
    countryCode: p.countrycode?.toUpperCase(),
    lat,
    lon,
  };
}

async function photon(path: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { "User-Agent": UA }, cache: "no-store" });
  if (!res.ok) throw new Error(`Photon ${res.status}`);
  const json = (await res.json()) as { features?: PhotonFeature[] };
  return (json.features ?? []).map(normalise).filter((x): x is PlaceResult => x !== null);
}

export async function searchPlaces(q: string, bias?: { lat: number; lon: number }) {
  const params = new URLSearchParams({ q, limit: "8", lang: "en" });
  if (bias) {
    params.set("lat", String(bias.lat));
    params.set("lon", String(bias.lon));
  }
  const results = await photon(`/api/?${params}`);
  const seen = new Set<string>();
  return results.filter((r) => (seen.has(r.label) ? false : (seen.add(r.label), true)));
}

export async function reverseGeocode(lat: number, lon: number) {
  const params = new URLSearchParams({ lat: String(lat), lon: String(lon), lang: "en", limit: "1" });
  const [hit] = await photon(`/reverse?${params}`);
  return hit ?? null;
}
