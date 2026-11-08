import type { ItemType, MoodId, PersonKey } from "@/config/app";

/** Firestore Timestamps are converted to Date (or null while a server timestamp is pending). */
type When = Date | null;

export interface Place {
  id: string;
  name: string; // display name, e.g. "Hoi An"
  city?: string;
  region?: string;
  country?: string;
  lat?: number;
  lon?: number;
  providerId?: string; // e.g. "osm:N123"
  createdAt: When;
}

/** Reference to an uploaded photo (stored as compressed image docs) or a licensed remote photo. */
export type ImageRef =
  | { kind: "upload"; id: string; w: number; h: number }
  | {
      kind: "unsplash";
      url: string; // hotlinked as required by Unsplash
      thumb: string;
      w: number;
      h: number;
      credit: { name: string; link: string };
      alt?: string;
    };

export interface WishItem {
  id: string;
  title: string;
  description: string;
  type: ItemType;
  placeId: string;
  placeName: string;
  desiredDate: string | null;
  image: ImageRef | null;
  url: string | null;
  by: PersonKey;
  createdAt: When;
  updatedAt: When;
  visited: boolean;
  visitedAt: When;
  visitNote: string;
  visitImage: ImageRef | null;
  plannedDate: string | null;
  plannedOrder: number;
  /** Has pending local writes not yet confirmed by the server. */
  pending?: boolean;
}

export interface TravelEvent {
  id: string;
  date: string;
  from: string;
  to: string;
  transport: string;
  by: PersonKey;
  createdAt: When;
}

export interface FixedEvent {
  id: string;
  kind: "arrival" | "departure";
  date: string;
  title: string;
  city: string;
  note: string;
}

export interface Postcard {
  id: string;
  by: PersonKey;
  to: PersonKey;
  title: string;
  message: string;
  place: string;
  image: ImageRef | null;
  createdAt: When;
  readAt: When;
  pending?: boolean;
}

export interface Moment {
  id: string;
  by: PersonKey;
  caption: string;
  date: string; // day key
  image: ImageRef | null;
  createdAt: When;
}

export interface Mood {
  key: PersonKey;
  mood: MoodId | null;
  updatedAt: When;
  expiresAt: When;
}

export interface SharedLocation {
  name: string;
  city?: string;
  country?: string;
  countryCode?: string;
  lat?: number;
  lon?: number;
  source: "gps" | "manual" | "default";
  updatedAt: When;
}

export type ActivityType =
  | "postcard_created"
  | "wishlist_item_added"
  | "thinking_of_you"
  | "mood_updated"
  | "location_updated"
  | "planner_item_assigned"
  | "moment_added";

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  by: PersonKey;
  refId: string | null;
  /** Small denormalised label (item title, mood id, city) so the cover needs no extra reads. */
  label: string;
  createdAt: When;
  seen: Partial<Record<PersonKey, boolean>>;
}
