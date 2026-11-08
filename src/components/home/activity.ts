import { MOODS, PEOPLE } from "@/config/app";
import type { ActivityEvent } from "@/lib/types";

/** Short, personal copy for an activity event — derived from type + stored label. */
export function describeEvent(e: ActivityEvent): string {
  const name = PEOPLE[e.by]?.name ?? "Someone";
  switch (e.type) {
    case "postcard_created":
      return `A postcard from ${name}.`;
    case "wishlist_item_added":
      return e.label ? `${name} added somewhere to go: ${e.label}.` : `${name} added somewhere to go.`;
    case "thinking_of_you":
      return `${name} is thinking of you.`;
    case "mood_updated": {
      const m = MOODS.find((x) => x.id === e.label);
      return m ? `${name} is feeling ${m.label.toLowerCase()} ${m.emoji}` : `${name} set a new mood.`;
    }
    case "location_updated":
      return e.label ? `${name} is now in ${e.label}.` : `${name} shared a new location.`;
    case "planner_item_assigned":
      return e.label ? `${name} planned a day: ${e.label}.` : `${name} planned a day.`;
    case "moment_added":
      return `${name} saved a moment.`;
    default:
      return `${name} did something new.`;
  }
}
