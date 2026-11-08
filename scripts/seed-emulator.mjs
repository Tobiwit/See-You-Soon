// LOCAL DEVELOPMENT ONLY — fills the Firebase *emulator* with clearly-marked
// sample content so the UI can be checked. Refuses to run against a real project.
//
//   npm run emulators            (terminal 1)
//   node scripts/seed-emulator.mjs   (terminal 2)
import { initializeApp } from "firebase/app";
import { connectAuthEmulator, getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import {
  collection,
  connectFirestoreEmulator,
  doc,
  getFirestore,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from "firebase/firestore";
import sharp from "sharp";

const PROJECT = "demo-sys";
// Same emails as firestore.rules / .env.local (emulator-only accounts).
const ALEX = (process.env.ALEX_EMAIL || "alex@example.com").toLowerCase();
const TOBY = (process.env.TOBY_EMAIL || "toby@example.com").toLowerCase();
const PASSWORD = "reunion-test-1";

const app = initializeApp({ apiKey: "demo-key", projectId: PROJECT, appId: "1:0:web:demo" });
const auth = getAuth(app);
connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
const db = getFirestore(app);
connectFirestoreEmulator(db, "127.0.0.1", 8080);

async function ensureUser(email) {
  await fetch(`http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  }).catch(() => {});
}

async function sampleImage(w, h, a, b, label) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <circle cx="${w * 0.7}" cy="${h * 0.35}" r="${Math.min(w, h) * 0.18}" fill="#f3eee4" opacity="0.55"/>
    <text x="24" y="${h - 28}" font-family="Arial" font-size="${Math.round(w / 22)}" fill="#ffffff" opacity="0.7">SAMPLE · ${label}</text>
  </svg>`;
  const full = await sharp(Buffer.from(svg)).jpeg({ quality: 78 }).toBuffer();
  const thumb = await sharp(Buffer.from(svg)).resize(Math.round(w / 2.5)).jpeg({ quality: 70 }).toBuffer();
  return {
    id: Math.random().toString(36).slice(2) + Date.now().toString(36),
    full: `data:image/jpeg;base64,${full.toString("base64")}`,
    thumb: `data:image/jpeg;base64,${thumb.toString("base64")}`,
    w,
    h,
  };
}

const base = doc(db, "spaces", "main");

async function asUser(email, fn) {
  await signInWithEmailAndPassword(auth, email, PASSWORD);
  try {
    await fn(email === ALEX ? "alex" : "toby");
  } finally {
    await signOut(auth);
  }
}

async function addPlace(batch, by, name, lat, lon) {
  const r = doc(collection(base, "places"));
  batch.set(r, { name, city: name, country: "Vietnam", lat, lon, by, createdAt: serverTimestamp() });
  return { id: r.id, name };
}

async function addItem(batch, by, place, { title, type, description = "", image = null, url = null, plannedDate = null, visited = false }) {
  if (image) {
    batch.set(doc(base, "images", image.id), { data: image.full, w: image.w, h: image.h, by, createdAt: serverTimestamp() });
    batch.set(doc(base, "thumbs", image.id), { data: image.thumb, by, createdAt: serverTimestamp() });
  }
  const r = doc(collection(base, "items"));
  batch.set(r, {
    title,
    description,
    type,
    placeId: place.id,
    placeName: place.name,
    desiredDate: null,
    url,
    image: image ? { kind: "upload", id: image.id, w: image.w, h: image.h } : null,
    by,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    visited,
    visitNote: visited ? "Sample note: we went twice." : "",
    visitImage: null,
    plannedDate,
    plannedOrder: Date.now(),
  });
  batch.set(doc(collection(base, "events")), {
    type: "wishlist_item_added",
    by,
    refId: r.id,
    label: title,
    createdAt: serverTimestamp(),
    seen: { [by]: true },
  });
  return r.id;
}

for (const e of [ALEX, TOBY]) await ensureUser(e);

await asUser(TOBY, async (me) => {
  const b = writeBatch(db);
  const hanoi = await addPlace(b, me, "Hanoi", 21.0285, 105.8542);
  const hoian = await addPlace(b, me, "Hội An", 15.8801, 108.338);
  const halong = await addPlace(b, me, "Hạ Long Bay", 20.9101, 107.1839);
  await addItem(b, me, hanoi, { title: "Egg coffee at Giảng", type: "food", image: await sampleImage(1200, 1500, "#6b3d1e", "#d9a066", "egg coffee"), plannedDate: "2026-12-08" });
  await addItem(b, me, halong, { title: "Overnight junk boat", type: "hotel", description: "One night on the bay.", image: await sampleImage(1600, 1000, "#0f3c5c", "#7fb0b8", "bay") });
  await addItem(b, me, hoian, { title: "Lantern night walk", type: "activity", image: await sampleImage(1200, 1200, "#3a1450", "#ff8a3d", "lanterns") });
  await addItem(b, me, hanoi, { title: "Train Street", type: "place", url: "https://example.com" });
  await addItem(b, me, hoian, { title: "Tailor a linen shirt", type: "other" });
  // A sample background for the mood section (Toby-only).
  const bg = await sampleImage(1200, 1500, "#2a1020", "#c46a8a", "mood background");
  b.set(doc(base, "images", bg.id), { data: bg.full, w: bg.w, h: bg.h, by: me, createdAt: serverTimestamp() });
  b.set(doc(base, "thumbs", bg.id), { data: bg.thumb, by: me, createdAt: serverTimestamp() });
  b.set(doc(collection(base, "moodPhotos")), { imageId: bg.id, by: me, createdAt: serverTimestamp() });
  await b.commit();
});

await asUser(ALEX, async (me) => {
  const b = writeBatch(db);
  const hcmc = await addPlace(b, me, "Ho Chi Minh City", 10.7769, 106.7009);
  await addItem(b, me, hcmc, { title: "Bánh mì Huỳnh Hoa", type: "food", image: await sampleImage(1500, 1000, "#7a2d12", "#f2c14e", "banh mi") });
  await addItem(b, me, hcmc, { title: "Sleeper bus north", type: "transport" });
  b.set(doc(collection(base, "travel")), { date: "2026-12-11", from: "Hanoi", to: "Hội An", transport: "Night train", by: me, createdAt: serverTimestamp() });

  const img = await sampleImage(1500, 1000, "#1b2a6b", "#e85d2a", "postcard");
  b.set(doc(base, "images", img.id), { data: img.full, w: img.w, h: img.h, by: me, createdAt: serverTimestamp() });
  b.set(doc(base, "thumbs", img.id), { data: img.thumb, by: me, createdAt: serverTimestamp() });
  const pc = doc(collection(base, "postcards"));
  b.set(pc, {
    by: me,
    to: "toby",
    title: "Greetings from Seoul",
    message: "Sample postcard. The subway plays a little melody at every transfer and I keep humming it.\n\nTwenty-eight days.",
    place: "Seoul",
    image: { kind: "upload", id: img.id, w: img.w, h: img.h },
    createdAt: serverTimestamp(),
    readAt: null,
  });
  b.set(doc(collection(base, "events")), { type: "postcard_created", by: me, refId: pc.id, label: "Greetings from Seoul", createdAt: serverTimestamp(), seen: { [me]: true } });
  b.set(doc(base, "moods", me), { mood: "not-so-innocent", updatedAt: serverTimestamp(), expiresAt: Timestamp.fromMillis(Date.now() + 6 * 3600e3) });
  await b.commit();
});

console.log("Seeded sample data into the emulator.");
process.exit(0);
