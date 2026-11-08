"use client";

import { useSpace } from "@/lib/space";
import { Cover } from "./Cover";
import { Countdown } from "./Countdown";
import { Journey } from "./Journey";
import { TimeApart } from "./TimeApart";
import { BetweenUs } from "./Signals";
import s from "./home.module.css";

export function Home() {
  const { config } = useSpace();
  return (
    <div id="home">
      <Cover />
      <Countdown />
      {/* Graphic interruption — the route itself, set in the display face. */}
      <div className={s.band} aria-hidden>
        <p className="display">
          {config.route.map((r, i) => (
            <span key={r.id}>
              {r.name}
              {i < config.route.length - 1 && <em> → </em>}
            </span>
          ))}
        </p>
      </div>
      <Journey />
      <TimeApart />
      <BetweenUs />
    </div>
  );
}
