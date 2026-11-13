"use client";

import {
  collection,
  doc,
  getDoc,
  getDocsFromCache,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { SPACE_ID, type PersonKey } from "@/config/app";
import { fb } from "./firebase";
import type { ImageRef } from "./types";

/**
 * Photos are resized + compressed on the device, then stored as two private
 * Firestore documents (full + thumb). This keeps every photo behind the same
 * security rules as the rest of the data (no public download URLs) and works
 * on Firebase's free plan.
 */

export interface PreparedImage {
  id: string;
  full: string; // data URL
  thumb: string;
  /** ~48 px preview (a couple of KB) shown in low data mode. */
  tiny: string;
  w: number;
  h: number;
}

const FULL = { max: 1600, budget: 880_000 };
const THUMB = { max: 640, budget: 110_000 };
const TINY = { max: 48, budget: 4_000 };

async function decode(file: Blob): Promise<{ source: CanvasImageSource; w: number; h: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, w: bmp.width, h: bmp.height, close: () => bmp.close() };
    } catch {
      /* fall through to <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { source: img, w: img.naturalWidth, h: img.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new Error("This image format couldn't be read. Try a JPEG or PNG.");
  }
}

function encode(source: CanvasImageSource, sw: number, sh: number, max: number, budget: number) {
  const scale = Math.min(1, max / Math.max(sw, sh));
  let w = Math.round(sw * scale);
  let h = Math.round(sh * scale);
  for (let attempt = 0; attempt < 6; attempt++) {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.fillStyle = "#f3eee4";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(source, 0, 0, w, h);
    for (const q of [0.82, 0.74, 0.66, 0.58]) {
      const data = canvas.toDataURL("image/jpeg", q);
      if (data.length <= budget) return { data, w, h };
    }
    w = Math.round(w * 0.8);
    h = Math.round(h * 0.8);
  }
  throw new Error("This photo is too large to store.");
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!file.type.startsWith("image/") && !/\.(heic|heif|jpe?g|png|webp|gif)$/i.test(file.name)) {
    throw new Error("Please choose an image file.");
  }
  if (file.size > 40 * 1024 * 1024) throw new Error("That file is over 40 MB.");
  const { source, w, h, close } = await decode(file);
  try {
    const full = encode(source, w, h, FULL.max, FULL.budget);
    const thumb = encode(source, w, h, THUMB.max, THUMB.budget);
    const tiny = encode(source, w, h, TINY.max, TINY.budget);
    return { id: crypto.randomUUID().replace(/-/g, ""), full: full.data, thumb: thumb.data, tiny: tiny.data, w: full.w, h: full.h };
  } finally {
    close();
  }
}

export const uploadRef = (p: PreparedImage): ImageRef => ({ kind: "upload", id: p.id, w: p.w, h: p.h });

/* ------------------------------------------------------------------ */
/* Reading                                                             */
/* ------------------------------------------------------------------ */

const memory = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

export function imageSrcSync(ref: ImageRef | null | undefined, variant: "thumb" | "full"): string | null {
  if (!ref) return null;
  if (ref.kind === "unsplash") return variant === "thumb" ? ref.thumb : ref.url;
  // Fall back to the other variant so a thumb can stand in while the full photo loads.
  const other = variant === "full" ? "thumb" : "full";
  return memory.get(`${variant}:${ref.id}`) ?? memory.get(`${other}:${ref.id}`) ?? null;
}

export function loadImage(ref: ImageRef, variant: "thumb" | "full"): Promise<string> {
  if (ref.kind === "unsplash") return Promise.resolve(variant === "thumb" ? ref.thumb : ref.url);
  const key = `${variant}:${ref.id}`;
  const hit = memory.get(key);
  if (hit) return Promise.resolve(hit);
  let p = inflight.get(key);
  if (!p) {
    p = getDoc(doc(fb().db, "spaces", SPACE_ID, variant === "thumb" ? "thumbs" : "images", ref.id))
      .then((snap) => {
        const data = snap.get("data");
        if (typeof data !== "string") throw new Error("Photo not found");
        memory.set(key, data);
        void ensureTiny(ref.id, data);
        return data;
      })
      .finally(() => inflight.delete(key));
    inflight.set(key, p);
  }
  return p;
}

/** Make a just-prepared image available immediately (before the server round-trip). */
export function primeImage(p: PreparedImage) {
  memory.set(`full:${p.id}`, p.full);
  memory.set(`thumb:${p.id}`, p.thumb);
  tinies.set(p.id, p.tiny);
  emitTinies();
}

/* ------------------------------------------------------------------ */
/* Tiny previews (low data mode)                                       */
/* ------------------------------------------------------------------ */

// All tiny previews are synced once and kept in the offline cache (~2 KB each), so low data
// mode can show every photo without downloading the real one.
const tinies = new Map<string, string>();
const tinyListeners = new Set<() => void>();
let tinyVersion = 0;
let tiniesReady = false;
let tinyAuthor: PersonKey | null = null;
const tinyAttempted = new Set<string>();

function emitTinies() {
  tinyVersion++;
  tinyListeners.forEach((l) => l());
}

export function subscribeTinies(l: () => void) {
  tinyListeners.add(l);
  return () => {
    tinyListeners.delete(l);
  };
}
export const tinyVersionSnapshot = () => tinyVersion;

/**
 * Starts syncing tiny previews (called once the space is open). Previews already on the
 * phone are read from the offline cache; only ones created since then are fetched, so each
 * preview is downloaded once. Returns an unsubscribe.
 */
export function startTinySync(me: PersonKey) {
  tinyAuthor = me;
  const col = collection(fb().db, "spaces", SPACE_ID, "tinies");
  let stopped = false;
  let unsub = () => {};
  let latest = 0;
  const take = (d: QueryDocumentSnapshot) => {
    const data = d.get("data");
    if (typeof data === "string") tinies.set(d.id, data);
    const t = d.get("createdAt");
    if (t instanceof Timestamp) latest = Math.max(latest, t.toMillis());
  };

  void getDocsFromCache(col)
    .then((snap) => {
      snap.docs.forEach(take);
      if (snap.size) emitTinies();
    })
    .catch(() => {})
    .then(() => {
      if (stopped) return;
      // An hour of overlap covers previews the other phone saved while this one was offline.
      const q = latest ? query(col, where("createdAt", ">", Timestamp.fromMillis(latest - 3_600_000))) : col;
      unsub = onSnapshot(
        q,
        (s) => {
          s.docs.forEach(take);
          tiniesReady = true;
          emitTinies();
        },
        () => {},
      );
    });

  return () => {
    stopped = true;
    unsub();
  };
}

/**
 * Fills in previews for photos uploaded before previews existed. Runs only while photos are
 * in full quality: it loads each missing photo's small version once and shrinks it.
 */
export async function backfillTinies(refs: ImageRef[]) {
  for (const ref of refs) {
    if (!tiniesReady) return;
    if (ref.kind !== "upload" || tinies.has(ref.id) || tinyAttempted.has(ref.id)) continue;
    try {
      const data = memory.get(`thumb:${ref.id}`) ?? (await loadImage(ref, "thumb"));
      await ensureTiny(ref.id, data);
    } catch {
      tinyAttempted.add(ref.id); // photo gone — don't retry this session
    }
  }
}

/** The low-data stand-in for a photo: a synced tiny preview, or a very small Unsplash size. */
export function tinySrc(ref: ImageRef | null | undefined): string | null {
  if (!ref) return null;
  if (ref.kind === "unsplash") {
    try {
      const u = new URL(ref.thumb);
      u.searchParams.set("w", "48");
      u.searchParams.set("q", "40");
      return u.toString();
    } catch {
      return null;
    }
  }
  return tinies.get(ref.id) ?? null;
}

/**
 * Photos uploaded before tiny previews existed get one the first time anyone loads them
 * in full quality. Create-only on the server, so a race between both phones is harmless.
 */
async function ensureTiny(id: string, dataUrl: string) {
  if (!tiniesReady || !tinyAuthor || tinies.has(id) || tinyAttempted.has(id)) return;
  tinyAttempted.add(id);
  try {
    const img = new Image();
    img.src = dataUrl;
    await img.decode();
    const { data } = encode(img, img.naturalWidth, img.naturalHeight, TINY.max, TINY.budget);
    tinies.set(id, data);
    emitTinies();
    await setDoc(doc(fb().db, "spaces", SPACE_ID, "tinies", id), { data, by: tinyAuthor, createdAt: serverTimestamp() });
  } catch {
    // Already exists or offline — someone else (or a later load) will fill it in.
  }
}
