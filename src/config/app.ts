/**
 * Static, code-level configuration.
 *
 * Anything the two of you might want to change *while using the app* (dates,
 * reunion time, route) lives in Firestore (`spaces/main`) and is editable in
 * Settings. The values in DEFAULT_SPACE_CONFIG are only used to seed that
 * document the very first time someone signs in.
 */

export type PersonKey = "alex" | "toby";

export const PEOPLE: Record<PersonKey, { key: PersonKey; name: string }> = {
  alex: { key: "alex", name: "Alex" },
  toby: { key: "toby", name: "Toby" },
};

/** The person whose journey is drawn on the map and who can share a location. */
export const TRAVELLER: PersonKey = "alex";

export const partnerOf = (k: PersonKey): PersonKey => (k === "alex" ? "toby" : "alex");

export const SPACE_ID = "main";

/* ------------------------------------------------------------------ */
/* Wishlist categories — extend here.                                  */
/* ------------------------------------------------------------------ */

export const ITEM_TYPES = [
  { id: "activity", label: "Activity", short: "Do" },
  { id: "hotel", label: "Hotel / Stay", short: "Stay" },
  { id: "food", label: "Food", short: "Eat" },
  { id: "place", label: "Place / Sight", short: "See" },
  { id: "transport", label: "Transport", short: "Move" },
  { id: "other", label: "Other", short: "Misc" },
] as const;

export type ItemType = (typeof ITEM_TYPES)[number]["id"];

export const typeLabel = (t: string) => ITEM_TYPES.find((x) => x.id === t)?.label ?? "Other";

/* ------------------------------------------------------------------ */
/* Mood scale                                                          */
/* ------------------------------------------------------------------ */

export const MOODS = [
  { id: "innocent", emoji: "😇", label: "Innocent" },
  { id: "sweet", emoji: "🙂", label: "Sweet" },
  { id: "flirty", emoji: "😉", label: "Flirty" },
  { id: "not-so-innocent", emoji: "😏", label: "Not so innocent" },
  { id: "distracted", emoji: "🔥", label: "Very distracted" },
] as const;

export type MoodId = (typeof MOODS)[number]["id"];

/* ------------------------------------------------------------------ */
/* Shared configuration (seed values)                                  */
/* ------------------------------------------------------------------ */

export interface RouteStop {
  id: string;
  name: string; // label shown on the map, e.g. "Japan"
  lat: number;
  lon: number;
}

export interface SpaceConfig {
  title: string;
  /** IANA timezone used for every calendar-day calculation. */
  timezone: string;
  /** First day apart (YYYY-MM-DD, in `timezone`). */
  separationStart: string;
  /** Reunion local date + time in `timezone`. */
  reunionDate: string;
  reunionTime: string; // HH:mm
  reunionPlace: string;
  tripStart: string; // YYYY-MM-DD
  tripEnd: string; // YYYY-MM-DD
  route: RouteStop[];
  moodExpiryHours: number;
  coverImageId: string | null;
}

/**
 * Seed values. Dec 7–20 come from the brief. The separation start (10 Oct) and
 * the 12:00 reunion time were taken from your earlier prototype — both can be
 * changed in Settings.
 * Route stops are country-level anchors (capital coordinates) until you add the
 * real cities in Settings.
 */
export const DEFAULT_SPACE_CONFIG: SpaceConfig = {
  title: "See You Soon",
  timezone: "Asia/Ho_Chi_Minh",
  separationStart: "2026-10-10",
  reunionDate: "2026-12-07",
  reunionTime: "12:00",
  reunionPlace: "Hanoi",
  tripStart: "2026-12-07",
  tripEnd: "2026-12-20",
  route: [
    { id: "uz", name: "Uzbekistan", lat: 41.3111, lon: 69.2797 },
    { id: "jp", name: "Japan", lat: 35.6762, lon: 139.6503 },
    { id: "kr", name: "South Korea", lat: 37.5665, lon: 126.978 },
    { id: "vn", name: "Vietnam", lat: 21.0278, lon: 105.8342 },
  ],
  moodExpiryHours: 6,
  coverImageId: null,
};

export const DEFAULT_FIXED_EVENTS = [
  {
    id: "arrival",
    kind: "arrival" as const,
    date: "2026-12-07",
    title: "Toby arrives in Hanoi",
    city: "Hanoi",
    note: "",
  },
  {
    id: "departure",
    kind: "departure" as const,
    date: "2026-12-20",
    title: "Both leave from Ho Chi Minh City",
    city: "Ho Chi Minh City",
    note: "",
  },
];

export const THINKING_COOLDOWN_MS = 90_000;
