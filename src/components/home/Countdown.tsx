"use client";

import { addDays, diffDays, dayKeyInTz, formatDay, niceFraction, startOfDayInTz, tzShortName, zonedToInstant } from "@/lib/dates";
import { useNow, useSpace } from "@/lib/space";
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

export function Countdown() {
  const { config } = useSpace();
  const now = useNow(1000);
  const ref = useReveal<HTMLDivElement>();
  const tz = config.timezone;

  const target = zonedToInstant(config.reunionDate, config.reunionTime, tz);
  const sepStart = startOfDayInTz(config.separationStart, tz);
  const tripOver = startOfDayInTz(addDays(config.tripEnd, 1), tz);
  const remaining = target.getTime() - now.getTime();

  const when = `${formatDay(config.reunionDate, { weekday: "long", day: "numeric", month: "long" })} · ${config.reunionTime} (${tzShortName(tz, target)})`;

  if (remaining > 0) {
    const totalMin = Math.floor(remaining / 60_000);
    const days = Math.floor(totalMin / 1440);
    const hours = Math.floor((totalMin % 1440) / 60);
    const minutes = totalMin % 60;

    const span = target.getTime() - sepStart.getTime();
    const progress = span > 0 ? Math.min(1, Math.max(0, (now.getTime() - sepStart.getTime()) / span)) : 0;
    const f = niceFraction(progress);
    const qualifier = Math.abs(f.delta) < 0.008 ? "" : f.delta < 0 ? "Almost " : "Just over ";

    return (
      <section id="countdown" className={s.countdown} aria-label="Countdown to the reunion">
        <div ref={ref} className="reveal">
          <p className={s.kicker}>Next stop: together.</p>
          <div className={s.days} aria-hidden>
            <span className={`display ${s.daysNum}`}>
              <Roll value={days} pad={1} />
            </span>
            <span className={s.daysLabel}>{days === 1 ? "day" : "days"}</span>
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
                of the time apart is behind us.
                <span className="sr-only"> ({Math.round(progress * 100)} percent)</span>
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
