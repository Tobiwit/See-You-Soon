import { TOBY_ITINERARY } from "@/config/app";
import { zonedToInstant } from "./dates";
import type { SharedLocation } from "./types";

/** Where Toby is on his travel plan right now. `place` is null while he's flying. */
export function tobyNow(now: Date): { place: string | null; tz: string; landed: boolean } {
  const t = now.getTime();
  for (let i = 0; i < TOBY_ITINERARY.length; i++) {
    const stop = TOBY_ITINERARY[i];
    const end = stop.until ? zonedToInstant(stop.until.day, stop.until.time, stop.until.tz).getTime() : Infinity;
    if (t < end) return { place: stop.place ?? null, tz: stop.tz, landed: i === TOBY_ITINERARY.length - 1 };
  }
  const last = TOBY_ITINERARY[TOBY_ITINERARY.length - 1];
  return { place: last.place ?? null, tz: last.tz, landed: true };
}

// ISO country code → time zone. All the countries on (and around) the route have one zone.
const TZ_BY_COUNTRY: Record<string, string> = {
  VN: "Asia/Ho_Chi_Minh",
  JP: "Asia/Tokyo",
  KR: "Asia/Seoul",
  UZ: "Asia/Tashkent",
  CN: "Asia/Shanghai",
  TW: "Asia/Taipei",
  HK: "Asia/Hong_Kong",
  TH: "Asia/Bangkok",
  LA: "Asia/Vientiane",
  KH: "Asia/Phnom_Penh",
  SG: "Asia/Singapore",
  MY: "Asia/Kuala_Lumpur",
  PH: "Asia/Manila",
  KZ: "Asia/Almaty",
  KG: "Asia/Bishkek",
  TJ: "Asia/Dushanbe",
  TR: "Europe/Istanbul",
  AE: "Asia/Dubai",
  QA: "Asia/Qatar",
  DE: "Europe/Berlin",
  AT: "Europe/Vienna",
  CH: "Europe/Zurich",
};

const TZ_BY_NAME: Record<string, string> = {
  vietnam: "VN",
  "viet nam": "VN",
  japan: "JP",
  "south korea": "KR",
  korea: "KR",
  uzbekistan: "UZ",
  china: "CN",
  taiwan: "TW",
  "hong kong": "HK",
  thailand: "TH",
  laos: "LA",
  cambodia: "KH",
  singapore: "SG",
  malaysia: "MY",
  philippines: "PH",
  kazakhstan: "KZ",
  kyrgyzstan: "KG",
  tajikistan: "TJ",
  turkey: "TR",
  "united arab emirates": "AE",
  qatar: "QA",
  germany: "DE",
  austria: "AT",
  switzerland: "CH",
};

/** Alex's time zone, from where he last shared his location. */
export function alexTz(loc: SharedLocation, fallback: string): string {
  if (loc.tz && loc.source === "gps") return loc.tz; // his phone's own zone at the moment he shared
  const code = (loc.countryCode ?? "").toUpperCase() || TZ_BY_NAME[(loc.country ?? "").trim().toLowerCase()] || "";
  return TZ_BY_COUNTRY[code] ?? (loc.tz || fallback);
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
/** "HH:MM" in a time zone. */
export function hhmm(now: Date, tz: string): string {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: tz });
    fmtCache.set(tz, f);
  }
  return f.format(now);
}
