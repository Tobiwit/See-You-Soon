"use client";

import {
  collection,
  deleteField,
  doc,
  runTransaction,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  writeBatch,
  type DocumentReference,
  type WriteBatch,
} from "firebase/firestore";
import { MOOD_ANNOUNCE_DELAY_MS, SPACE_ID, THINKING_COOLDOWN_MS, type ItemType, type MoodId, type PersonKey, type SpaceConfig } from "@/config/app";
import { fb } from "./firebase";
import { primeImage, uploadRef, type PreparedImage } from "./images";
import { authedFetch } from "./session";
import type { ActivityType, FixedEvent, ImageRef, WishItem } from "./types";

/**
 * Every write here resolves only once the Firestore backend has acknowledged
 * it, so callers can show "saved"/"sent" honestly. While offline the promise
 * stays pending (the write is queued) — callers show that state instead.
 */

const base = () => doc(fb().db, "spaces", SPACE_ID);
const ref = (c: string, id?: string) => (id ? doc(base(), c, id) : doc(collection(base(), c)));

function putImage(batch: WriteBatch, img: PreparedImage, by: PersonKey) {
  primeImage(img);
  batch.set(ref("images", img.id), { data: img.full, w: img.w, h: img.h, by, createdAt: serverTimestamp() });
  batch.set(ref("thumbs", img.id), { data: img.thumb, by, createdAt: serverTimestamp() });
}

function dropImage(batch: WriteBatch, image: ImageRef | null | undefined) {
  if (image?.kind === "upload") {
    batch.delete(ref("images", image.id));
    batch.delete(ref("thumbs", image.id));
  }
}

function addEvent(batch: WriteBatch, by: PersonKey, type: ActivityType, refId: string | null, label: string) {
  const r = ref("events");
  batch.set(r, { type, by, refId, label: label.slice(0, 120), createdAt: serverTimestamp(), seen: { [by]: true } });
  return r;
}

/** Fire-and-forget push to the other person. Never blocks in-app activity. */
export function notifyPartner(type: ActivityType, label: string, refId: string | null) {
  if (!process.env.NEXT_PUBLIC_PUSH_ENABLED) return;
  void authedFetch("/api/push/send", { method: "POST", body: JSON.stringify({ type, label, refId }) }).catch(() => {});
}

/* ------------------------------------------------------------------ */
/* Places                                                              */
/* ------------------------------------------------------------------ */

export interface PlaceInput {
  existingId?: string;
  name: string;
  city?: string;
  region?: string;
  country?: string;
  lat?: number;
  lon?: number;
  providerId?: string;
}

function resolvePlace(batch: WriteBatch, p: PlaceInput, by: PersonKey): { id: string; name: string } {
  if (p.existingId) return { id: p.existingId, name: p.name };
  const r = ref("places");
  const clean: Record<string, unknown> = { name: p.name.trim().slice(0, 80), by, createdAt: serverTimestamp() };
  for (const k of ["city", "region", "country", "providerId"] as const) if (p[k]) clean[k] = p[k];
  if (typeof p.lat === "number" && typeof p.lon === "number") {
    clean.lat = Math.round(p.lat * 1e5) / 1e5;
    clean.lon = Math.round(p.lon * 1e5) / 1e5;
  }
  batch.set(r, clean);
  return { id: r.id, name: clean.name as string };
}

/* ------------------------------------------------------------------ */
/* Wishlist                                                            */
/* ------------------------------------------------------------------ */

export interface ItemInput {
  title: string;
  description: string;
  type: ItemType;
  place: PlaceInput;
  desiredDate: string | null;
  url: string | null;
  /** new upload, a remote (licensed) image, keep existing (undefined) or remove (null) */
  image?: PreparedImage | Extract<ImageRef, { kind: "unsplash" }> | null;
}

function imageFieldFor(batch: WriteBatch, input: ItemInput["image"], by: PersonKey): ImageRef | null | undefined {
  if (input === undefined) return undefined;
  if (input === null) return null;
  if ("full" in input) {
    putImage(batch, input, by);
    return uploadRef(input);
  }
  return input;
}

export async function addItem(me: PersonKey, input: ItemInput) {
  const batch = writeBatch(fb().db);
  const place = resolvePlace(batch, input.place, me);
  const r = ref("items");
  const image = imageFieldFor(batch, input.image, me) ?? null;
  batch.set(r, {
    title: input.title.trim(),
    description: input.description.trim(),
    type: input.type,
    placeId: place.id,
    placeName: place.name,
    desiredDate: input.desiredDate,
    url: input.url,
    image,
    by: me,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    visited: false,
    visitNote: "",
    visitImage: null,
    plannedDate: null,
    plannedOrder: 0,
  });
  addEvent(batch, me, "wishlist_item_added", r.id, input.title.trim());
  await batch.commit();
  notifyPartner("wishlist_item_added", input.title.trim(), r.id);
  return r.id;
}

export class ConflictError extends Error {
  constructor(public fields: string[]) {
    super("Changed by the other person while you were editing");
  }
}

/**
 * Edit with optimistic concurrency: if any field you're changing was changed
 * on the server since you opened the form, nothing is written and a
 * ConflictError is thrown so the UI can ask what to do.
 */
export async function updateItem(me: PersonKey, original: WishItem, input: ItemInput, force = false) {
  const { db } = fb();
  const itemRef = ref("items", original.id);

  // New place / photo docs go first so the item never points at a missing photo.
  const side = writeBatch(db);
  const place = resolvePlace(side, input.place, me);
  const image = imageFieldFor(side, input.image, me);
  const hasSide = Boolean(!input.place.existingId || (input.image && "full" in input.image));
  if (hasSide) await side.commit();

  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(itemRef);
      if (!snap.exists()) throw new Error("This idea was deleted.");
      const server = snap.data();
      const watched: Array<[string, unknown, unknown]> = [
        ["title", server.title, original.title],
        ["description", server.description ?? "", original.description],
        ["type", server.type, original.type],
        ["place", server.placeId, original.placeId],
        ["date", server.desiredDate ?? null, original.desiredDate],
        ["link", server.url ?? null, original.url],
        ["photo", JSON.stringify(server.image ?? null), JSON.stringify(original.image ?? null)],
      ];
      const changed = watched.filter(([, a, b]) => a !== b).map(([k]) => k);
      if (changed.length && !force) throw new ConflictError(changed);
      const patch: Record<string, unknown> = {
        title: input.title.trim(),
        description: input.description.trim(),
        type: input.type,
        placeId: place.id,
        placeName: place.name,
        desiredDate: input.desiredDate,
        url: input.url,
        updatedAt: serverTimestamp(),
      };
      if (image !== undefined) patch.image = image;
      tx.update(itemRef, patch);
    });
  } catch (e) {
    // Roll back the freshly uploaded photo; keep the (harmless) place.
    if (input.image && "full" in input.image) {
      const undo = writeBatch(db);
      dropImage(undo, uploadRef(input.image));
      void undo.commit().catch(() => {});
    }
    throw e;
  }

  if (image !== undefined && original.image?.kind === "upload") {
    const cleanup = writeBatch(db);
    dropImage(cleanup, original.image);
    void cleanup.commit().catch(() => {});
  }
}

export async function deleteItem(item: WishItem) {
  const batch = writeBatch(fb().db);
  batch.delete(ref("items", item.id));
  dropImage(batch, item.image);
  dropImage(batch, item.visitImage);
  await batch.commit();
}

export async function assignItem(me: PersonKey, item: WishItem, date: string | null) {
  const batch = writeBatch(fb().db);
  batch.update(ref("items", item.id), {
    plannedDate: date,
    plannedOrder: Date.now(),
    updatedAt: serverTimestamp(),
  });
  if (date) addEvent(batch, me, "planner_item_assigned", item.id, item.title);
  await batch.commit();
}

export async function setVisited(
  me: PersonKey,
  item: WishItem,
  visited: boolean,
  memory?: { note: string; image?: PreparedImage | null },
) {
  const batch = writeBatch(fb().db);
  const patch: Record<string, unknown> = { visited, updatedAt: serverTimestamp() };
  if (visited) {
    patch.visitedAt = serverTimestamp();
    if (memory) {
      patch.visitNote = memory.note.trim().slice(0, 600);
      if (memory.image) {
        putImage(batch, memory.image, me);
        dropImage(batch, item.visitImage);
        patch.visitImage = uploadRef(memory.image);
      }
    }
  } else {
    patch.visitedAt = deleteField();
  }
  batch.update(ref("items", item.id), patch);
  await batch.commit();
}

/* ------------------------------------------------------------------ */
/* Planner                                                             */
/* ------------------------------------------------------------------ */

export async function saveTravel(
  me: PersonKey,
  input: { id?: string; date: string; from: string; to: string; transport: string },
) {
  const data = {
    date: input.date,
    from: input.from.trim().slice(0, 80),
    to: input.to.trim().slice(0, 80),
    transport: input.transport.trim().slice(0, 120),
  };
  if (input.id) await updateDoc(ref("travel", input.id), { ...data, updatedAt: serverTimestamp() });
  else await setDoc(ref("travel"), { ...data, by: me, createdAt: serverTimestamp() });
}

export async function deleteTravel(id: string) {
  const batch = writeBatch(fb().db);
  batch.delete(ref("travel", id));
  await batch.commit();
}

export async function saveFixed(ev: FixedEvent) {
  await updateDoc(ref("fixed", ev.id), {
    date: ev.date,
    title: ev.title.trim().slice(0, 100),
    city: ev.city.trim().slice(0, 80),
    note: ev.note.trim().slice(0, 300),
  });
}

/* ------------------------------------------------------------------ */
/* Postcards & moments                                                 */
/* ------------------------------------------------------------------ */

export async function sendPostcard(
  me: PersonKey,
  to: PersonKey,
  input: { title: string; message: string; place: string; image: PreparedImage | null },
) {
  const batch = writeBatch(fb().db);
  if (input.image) putImage(batch, input.image, me);
  const r = ref("postcards");
  batch.set(r, {
    by: me,
    to,
    title: input.title.trim().slice(0, 80),
    message: input.message.trim().slice(0, 1200),
    place: input.place.trim().slice(0, 80),
    image: input.image ? uploadRef(input.image) : null,
    createdAt: serverTimestamp(),
    readAt: null,
  });
  addEvent(batch, me, "postcard_created", r.id, input.title.trim());
  await batch.commit();
  notifyPartner("postcard_created", input.title.trim(), r.id);
  return r.id;
}

/** Sender only (enforced by the rules): removes the postcard, its photo and its activity entries. */
export async function deletePostcard(postcard: { id: string; image: ImageRef | null }, eventIds: string[]) {
  const batch = writeBatch(fb().db);
  batch.delete(ref("postcards", postcard.id));
  dropImage(batch, postcard.image);
  for (const id of eventIds) batch.delete(ref("events", id));
  await batch.commit();
}

export async function markPostcardRead(id: string) {
  await updateDoc(ref("postcards", id), { readAt: serverTimestamp() });
}

export async function addMoment(me: PersonKey, input: { caption: string; date: string; image: PreparedImage | null }) {
  const batch = writeBatch(fb().db);
  if (input.image) putImage(batch, input.image, me);
  const r = ref("moments");
  batch.set(r, {
    by: me,
    caption: input.caption.trim().slice(0, 300),
    date: input.date,
    image: input.image ? uploadRef(input.image) : null,
    createdAt: serverTimestamp(),
  });
  addEvent(batch, me, "moment_added", r.id, input.caption.trim());
  await batch.commit();
  notifyPartner("moment_added", input.caption.trim(), r.id);
}

export async function deleteMoment(id: string, image: ImageRef | null) {
  const batch = writeBatch(fb().db);
  batch.delete(ref("moments", id));
  dropImage(batch, image);
  await batch.commit();
}

/* ------------------------------------------------------------------ */
/* Signals                                                             */
/* ------------------------------------------------------------------ */

export async function thinkingOfYou(me: PersonKey, lastSentAt: Date | null) {
  if (lastSentAt && Date.now() - lastSentAt.getTime() < THINKING_COOLDOWN_MS) return "cooldown" as const;
  const batch = writeBatch(fb().db);
  const r = addEvent(batch, me, "thinking_of_you", null, "");
  await batch.commit();
  notifyPartner("thinking_of_you", "", r.id);
  return "sent" as const;
}

/**
 * Saves the mood right away but does *not* announce it yet — see announceMood.
 * Flicking through a few moods therefore only produces one activity entry/push.
 */
export async function setMood(me: PersonKey, mood: MoodId | null, expiryHours: number) {
  await setDoc(ref("moods", me), {
    mood,
    updatedAt: serverTimestamp(),
    expiresAt: mood ? Timestamp.fromMillis(Date.now() + expiryHours * 3_600_000) : null,
    announced: !mood, // clearing never announces
  });
}

/**
 * Creates the "mood updated" activity (and push) once the mood has been unchanged for
 * MOOD_ANNOUNCE_DELAY_MS. Runs in a transaction so it re-checks the server copy and never
 * announces twice. Returns true if it announced.
 */
export async function announceMood(me: PersonKey): Promise<boolean> {
  const { db } = fb();
  const moodRef = ref("moods", me);
  const announced = await runTransaction(db, async (tx) => {
    const snap = await tx.get(moodRef);
    const x = snap.data();
    if (!x || x.announced !== false || !x.mood) return null;
    const updated = x.updatedAt instanceof Timestamp ? x.updatedAt.toMillis() : 0;
    if (Date.now() - updated < MOOD_ANNOUNCE_DELAY_MS - 1000) return null; // changed again meanwhile
    const expired = x.expiresAt instanceof Timestamp && x.expiresAt.toMillis() < Date.now();
    tx.update(moodRef, { announced: true });
    if (expired) return null;
    const ev = ref("events");
    tx.set(ev, { type: "mood_updated", by: me, refId: null, label: x.mood, createdAt: serverTimestamp(), seen: { [me]: true } });
    return x.mood as string;
  });
  if (announced) notifyPartner("mood_updated", announced, null);
  return Boolean(announced);
}

export async function markEventSeen(me: PersonKey, id: string) {
  await updateDoc(ref("events", id), { [`seen.${me}`]: true });
}

export async function shareLocation(
  me: PersonKey,
  loc: { name: string; city?: string; country?: string; countryCode?: string; lat?: number; lon?: number; source: "gps" | "manual" },
) {
  const batch = writeBatch(fb().db);
  const data: Record<string, unknown> = { name: loc.name.slice(0, 80), source: loc.source, updatedAt: serverTimestamp(), by: me };
  for (const k of ["city", "country", "countryCode"] as const) if (loc[k]) data[k] = loc[k];
  // ~1 km precision is plenty for a "currently in" line and the journey map.
  if (typeof loc.lat === "number" && typeof loc.lon === "number") {
    data.lat = Math.round(loc.lat * 100) / 100;
    data.lon = Math.round(loc.lon * 100) / 100;
  }
  batch.set(ref("status", "location"), data);
  addEvent(batch, me, "location_updated", null, loc.city || loc.name);
  await batch.commit();
  notifyPartner("location_updated", loc.city || loc.name, null);
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export async function updateConfig(patch: Partial<SpaceConfig>) {
  await updateDoc(base(), { ...patch, updatedAt: serverTimestamp() });
}

export async function setCover(me: PersonKey, img: PreparedImage | null, previousId: string | null) {
  const batch = writeBatch(fb().db);
  if (img) putImage(batch, img, me);
  if (previousId) dropImage(batch, { kind: "upload", id: previousId, w: 0, h: 0 });
  batch.update(base(), { coverImageId: img ? img.id : null });
  await batch.commit();
}

/* ------------------------------------------------------------------ */
/* Mood pictures — each person uploads a set for the other to see     */
/* ------------------------------------------------------------------ */

/** Doc id for my picture of a tier: "{me}_{tier}". */
export const moodPhotoId = (by: PersonKey, tier: MoodId) => `${by}_${tier}`;

/**
 * One picture per uploader and mood tier, stored at moodPhotos/{me}_{tier}.
 * Replaces (and cleans up) any previous one, including an older doc stored under another id.
 */
export async function setMoodPhoto(me: PersonKey, tier: MoodId, img: PreparedImage, previous: { id: string; imageId: string } | null) {
  const batch = writeBatch(fb().db);
  const id = moodPhotoId(me, tier);
  putImage(batch, img, me);
  batch.set(ref("moodPhotos", id), { imageId: img.id, tier, by: me, createdAt: serverTimestamp() });
  if (previous) {
    if (previous.id !== id) batch.delete(ref("moodPhotos", previous.id));
    dropImage(batch, { kind: "upload", id: previous.imageId, w: 0, h: 0 });
  }
  await batch.commit();
}

export async function removeMoodPhoto(id: string, imageId: string) {
  const batch = writeBatch(fb().db);
  batch.delete(ref("moodPhotos", id));
  dropImage(batch, { kind: "upload", id: imageId, w: 0, h: 0 });
  await batch.commit();
}

export async function savePushSubscription(me: PersonKey, sub: PushSubscriptionJSON | null) {
  const r: DocumentReference = ref("members", me);
  await setDoc(
    r,
    sub ? { push: { endpoint: sub.endpoint, keys: sub.keys }, updatedAt: serverTimestamp() } : { push: deleteField(), updatedAt: serverTimestamp() },
    { merge: true },
  );
}
