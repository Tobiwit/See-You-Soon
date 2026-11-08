"use client";

import { useMemo } from "react";
import { PEOPLE, partnerOf } from "@/config/app";
import { markEventSeen } from "@/lib/actions";
import { formatDay, relativeTime } from "@/lib/dates";
import { useMe } from "@/lib/session";
import { useNow, useSpace } from "@/lib/space";
import type { ActivityEvent } from "@/lib/types";
import { Photo } from "../ui/Photo";
import { useUI } from "../ui/ui-state";
import { describeEvent } from "./activity";
import s from "./home.module.css";

const WINDOW_MS = 7 * 86_400_000;

export function Cover() {
  const { config, events } = useSpace();
  const { key: me } = useMe();
  const now = useNow(60_000);
  const { open, goTo } = useUI();
  const partner = partnerOf(me);

  // The other person's latest one or two events from the last week. Never invented.
  const latest = useMemo(
    () =>
      events
        .filter((e) => e.by === partner && e.createdAt && now.getTime() - e.createdAt.getTime() < WINDOW_MS)
        .slice(0, 2),
    [events, partner, now],
  );

  const words = config.title.trim().split(/\s+/);
  const month = formatDay(config.reunionDate, { month: "long", year: "numeric" });

  function follow(e: ActivityEvent) {
    if (!e.seen[me]) void markEventSeen(me, e.id).catch(() => {});
    if (e.type === "postcard_created" && e.refId) open({ kind: "postcard", id: e.refId });
    else if ((e.type === "wishlist_item_added" || e.type === "planner_item_assigned") && e.refId)
      open({ kind: "item", id: e.refId });
    else if (e.type === "location_updated") goTo("journey");
    else if (e.type === "moment_added") goTo("memories");
    else goTo("between-us");
  }

  return (
    <section className={s.cover} aria-label="Cover">
      <div className={s.coverMedia} aria-hidden>
        {config.coverImageId ? (
          <Photo image={{ kind: "upload", id: config.coverImageId, w: 0, h: 0 }} variant="full" alt="" eager />
        ) : (
          <div className={s.coverFallback} />
        )}
      </div>
      <div className={s.coverShade} aria-hidden />

      <div className={s.coverTop}>
        <span>Vol. 01</span>
        <span>{config.route[config.route.length - 1]?.name ?? ""}</span>
        <span>{month}</span>
      </div>

      <h1 className={`display ${s.coverTitle}`} aria-label={config.title}>
        {words.map((w, i) => (
          <span key={i} aria-hidden>
            {w}
          </span>
        ))}
      </h1>

      <p className={s.coverByline}>
        {PEOPLE.alex.name} <span aria-hidden>+</span>
        <span className="sr-only">and</span> {PEOPLE.toby.name}
      </p>

      <div className={s.coverFoot}>
        {latest.length > 0 && (
          <ul className={s.activity} aria-label={`Latest from ${PEOPLE[partner].name}`}>
            {latest.map((e) => (
              <li key={e.id}>
                <button type="button" className={s.activityItem} onClick={() => follow(e)}>
                  {!e.seen[me] && <span className={s.newTag}>New</span>}
                  <span className={s.activityText}>{describeEvent(e)}</span>
                  <span className={s.activityTime}>{relativeTime(e.createdAt, now)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className={s.scrollCue} onClick={() => goTo("countdown")}>
          <span>Scroll</span>
          <span className={s.cueLine} aria-hidden />
        </button>
      </div>
    </section>
  );
}
