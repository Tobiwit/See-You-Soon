"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from "react";
import { geoBounds, geoMercator, geoPath, type GeoPermissibleObjects } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { usePlacesById, useSpace } from "@/lib/space";
import type { WishItem } from "@/lib/types";
import { Photo } from "../ui/Photo";
import { Sheet } from "../ui/Sheet";
import { reducedMotion, useUI } from "../ui/ui-state";
import { FallbackArt } from "./ItemCard";
import s from "./ideaMap.module.css";

/* ------------------------------------------------------------------ */
/* Map data (50m detail, loaded only when the map opens)               */
/* ------------------------------------------------------------------ */

type Country = Feature<Geometry, { name: string }>;
interface Region {
  vietnam: Country;
  others: Country[];
}

let regionCache: Region | null = null;

async function loadRegion(): Promise<Region> {
  if (regionCache) return regionCache;
  const topo = (await import("world-atlas/countries-50m.json")).default as unknown as Parameters<typeof feature>[0];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const all = (feature(topo, (topo as any).objects.countries) as unknown as FeatureCollection<Geometry, { name: string }>).features;
  const vietnam = all.find((f) => f.properties.name === "Vietnam");
  if (!vietnam) throw new Error("Vietnam missing from map data");
  // Only neighbours around Vietnam, so zooming stays light.
  const others = all.filter((f) => {
    if (f === vietnam) return false;
    const [[x0, y0], [x1, y1]] = geoBounds(f);
    return x1 > 90 && x0 < 122 && y1 > 2 && y0 < 30;
  });
  regionCache = { vietnam, others };
  return regionCache;
}

const CITIES: { name: string; lat: number; lon: number; major?: boolean }[] = [
  { name: "Hà Nội", lat: 21.0285, lon: 105.8542, major: true },
  { name: "Sa Pa", lat: 22.3364, lon: 103.8438 },
  { name: "Hạ Long", lat: 20.9599, lon: 107.0425 },
  { name: "Ninh Bình", lat: 20.2506, lon: 105.9745 },
  { name: "Huế", lat: 16.4637, lon: 107.5909, major: true },
  { name: "Đà Nẵng", lat: 16.0544, lon: 108.2022, major: true },
  { name: "Hội An", lat: 15.8801, lon: 108.338 },
  { name: "Nha Trang", lat: 12.2388, lon: 109.1967 },
  { name: "Đà Lạt", lat: 11.9404, lon: 108.4583 },
  { name: "Hồ Chí Minh City", lat: 10.8231, lon: 106.6297, major: true },
  { name: "Cần Thơ", lat: 10.0452, lon: 105.7469 },
  { name: "Phú Quốc", lat: 10.2899, lon: 103.984 },
];

const COUNTRIES: { name: string; lat: number; lon: number }[] = [
  { name: "China", lat: 23.9, lon: 104.6 },
  { name: "Laos", lat: 19.2, lon: 102.6 },
  { name: "Thailand", lat: 15.6, lon: 101.6 },
  { name: "Cambodia", lat: 12.8, lon: 104.9 },
];

/* ------------------------------------------------------------------ */
/* View transform: screen = base * k + (x, y)                          */
/* ------------------------------------------------------------------ */

interface View {
  k: number;
  x: number;
  y: number;
}

const MIN_K = 1;
const MAX_K = 48;
/** From this zoom on, ideas are shown as photo tiles instead of dots. */
const TILE_K = 3.2;
const IDENTITY: View = { k: 1, x: 0, y: 0 };

let savedView: View | null = null; // survives opening an idea on top of the map

interface Group {
  key: string;
  px: number;
  py: number;
  items: WishItem[];
}

export function IdeaMap() {
  const { close, open } = useUI();
  const { items } = useSpace();
  const placesById = usePlacesById();
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [region, setRegion] = useState<Region | null>(regionCache);
  const [failed, setFailed] = useState(false);
  const [view, setViewState] = useState<View>(() => savedView ?? IDENTITY);
  const viewRef = useRef(view);

  useEffect(() => {
    if (region) return;
    let alive = true;
    loadRegion()
      .then((r) => alive && setRegion(r))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [region]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect;
      if (width > 0 && height > 0) setSize({ w: Math.round(width), h: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    savedView = view;
  }, [view]);

  const geo = useMemo(() => {
    if (!region || !size) return null;
    const pad = 28;
    const projection = geoMercator().fitExtent(
      [
        [pad, pad],
        [size.w - pad, size.h - pad],
      ],
      region.vietnam as GeoPermissibleObjects,
    );
    const path = geoPath(projection);
    const [[bx0, by0], [bx1, by1]] = path.bounds(region.vietnam as GeoPermissibleObjects);
    const shapes = (
      <>
        {region.others.map((f, i) => (
          <path key={i} d={path(f as GeoPermissibleObjects) ?? undefined} className={s.other} vectorEffect="non-scaling-stroke" />
        ))}
        <path d={path(region.vietnam as GeoPermissibleObjects) ?? undefined} className={s.vietnam} vectorEffect="non-scaling-stroke" />
      </>
    );
    const at = (lat: number, lon: number) => projection([lon, lat]) ?? [0, 0];
    return { at, shapes, bounds: { bx0, by0, bx1, by1 } };
  }, [region, size]);

  // Ideas grouped by their place (ideas share city coordinates).
  const { groups, unplaced } = useMemo(() => {
    const byPlace = new Map<string, Group>();
    let unplaced = 0;
    if (!geo) return { groups: [] as Group[], unplaced };
    for (const it of items) {
      const p = placesById.get(it.placeId);
      if (!p || typeof p.lat !== "number" || typeof p.lon !== "number") {
        unplaced++;
        continue;
      }
      const key = `${p.lat.toFixed(3)},${p.lon.toFixed(3)}`;
      let g = byPlace.get(key);
      if (!g) {
        const [px, py] = geo.at(p.lat, p.lon);
        g = { key, px, py, items: [] };
        byPlace.set(key, g);
      }
      g.items.push(it);
    }
    return { groups: [...byPlace.values()], unplaced };
  }, [items, placesById, geo]);

  /* ---------------- transform helpers ---------------- */

  function clampView(v: View): View {
    if (!geo || !size) return v;
    const k = Math.min(MAX_K, Math.max(MIN_K, v.k));
    const { bx0, by0, bx1, by1 } = geo.bounds;
    const m = 70; // keep at least this much of Vietnam on screen
    const clampAxis = (t: number, lo: number, hi: number, view: number) => {
      const min = m - hi * k;
      const max = view - m - lo * k;
      return min > max ? (min + max) / 2 : Math.min(max, Math.max(min, t));
    };
    return { k, x: clampAxis(v.x, bx0, bx1, size.w), y: clampAxis(v.y, by0, by1, size.h) };
  }

  function setView(v: View) {
    const c = clampView(v);
    viewRef.current = c;
    setViewState(c);
  }

  function zoomAround(v: View, factor: number, px: number, py: number): View {
    const k = Math.min(MAX_K, Math.max(MIN_K, v.k * factor));
    const r = k / v.k;
    return { k, x: px - (px - v.x) * r, y: py - (py - v.y) * r };
  }

  const anim = useRef(0);
  function animateTo(target: View) {
    cancelAnimationFrame(anim.current);
    const from = viewRef.current;
    const to = clampView(target);
    if (reducedMotion()) return setView(to);
    let t0 = -1; // first frame's timestamp
    const dur = 360;
    const step = (t: number) => {
      if (t0 < 0) t0 = t;
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      const k = from.k * Math.pow(to.k / from.k, e);
      // Interpolate the screen-centre's base point so the path feels like a straight glide.
      const cx = (size!.w / 2 - from.x) / from.k;
      const cy = (size!.h / 2 - from.y) / from.k;
      const tx = (size!.w / 2 - to.x) / to.k;
      const ty = (size!.h / 2 - to.y) / to.k;
      const bx = cx + (tx - cx) * e;
      const by = cy + (ty - cy) * e;
      setView({ k, x: size!.w / 2 - bx * k, y: size!.h / 2 - by * k });
      if (p < 1) anim.current = requestAnimationFrame(step);
    };
    anim.current = requestAnimationFrame(step);
  }

  function focus(px: number, py: number, k: number) {
    if (!size) return;
    animateTo({ k, x: size.w / 2 - px * k, y: size.h / 2 - py * k });
  }

  /* ---------------- gestures ---------------- */

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<
    | { kind: "pan"; sx: number; sy: number; v0: View; moved: boolean }
    | { kind: "pinch"; d0: number; mx: number; my: number; v0: View }
    | null
  >(null);
  const dragged = useRef(false);

  const local = (e: { clientX: number; clientY: number }) => {
    const r = box.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  function startFromPointers() {
    const pts = [...pointers.current.values()];
    if (pts.length >= 2) {
      const [a, b] = pts;
      gesture.current = { kind: "pinch", d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, v0: viewRef.current };
    } else if (pts.length === 1) {
      gesture.current = { kind: "pan", sx: pts[0].x, sy: pts[0].y, v0: viewRef.current, moved: dragged.current };
    } else gesture.current = null;
  }

  function onPointerDown(e: RPointerEvent<HTMLDivElement>) {
    cancelAnimationFrame(anim.current);
    if (pointers.current.size === 0) dragged.current = false;
    pointers.current.set(e.pointerId, local(e));
    startFromPointers();
  }

  function onPointerMove(e: RPointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, local(e));
    const g = gesture.current;
    if (!g) return;
    if (g.kind === "pan") {
      const p = local(e);
      const dx = p.x - g.sx;
      const dy = p.y - g.sy;
      if (!g.moved && Math.hypot(dx, dy) > 6) {
        g.moved = true;
        dragged.current = true;
        box.current?.setPointerCapture(e.pointerId);
      }
      if (g.moved) setView({ k: g.v0.k, x: g.v0.x + dx, y: g.v0.y + dy });
    } else {
      const [a, b] = [...pointers.current.values()];
      if (!a || !b) return;
      dragged.current = true;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      const z = zoomAround(g.v0, d / g.d0, g.mx, g.my);
      setView({ k: z.k, x: z.x + (mx - g.mx), y: z.y + (my - g.my) });
    }
  }

  function onPointerEnd(e: RPointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId);
    startFromPointers();
  }

  // Wheel / trackpad zoom (non-passive so the page never scrolls).
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cancelAnimationFrame(anim.current);
      const r = el.getBoundingClientRect();
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0022));
      const v = zoomAround(viewRef.current, factor, e.clientX - r.left, e.clientY - r.top);
      setView(v);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  /* ---------------- render ---------------- */

  const { k, x, y } = view;
  const tiles = k >= TILE_K;
  const tileSize = Math.round(Math.min(72, 46 + (k - TILE_K) * 3));
  const placed = items.length - unplaced;

  return (
    <Sheet title="Ideas on the map" onClose={close} full flush>
      <div
        ref={box}
        className={s.map}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClickCapture={(e) => {
          // A drag that ends on a marker must not open it.
          if (dragged.current) {
            e.stopPropagation();
            e.preventDefault();
          }
        }}
        onDoubleClick={(e) => {
          const p = local(e);
          animateTo(zoomAround(viewRef.current, 2, p.x, p.y));
        }}
        role="application"
        aria-label="Map of Vietnam with your ideas. Drag to move, pinch or scroll to zoom."
      >
        {size && geo ? (
          <>
            <svg width={size.w} height={size.h} className={s.svg} aria-hidden>
              <rect width={size.w} height={size.h} className={s.sea} />
              <g transform={`translate(${x},${y}) scale(${k})`}>{geo.shapes}</g>
            </svg>

            <div className={s.layer} aria-hidden>
              {k < TILE_K * 1.4 &&
                COUNTRIES.map((c) => {
                  const [px, py] = geo.at(c.lat, c.lon);
                  return (
                    <span key={c.name} className={s.country} style={{ left: px * k + x, top: py * k + y }}>
                      {c.name}
                    </span>
                  );
                })}
              {CITIES.filter((c) => c.major || k >= 2).map((c) => {
                const [px, py] = geo.at(c.lat, c.lon);
                // Ideas sit on top of their city: drop the label rather than half-cover it.
                const clear = tiles ? tileSize * 1.2 : 24;
                if (groups.some((g) => Math.hypot((g.px - px) * k, (g.py - py) * k) < clear)) return null;
                return (
                  <span key={c.name} className={s.city} style={{ left: px * k + x, top: py * k + y }} data-major={c.major || undefined}>
                    <span className={s.cityDot} />
                    {c.name}
                  </span>
                );
              })}
            </div>

            <div className={s.layer}>
              {groups.map((g) => {
                const sx = g.px * k + x;
                const sy = g.py * k + y;
                if (sx < -120 || sy < -120 || sx > size.w + 120 || sy > size.h + 120) return null;
                const allVisited = g.items.every((i) => i.visited);
                if (!tiles) {
                  return (
                    <button
                      key={g.key}
                      type="button"
                      className={s.dot}
                      data-many={g.items.length > 1 || undefined}
                      data-visited={allVisited || undefined}
                      style={{ left: sx, top: sy }}
                      onClick={() => focus(g.px, g.py, Math.max(TILE_K * 1.6, k))}
                      aria-label={`${g.items.length} ${g.items.length === 1 ? "idea" : "ideas"} in ${g.items[0].placeName} — zoom in`}
                    >
                      {g.items.length > 1 ? g.items.length : ""}
                    </button>
                  );
                }
                // A small grid of photo tiles, centred on the place.
                const cols = Math.ceil(Math.sqrt(g.items.length));
                const rows = Math.ceil(g.items.length / cols);
                const gap = 5;
                const w = cols * tileSize + (cols - 1) * gap;
                const h = rows * tileSize + (rows - 1) * gap;
                return (
                  <div
                    key={g.key}
                    className={s.cluster}
                    style={{ left: sx - w / 2, top: sy - h / 2, width: w, gridTemplateColumns: `repeat(${cols}, ${tileSize}px)`, gap }}
                  >
                    {g.items.map((it) => (
                      <button
                        key={it.id}
                        type="button"
                        className={s.tile}
                        style={{ width: tileSize, height: tileSize }}
                        data-visited={it.visited || undefined}
                        onClick={() => open({ kind: "item", id: it.id })}
                        aria-label={`${it.title}, ${it.placeName}${it.visited ? ", visited" : ""}`}
                        title={it.title}
                      >
                        {it.image ? <Photo image={it.image} alt="" /> : <FallbackArt item={it} size="xs" />}
                        {it.visited && (
                          <span className={s.tick} aria-hidden>
                            ✓
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>

            <div className={s.controls}>
              <button
                type="button"
                className={s.ctrl}
                aria-label="Zoom in"
                onClick={() => animateTo(zoomAround(viewRef.current, 2, size.w / 2, size.h / 2))}
              >
                +
              </button>
              <button
                type="button"
                className={s.ctrl}
                aria-label="Zoom out"
                onClick={() => animateTo(zoomAround(viewRef.current, 0.5, size.w / 2, size.h / 2))}
              >
                −
              </button>
              <button type="button" className={s.ctrl} aria-label="Show all of Vietnam" onClick={() => animateTo(IDENTITY)}>
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
                  <path d="M1 5V1h4M9 1h4v4M13 9v4H9M5 13H1V9" fill="none" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </button>
            </div>
          </>
        ) : (
          <p className={s.loading}>{failed ? "Couldn’t load the map. Check your connection." : "Drawing Vietnam…"}</p>
        )}
      </div>
      <p className={s.foot}>
        {placed} {placed === 1 ? "idea" : "ideas"} on the map
        {unplaced > 0 ? ` · ${unplaced} without a map position` : ""}
        <span className={s.hint}> · {tiles ? "Tap a photo to open it" : "Tap a dot or zoom in to see photos"}</span>
      </p>
    </Sheet>
  );
}
