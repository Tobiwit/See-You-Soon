"use client";

import { useMemo } from "react";
import { OWNER, PEOPLE, partnerOf } from "@/config/app";
import { markEventSeen } from "@/lib/actions";
import { useDaily } from "@/lib/daily";
import { formatDay, relativeTime } from "@/lib/dates";
import { useMe } from "@/lib/session";
import { useNow, useSpace } from "@/lib/space";
import type { ActivityEvent } from "@/lib/types";
import { Photo } from "../ui/Photo";
import { useUI } from "../ui/ui-state";
import { describeEvent } from "./activity";
import s from "./home.module.css";

const WINDOW_MS = 7 * 86_400_000;
const MAX_UPDATES = 3;

/** Editorial cover: issue line, masthead, a sharp cover photo, byline and a few one-line updates. */
export function Cover() {
  const { config, events } = useSpace();
  const { key: me } = useMe();
  const now = useNow(60_000);
  const { open, goTo } = useUI();
  const partner = partnerOf(me);
  const { banner } = useDaily();

  // The other person's latest events from the last week, only the newest of each kind
  // (a new mood replaces the previous one). Never invented.
  const latest = useMemo(() => {
    const kinds = new Set<string>();
    return events
      .filter((e) => {
        if (e.by !== partner || !e.createdAt || now.getTime() - e.createdAt.getTime() >= WINDOW_MS) return false;
        if (kinds.has(e.type)) return false;
        kinds.add(e.type);
        return true;
      })
      .slice(0, MAX_UPDATES - (banner ? 1 : 0));
  }, [events, partner, now, banner]);

  const dailyText = !banner
    ? ""
    : banner.kind === "result"
      ? "See the result of the daily question"
      : banner.kind === "partner-done"
        ? `${PEOPLE[partner].name} already did the daily question`
        : "New daily question is available";

  const [first, ...rest] = config.title.trim().split(/\s+/);
  const last = rest.pop();
  const middle = rest.join(" ");
  const month = formatDay(config.reunionDate, { month: "long", year: "numeric" });
  const destination = config.route[config.route.length - 1]?.name ?? "";

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
      <div className={s.coverTop}>
        <span>Vol. 01</span>
        <span>{destination}</span>
        <span>{month}</span>
      </div>

      <h1 className={`display ${s.masthead}`} aria-label={config.title}>
        <span aria-hidden>{first}</span>
        {middle && (
          <span className={s.mastheadAccent} aria-hidden>
            {middle}
          </span>
        )}
        {last && <span aria-hidden>{last}</span>}
      </h1>

      <figure className={s.coverPhoto}>
        {config.coverImageId ? (
          <Photo image={{ kind: "upload", id: config.coverImageId, w: 0, h: 0 }} variant="full" alt={`${PEOPLE.alex.name} and ${PEOPLE.toby.name}`} eager />
        ) : (
          <div className={s.coverFallback} aria-hidden>
            {me === OWNER && <span>Add a photo of the two of you in Settings</span>}
          </div>
        )}
      </figure>

      <p className={s.coverByline}>
        <span className={s.coverNames}>
          {PEOPLE.alex.name} <span aria-hidden>+</span>
          <span className="sr-only">and</span> {PEOPLE.toby.name}
        </span>
        <span className={s.coverWhere}>
          {config.reunionPlace}, {formatDay(config.reunionDate, { day: "numeric", month: "short" })}
        </span>
      </p>

      {(latest.length > 0 || banner) && (
        <ul className={s.updates} aria-label={`Latest from ${PEOPLE[partner].name}`}>
          {banner && (
            <li>
              <button type="button" className={s.update} data-daily onClick={() => open({ kind: "daily", day: banner.day })}>
                <span className={s.updateDot} aria-hidden />
                <span className={s.updateText}>{dailyText}</span>
                <span className={s.updateTime} aria-hidden>
                  →
                </span>
              </button>
            </li>
          )}
          {latest.map((e) => (
            <li key={e.id}>
              <button type="button" className={s.update} onClick={() => follow(e)} data-new={!e.seen[me] || undefined}>
                <span className={s.updateDot} aria-hidden />
                {!e.seen[me] && <span className="sr-only">New: </span>}
                <span className={s.updateText}>{describeEvent(e)}</span>
                <span className={s.updateTime}>{relativeTime(e.createdAt, now)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className={s.scrollCue} onClick={() => goTo("countdown")}>
        <span>Scroll</span>
        <span className={s.cueLine} aria-hidden />
      </button>
    </section>
  );
}
