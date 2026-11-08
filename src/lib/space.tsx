"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  type DocumentData,
  type FirestoreError,
  Timestamp,
} from "firebase/firestore";
import {
  DEFAULT_FIXED_EVENTS,
  DEFAULT_SPACE_CONFIG,
  DEFAULT_TRAVELLER_LOCATION,
  MOODS,
  OWNER,
  SPACE_ID,
  type MoodId,
  type PersonKey,
  type SpaceConfig,
} from "@/config/app";
import { fb } from "./firebase";
import type {
  ActivityEvent,
  FixedEvent,
  Moment,
  Mood,
  Place,
  Postcard,
  SharedLocation,
  TravelEvent,
  WishItem,
} from "./types";

export type SyncStatus = "connecting" | "online" | "offline" | "denied" | "error";

export interface SpaceData {
  loaded: boolean;
  sync: SyncStatus;
  config: SpaceConfig;
  items: WishItem[];
  places: Place[];
  travel: TravelEvent[];
  fixed: FixedEvent[];
  postcards: Postcard[];
  moments: Moment[];
  moods: Partial<Record<PersonKey, Mood>>;
  location: SharedLocation;
  events: ActivityEvent[];
  members: Partial<Record<PersonKey, { push?: unknown }>>;
  moodPhotos: MoodPhoto[];
}

/** A mood picture uploaded by `by`, shown to the other person when they pick `tier`. */
export interface MoodPhoto {
  id: string;
  tier: MoodId;
  by: PersonKey;
  imageId: string;
  createdAt: Date | null;
}

const Ctx = createContext<SpaceData | null>(null);

export const toDate = (v: unknown): Date | null =>
  v instanceof Timestamp ? v.toDate() : v instanceof Date ? v : null;

const str = (v: unknown, d = "") => (typeof v === "string" ? v : d);
const num = (v: unknown, d = 0) => (typeof v === "number" && Number.isFinite(v) ? v : d);

function mapItem(id: string, d: DocumentData, pending: boolean): WishItem {
  return {
    id,
    title: str(d.title),
    description: str(d.description),
    type: str(d.type, "other") as WishItem["type"],
    placeId: str(d.placeId),
    placeName: str(d.placeName),
    desiredDate: d.desiredDate ?? null,
    image: d.image ?? null,
    url: d.url ?? null,
    by: d.by,
    createdAt: toDate(d.createdAt),
    updatedAt: toDate(d.updatedAt),
    visited: Boolean(d.visited),
    visitedAt: toDate(d.visitedAt),
    visitNote: str(d.visitNote),
    visitImage: d.visitImage ?? null,
    plannedDate: d.plannedDate ?? null,
    plannedOrder: num(d.plannedOrder),
    pending,
  };
}

function mergeConfig(d: DocumentData | undefined): SpaceConfig {
  const c = { ...DEFAULT_SPACE_CONFIG };
  if (!d) return c;
  for (const k of Object.keys(c) as (keyof SpaceConfig)[]) {
    if (d[k] !== undefined && d[k] !== null) (c as Record<string, unknown>)[k] = d[k];
  }
  c.coverImageId = d.coverImageId ?? null;
  return c;
}

/** Until the traveller shares a location, show the configured starting point (clearly labelled). */
const DEFAULT_LOCATION: SharedLocation = { ...DEFAULT_TRAVELLER_LOCATION, source: "default", updatedAt: null };

const EMPTY: SpaceData = {
  loaded: false,
  sync: "connecting",
  config: DEFAULT_SPACE_CONFIG,
  items: [],
  places: [],
  travel: [],
  fixed: DEFAULT_FIXED_EVENTS,
  postcards: [],
  moments: [],
  moods: {},
  location: DEFAULT_LOCATION,
  events: [],
  members: {},
  moodPhotos: [],
};

export function SpaceProvider({ me, children }: { me: PersonKey; children: ReactNode }) {
  const [data, setData] = useState<SpaceData>(EMPTY);
  const seeded = useRef(false);

  useEffect(() => {
    const { db } = fb();
    const base = doc(db, "spaces", SPACE_ID);
    const col = (name: string) => collection(base, name);
    const patch = (p: Partial<SpaceData>) => setData((prev) => ({ ...prev, ...p }));
    const onErr = (e: FirestoreError) => {
      console.warn("[firestore]", e.code);
      patch({ sync: e.code === "permission-denied" ? "denied" : "error", loaded: true });
    };
    const unsubs: Array<() => void> = [];

    // Config doc doubles as the connection probe (metadata.fromCache).
    unsubs.push(
      onSnapshot(
        base,
        { includeMetadataChanges: true },
        (snap) => {
          patch({
            config: mergeConfig(snap.data()),
            loaded: true,
            sync: snap.metadata.fromCache ? (navigator.onLine ? "connecting" : "offline") : "online",
          });
          if (!snap.metadata.fromCache && !seeded.current) {
            seeded.current = true;
            void seedIfMissing().catch((e) => console.warn("seed failed", e));
          }
        },
        onErr,
      ),
    );

    unsubs.push(
      onSnapshot(
        query(col("items"), orderBy("createdAt", "desc")),
        { includeMetadataChanges: true },
        (s) => patch({ items: s.docs.map((d) => mapItem(d.id, d.data({ serverTimestamps: "estimate" }), d.metadata.hasPendingWrites)) }),
        onErr,
      ),
    );

    unsubs.push(
      onSnapshot(
        col("places"),
        (s) =>
          patch({
            places: s.docs.map((d) => {
              const x = d.data();
              return {
                id: d.id,
                name: str(x.name),
                city: x.city,
                region: x.region,
                country: x.country,
                lat: x.lat,
                lon: x.lon,
                providerId: x.providerId,
                createdAt: toDate(x.createdAt),
              };
            }),
          }),
        onErr,
      ),
    );

    unsubs.push(
      onSnapshot(
        col("travel"),
        (s) =>
          patch({
            travel: s.docs
              .map((d) => {
                const x = d.data({ serverTimestamps: "estimate" });
                return {
                  id: d.id,
                  date: str(x.date),
                  from: str(x.from),
                  to: str(x.to),
                  transport: str(x.transport),
                  by: x.by,
                  createdAt: toDate(x.createdAt),
                };
              })
              .sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0)),
          }),
        onErr,
      ),
    );

    unsubs.push(
      onSnapshot(
        col("fixed"),
        (s) => {
          if (s.empty) return; // keep defaults until seeded
          const byId = new Map(s.docs.map((d) => [d.id, d.data()]));
          patch({
            fixed: DEFAULT_FIXED_EVENTS.map((def) => {
              const x = byId.get(def.id);
              return x
                ? { id: def.id, kind: def.kind, date: str(x.date, def.date), title: str(x.title, def.title), city: str(x.city, def.city), note: str(x.note) }
                : def;
            }),
          });
        },
        onErr,
      ),
    );

    unsubs.push(
      onSnapshot(
        query(col("postcards"), orderBy("createdAt", "desc")),
        { includeMetadataChanges: true },
        (s) =>
          patch({
            postcards: s.docs.map((d) => {
              const x = d.data({ serverTimestamps: "estimate" });
              return {
                id: d.id,
                by: x.by,
                to: x.to,
                title: str(x.title),
                message: str(x.message),
                place: str(x.place),
                image: x.image ?? null,
                createdAt: toDate(x.createdAt),
                readAt: toDate(x.readAt),
                pending: d.metadata.hasPendingWrites,
              };
            }),
          }),
        onErr,
      ),
    );

    unsubs.push(
      onSnapshot(
        query(col("moments"), orderBy("date", "desc")),
        (s) =>
          patch({
            moments: s.docs.map((d) => {
              const x = d.data({ serverTimestamps: "estimate" });
              return { id: d.id, by: x.by, caption: str(x.caption), date: str(x.date), image: x.image ?? null, createdAt: toDate(x.createdAt) };
            }),
          }),
        onErr,
      ),
    );

    unsubs.push(
      onSnapshot(
        col("moods"),
        (s) => {
          const moods: SpaceData["moods"] = {};
          s.docs.forEach((d) => {
            const x = d.data({ serverTimestamps: "estimate" });
            moods[d.id as PersonKey] = {
              key: d.id as PersonKey,
              mood: x.mood ?? null,
              updatedAt: toDate(x.updatedAt),
              expiresAt: toDate(x.expiresAt),
              announced: x.announced !== false,
            };
          });
          patch({ moods });
        },
        onErr,
      ),
    );

    unsubs.push(
      onSnapshot(
        doc(base, "status", "location"),
        (s) => {
          const x = s.data({ serverTimestamps: "estimate" });
          patch({
            location: x
              ? {
                  name: str(x.name),
                  city: x.city,
                  country: x.country,
                  countryCode: x.countryCode,
                  lat: x.lat,
                  lon: x.lon,
                  source: x.source === "gps" ? "gps" : "manual",
                  updatedAt: toDate(x.updatedAt),
                }
              : DEFAULT_LOCATION,
          });
        },
        onErr,
      ),
    );

    unsubs.push(
      onSnapshot(
        query(col("events"), orderBy("createdAt", "desc"), limit(60)),
        (s) =>
          patch({
            events: s.docs.map((d) => {
              const x = d.data({ serverTimestamps: "estimate" });
              return {
                id: d.id,
                type: x.type,
                by: x.by,
                refId: x.refId ?? null,
                label: str(x.label),
                createdAt: toDate(x.createdAt),
                seen: x.seen ?? {},
              };
            }),
          }),
        onErr,
      ),
    );

    unsubs.push(
      onSnapshot(
        col("members"),
        (s) => {
          const members: SpaceData["members"] = {};
          s.docs.forEach((d) => (members[d.id as PersonKey] = d.data()));
          patch({ members });
        },
        onErr,
      ),
    );

    unsubs.push(
      onSnapshot(
        col("moodPhotos"),
        (s) =>
          patch({
            moodPhotos: s.docs.flatMap((d): MoodPhoto[] => {
              const x = d.data({ serverTimestamps: "estimate" });
              // Older pictures were stored at moodPhotos/{tier} and always uploaded by the owner.
              const tier = (typeof x.tier === "string" ? x.tier : d.id) as MoodId;
              const by: PersonKey = x.by === "alex" || x.by === "toby" ? x.by : OWNER;
              if (!MOODS.some((m) => m.id === tier)) return [];
              return [{ id: d.id, tier, by, imageId: str(x.imageId), createdAt: toDate(x.createdAt) }];
            })
              // Newest first, so a fresh upload wins over an older doc for the same tier.
              .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)),
          }),
        onErr,
      ),
    );

    const onOnline = () => setData((p) => ({ ...p, sync: p.sync === "offline" ? "connecting" : p.sync }));
    const onOffline = () => setData((p) => ({ ...p, sync: "offline" }));
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      unsubs.forEach((u) => u());
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [me]);

  return <Ctx.Provider value={data}>{children}</Ctx.Provider>;
}

export function useSpace() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSpace outside provider");
  return v;
}

/** Create the shared config + fixed anchors the first time, never overwriting existing data. */
async function seedIfMissing() {
  const { db } = fb();
  const base = doc(db, "spaces", SPACE_ID);
  await runTransaction(db, async (tx) => {
    const refs = [base, ...DEFAULT_FIXED_EVENTS.map((f) => doc(base, "fixed", f.id))];
    const snaps = await Promise.all(refs.map((r) => tx.get(r)));
    if (!snaps[0].exists()) tx.set(base, { ...DEFAULT_SPACE_CONFIG, createdAt: Timestamp.now() });
    DEFAULT_FIXED_EVENTS.forEach((f, i) => {
      if (!snaps[i + 1].exists()) {
        tx.set(refs[i + 1], { kind: f.kind, date: f.date, title: f.title, city: f.city, note: f.note });
      }
    });
  });
}

/* ------------------------------------------------------------------ */
/* Derived helpers                                                     */
/* ------------------------------------------------------------------ */

export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    const vis = () => document.visibilityState === "visible" && setNow(new Date());
    document.addEventListener("visibilitychange", vis);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", vis);
    };
  }, [intervalMs]);
  return now;
}

export function activeMood(m: Mood | undefined, now: Date) {
  if (!m || !m.mood) return null;
  if (m.expiresAt && m.expiresAt.getTime() < now.getTime()) return null;
  return m;
}

export function usePlacesById() {
  const { places } = useSpace();
  return useMemo(() => new Map(places.map((p) => [p.id, p])), [places]);
}
