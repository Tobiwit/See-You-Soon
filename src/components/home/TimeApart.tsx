"use client";

import { useMemo } from "react";
import { dayKeyInTz, diffDays, eachDay, formatDay } from "@/lib/dates";
import { useNow, useSpace } from "@/lib/space";
import { useReveal } from "../ui/useReveal";
import s from "./home.module.css";

type Kind = "apart" | "travel" | "together";

/** One block per calendar day, from the first day apart to the last day of the trip (inclusive). */
export function TimeApart() {
  const { config, travel } = useSpace();
  const now = useNow(60_000);
  const ref = useReveal<HTMLDivElement>();
  const today = dayKeyInTz(now, config.timezone);

  const { days, total, elapsed, apartCount, togetherCount } = useMemo(() => {
    const keys = eachDay(config.separationStart, config.tripEnd);
    const travelDays = new Set(travel.map((t) => t.date));
    const days = keys.map((k) => {
      const kind: Kind =
        k < config.reunionDate
          ? "apart"
          : k === config.reunionDate || k === config.tripEnd || travelDays.has(k)
            ? "travel"
            : "together";
      return { k, kind, past: k < today, isToday: k === today };
    });
    const total = keys.length;
    const elapsed = Math.min(total, Math.max(0, diffDays(config.separationStart, today) + 1));
    return {
      days,
      total,
      elapsed,
      apartCount: days.filter((d) => d.kind === "apart").length,
      togetherCount: total - days.filter((d) => d.kind === "apart").length,
    };
  }, [config.separationStart, config.tripEnd, config.reunionDate, travel, today]);

  if (!total) return null;

  return (
    <section className={s.timeApart} aria-labelledby="apart-h">
      <div ref={ref} className="reveal">
        <div className={s.apartHead}>
          <p className="eyebrow" id="apart-h">
            The whole stretch
          </p>
          <p className={s.apartCount}>
            <span className={s.apartNum}>{elapsed}</span>
            <span className={s.apartSlash}>/</span>
            <span>{total}</span>
          </p>
        </div>
        <div
          className={s.blocks}
          role="img"
          aria-label={`${elapsed} of ${total} days so far: ${apartCount} days apart, then ${togetherCount} days together in Vietnam.`}
        >
          {days.map((d) => (
            <span
              key={d.k}
              className={s.block}
              data-kind={d.kind}
              data-past={d.past || undefined}
              data-today={d.isToday || undefined}
              title={`${formatDay(d.k, { weekday: "short", day: "numeric", month: "short" })} · ${d.kind === "apart" ? "apart" : d.kind === "travel" ? "travel day" : "together"}`}
            />
          ))}
        </div>
        <ul className={s.legend}>
          <li>
            <span className={s.block} data-kind="apart" data-past aria-hidden /> Apart
          </li>
          <li>
            <span className={s.block} data-kind="travel" aria-hidden /> Travel day
          </li>
          <li>
            <span className={s.block} data-kind="together" aria-hidden /> Together
          </li>
          <li>
            <span className={s.block} data-today aria-hidden data-kind="apart" /> Today
          </li>
        </ul>
        <p className={s.apartFoot}>
          {formatDay(config.separationStart, { day: "numeric", month: "short" })} →{" "}
          {formatDay(config.tripEnd, { day: "numeric", month: "short" })}
        </p>
      </div>
    </section>
  );
}
