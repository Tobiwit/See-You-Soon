/**
 * Date helpers. All calendar-day logic works on "day keys" (YYYY-MM-DD) that are
 * interpreted in an explicit IANA timezone, never the device's local zone.
 * Instants are plain JS Dates (UTC under the hood).
 */

const DAY_MS = 86_400_000;

const dtfCache = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(tz: string) {
  let f = dtfCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    dtfCache.set(tz, f);
  }
  return f;
}

function zonedParts(date: Date, tz: string) {
  const out: Record<string, number> = {};
  for (const p of partsFormatter(tz).formatToParts(date)) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return out as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

/** Offset of `tz` from UTC at `date`, in ms (e.g. +7h for Vietnam). */
export function tzOffsetMs(date: Date, tz: string): number {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** The calendar day (YYYY-MM-DD) that `date` falls on in `tz`. */
export function dayKeyInTz(date: Date, tz: string): string {
  const p = zonedParts(date, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Convert a wall-clock time in `tz` to an instant. DST-safe (two-pass). */
export function zonedToInstant(dayKey: string, time: string, tz: string): Date {
  const [y, m, d] = dayKey.split("-").map(Number);
  const [hh, mm] = (time || "00:00").split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh || 0, mm || 0);
  let ts = guess - tzOffsetMs(new Date(guess), tz);
  const second = guess - tzOffsetMs(new Date(ts), tz);
  if (second !== ts) ts = second;
  return new Date(ts);
}

export const startOfDayInTz = (dayKey: string, tz: string) => zonedToInstant(dayKey, "00:00", tz);

function keyToUtcNoon(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d, 12);
}

export function addDays(key: string, n: number): string {
  const t = new Date(keyToUtcNoon(key) + n * DAY_MS);
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Whole days from a to b (b - a). Same day = 0. */
export function diffDays(a: string, b: string): number {
  return Math.round((keyToUtcNoon(b) - keyToUtcNoon(a)) / DAY_MS);
}

/** Inclusive list of day keys from start to end. */
export function eachDay(start: string, end: string): string[] {
  const n = diffDays(start, end);
  if (n < 0 || n > 800) return [];
  return Array.from({ length: n + 1 }, (_, i) => addDays(start, i));
}

export function isDayKey(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

/** Format a day key without any timezone drift. */
export function formatDay(key: string, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: "UTC" }).format(new Date(keyToUtcNoon(key)));
}

export function formatInstant(date: Date, tz: string, opts: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: tz }).format(date);
}

export function tzShortName(tz: string, at: Date = new Date()): string {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: tz, timeZoneName: "short" })
    .formatToParts(at)
    .find((x) => x.type === "timeZoneName");
  return p?.value ?? tz;
}

export function relativeTime(then: Date | null | undefined, now = new Date()): string {
  if (!then) return "";
  const s = Math.round((now.getTime() - then.getTime()) / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  if (d === 1) return "yesterday";
  if (d < 7) return `${d} days ago`;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(then);
}

/** Nearest "nice" fraction (denominator 2–10) for a 0..1 value. */
export function niceFraction(x: number): { n: number; d: number; delta: number } {
  let best = { n: 0, d: 1, delta: Infinity };
  for (let d = 2; d <= 10; d++) {
    const n = Math.round(x * d);
    if (n <= 0 || n >= d) continue;
    const delta = x - n / d;
    if (Math.abs(delta) < Math.abs(best.delta) - 1e-9) best = { n, d, delta };
  }
  return best;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}
