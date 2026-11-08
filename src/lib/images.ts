"use client";

import { doc, getDoc } from "firebase/firestore";
import { SPACE_ID } from "@/config/app";
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
  w: number;
  h: number;
}

const FULL = { max: 1600, budget: 880_000 };
const THUMB = { max: 640, budget: 110_000 };

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
    return { id: crypto.randomUUID().replace(/-/g, ""), full: full.data, thumb: thumb.data, w: full.w, h: full.h };
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
}
