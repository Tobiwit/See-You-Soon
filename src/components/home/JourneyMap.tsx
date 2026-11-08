"use client";

import { useEffect, useMemo, useState } from "react";
import { geoMercator, geoPath, geoInterpolate, type GeoPermissibleObjects } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { RouteStop } from "@/config/app";
import { haversineKm } from "@/lib/geo";
import type { SharedLocation } from "@/lib/types";
import s from "./home.module.css";

type Countries = FeatureCollection<Geometry, { name: string }>;
let worldCache: Countries | null = null;

async function loadWorld(): Promise<Countries> {
  if (worldCache) return worldCache;
  const topo = (await import("world-atlas/countries-110m.json")).default as unknown as Parameters<typeof feature>[0];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  worldCache = feature(topo, (topo as any).objects.countries) as unknown as Countries;
  return worldCache;
}

const ALIASES: Record<string, string> = {
  skorea: "southkorea",
  korea: "southkorea",
  republicofkorea: "southkorea",
  korearepublicof: "southkorea",
  socialistrepublicofvietnam: "vietnam",
};
const norm = (x: string) => {
  const k = x.toLowerCase().replace(/[^a-z]/g, "");
  return ALIASES[k] ?? k;
};
const sameCountry = (a: string, b: string) => {
  const na = norm(a);
  return Boolean(na) && na === norm(b);
};

/** Index of the route stop the traveller is currently at (by country, else nearest). */
export function currentStopIndex(route: RouteStop[], loc: SharedLocation | null): number {
  if (!loc || !route.length) return -1;
  if (loc.country) {
    const i = route.findIndex((st) => sameCountry(st.name, loc.country!) || sameCountry(st.name, loc.name));
    if (i >= 0) return i;
  }
  const byName = route.findIndex((st) => sameCountry(st.name, loc.city ?? loc.name));
  if (byName >= 0) return byName;
  if (typeof loc.lat === "number" && typeof loc.lon === "number") {
    let best = -1;
    let bestD = Infinity;
    route.forEach((st, i) => {
      const d = haversineKm(st, { lat: loc.lat!, lon: loc.lon! });
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return bestD < 1500 ? best : -1;
  }
  return -1;
}

const W = 340;
const H = 250;

export function JourneyMap({ route, location }: { route: RouteStop[]; location: SharedLocation | null }) {
  const [world, setWorld] = useState<Countries | null>(worldCache);
  useEffect(() => {
    if (!world) void loadWorld().then(setWorld).catch(() => {});
  }, [world]);

  const current = currentStopIndex(route, location);
  const hasPoint = typeof location?.lat === "number" && typeof location?.lon === "number";

  const geo = useMemo(() => {
    if (!route.length) return null;
    const pts: [number, number][] = route.map((st) => [st.lon, st.lat]);
    if (hasPoint) pts.push([location!.lon!, location!.lat!]);
    const projection = geoMercator().fitExtent(
      [
        [34, 30],
        [W - 34, H - 34],
      ],
      { type: "MultiPoint", coordinates: pts } as GeoPermissibleObjects,
    );
    const path = geoPath(projection);
    // Slightly bowed great-circle legs.
    const legs = route.slice(1).map((st, i) => {
      const a = route[i];
      const interp = geoInterpolate([a.lon, a.lat], [st.lon, st.lat]);
      const samples = Array.from({ length: 24 }, (_, k) => projection(interp(k / 23))!).filter(Boolean);
      const d = samples.map((p, k) => `${k ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("");
      return { d, done: current > i };
    });
    const stops = route.map((st) => projection([st.lon, st.lat])!);
    const here = hasPoint ? projection([location!.lon!, location!.lat!]) : null;
    return { projection, path, legs, stops, here };
  }, [route, hasPoint, location, current]);

  if (!geo) return null;

  const routeNames = route.map((r) => r.name);
  const herePoint = geo.here ?? (current >= 0 ? geo.stops[current] : null);

  return (
    <figure className={s.map}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Route: ${routeNames.join(" → ")}`}>
        <g className={s.land}>
          {world?.features.map((f, i) => {
            const onRoute = routeNames.some((n) => sameCountry(n, f.properties.name));
            return <path key={i} d={geo.path(f) ?? undefined} data-route={onRoute || undefined} />;
          })}
        </g>
        {geo.legs.map((l, i) => (
          <path key={i} d={l.d} className={s.leg} data-done={l.done || undefined} />
        ))}
        {geo.stops.map((p, i) => {
          const isCurrent = i === current;
          const past = current > i;
          const labelLeft = p[0] > W * 0.62;
          return (
            <g key={route[i].id} transform={`translate(${p[0]},${p[1]})`}>
              <circle r={3.2} className={s.stop} data-past={past || undefined} data-current={isCurrent || undefined} />
              <text
                x={labelLeft ? -8 : 8}
                y={-7}
                textAnchor={labelLeft ? "end" : "start"}
                className={s.stopLabel}
                data-current={isCurrent || undefined}
              >
                {route[i].name}
              </text>
            </g>
          );
        })}
        {herePoint && (
          <g transform={`translate(${herePoint[0]},${herePoint[1]})`} aria-hidden>
            <circle r={11} className={s.herePulse} />
            <circle r={5} className={s.here} />
          </g>
        )}
      </svg>
      <figcaption className="sr-only">
        {current >= 0 ? `Currently at stop ${current + 1}: ${route[current].name}.` : "No current location shared yet."}
      </figcaption>
    </figure>
  );
}
