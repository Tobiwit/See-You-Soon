"use client";

import { addDays, diffDays, dayKeyInTz, formatDay, niceFraction, startOfDayInTz, tzShortName, zonedToInstant } from "@/lib/dates";
import { useEffect, useRef, useState, type RefObject } from "react";
import { useNow, useSpace } from "@/lib/space";
import { reducedMotion } from "../ui/ui-state";
import { useReveal } from "../ui/useReveal";
import s from "./home.module.css";

function Roll({ value, pad = 2 }: { value: number; pad?: number }) {
  const text = String(value).padStart(pad, "0");
  // Re-keying on change replays a short slide — the only motion in the countdown.
  return (
    <span className={s.roll} key={text}>
      {text}
    </span>
  );
}

const DROP_FROM = 99;
let dropPlayed = false; // once per app launch

/**
 * The first time the day count scrolls into view it starts at 99 and drops,
 * quickly then slowing, to the real number. Skipped with reduced motion.
 */
function useDropIn(target: number, el: RefObject<HTMLElement | null>) {
  const [value, setValue] = useState<number | null>(() =>
    dropPlayed || target >= DROP_FROM || reducedMotion() || typeof IntersectionObserver === "undefined" ? null : DROP_FROM,
  );
  const targetRef = useRef(target);
  useEffect(() => {
    targetRef.current = target;
  });

  useEffect(() => {
    const node = el.current;
    if (value === null || !node) return;
    let raf = 0;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        dropPlayed = true;
        const to = targetRef.current;
        const t0 = performance.now();
        const duration = 1800;
        const tick = (t: number) => {
          const p = Math.min(1, (t - t0) / duration);
          const eased = 1 - Math.pow(1 - p, 3);
          setValue(Math.round(DROP_FROM - (DROP_FROM - to) * eased));
          if (p < 1) raf = requestAnimationFrame(tick);
          else setValue(null);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.6 },
    );
    io.observe(node);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return value ?? target;
}

export function Countdown() {
  const { config } = useSpace();
  const now = useNow(1000);
  const ref = useReveal<HTMLDivElement>();
  const daysRef = useRef<HTMLSpanElement>(null);
  const tz = config.timezone;

  const target = zonedToInstant(config.reunionDate, config.reunionTime, tz);
  const sepStart = startOfDayInTz(config.separationStart, tz);
  const tripOver = startOfDayInTz(addDays(config.tripEnd, 1), tz);
  const remaining = target.getTime() - now.getTime();
  const shownDays = useDropIn(Math.max(0, Math.floor(remaining / 86_400_000)), daysRef);

  const when = `${formatDay(config.reunionDate, { weekday: "long", day: "numeric", month: "long" })} · ${config.reunionTime} (${tzShortName(tz, target)})`;

  if (remaining > 0) {
    const totalMin = Math.floor(remaining / 60_000);
    const days = Math.floor(totalMin / 1440);
    const hours = Math.floor((totalMin % 1440) / 60);
    const minutes = totalMin % 60;

    const span = target.getTime() - sepStart.getTime();
    const progress = span > 0 ? Math.min(1, Math.max(0, (now.getTime() - sepStart.getTime()) / span)) : 0;
    const f = niceFraction(progress);
    const qualifier = Math.abs(f.delta) < 0.008 ? "" : f.delta < 0 ? "Knapp " : "Gut ";

    return (
      <section id="countdown" className={s.countdown} aria-label="Countdown to the reunion">
        <div ref={ref} className="reveal">
          <p className={s.kicker}>Next stop: together.</p>
          <div className={s.days} aria-hidden>
            <span ref={daysRef} className={`display ${s.daysNum}`}>
              <Roll value={shownDays} pad={1} />
            </span>
            <span className={s.daysLabel}>{shownDays === 1 ? "day" : "days"}</span>
          </div>
          <p className={s.hm} aria-hidden>
            <span className={s.hmNum}>
              <Roll value={hours} />
            </span>
            <span className={s.hmUnit}>hours</span>
            <span className={s.hmNum}>
              <Roll value={minutes} />
            </span>
            <span className={s.hmUnit}>minutes</span>
          </p>
          <p className="sr-only" aria-live="off">
            {days} days, {hours} hours and {minutes} minutes until {config.reunionPlace}.
          </p>
          <p className={s.where}>
            <strong>{config.reunionPlace}</strong>
            <br />
            {when}
          </p>

          {progress > 0 && f.d > 1 && (
            <div className={s.fraction}>
              <div className={s.fracBar} aria-hidden>
                <span style={{ transform: `scaleX(${progress})` }} />
              </div>
              <p>
                {qualifier}
                <span className={s.frac}>
                  <sup>{f.n}</sup>⁄<sub>{f.d}</sub>
                </span>{" "}
                der Zeit geschafft!
                <span className="sr-only"> ({Math.round(progress * 100)} Prozent)</span>
              </p>
            </div>
          )}
        </div>
      </section>
    );
  }

  // Reunited.
  const today = dayKeyInTz(now, tz);
  const during = now.getTime() < tripOver.getTime();
  const tripDays = diffDays(config.tripStart, config.tripEnd) + 1;
  const dayN = Math.min(tripDays, Math.max(1, diffDays(config.tripStart, today) + 1));

  return (
    <section id="countdown" className={`${s.countdown} ${s.together}`} aria-label="Together">
      <div ref={ref} className="reveal">
        <p className={s.kicker}>{during ? "The wait is over." : "Back from Vietnam."}</p>
        <p className={`display ${s.togetherWord}`}>Together.</p>
        <p className={s.where}>
          {during ? (
            <>
              <strong>
                Day {dayN} of {tripDays}
              </strong>
              <br />
              {formatDay(config.tripStart, { day: "numeric", month: "long" })} –{" "}
              {formatDay(config.tripEnd, { day: "numeric", month: "long" })}
            </>
          ) : (
            <>
              <strong>{tripDays} days together</strong>
              <br />
              {formatDay(config.tripStart, { day: "numeric", month: "long" })} –{" "}
              {formatDay(config.tripEnd, { day: "numeric", month: "long", year: "numeric" })}
            </>
          )}
        </p>
      </div>
    </section>
  );
}
