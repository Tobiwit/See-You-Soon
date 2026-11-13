"use client";

import { useEffect, useState } from "react";
import { lowDataHintSeen, markLowDataHintSeen, setLowData, useLowData } from "@/lib/data-mode";
import { PEOPLE } from "@/config/app";
import { useMe } from "@/lib/session";
import { useSpace } from "@/lib/space";
import { useDayContext } from "./planner/plan-utils";
import { useUI, type SectionId } from "./ui/ui-state";
import { ThinkingButton } from "./home/Signals";
import { HeartMark } from "./ui/HeartMark";
import s from "./shell.module.css";

const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "wishlist", label: "Wishlist" },
  { id: "planner", label: "Planner" },
  { id: "memories", label: "Memories" },
];

/** Fixed vertical "spine" navigation. Highlights the section currently in view. */
export function Rail() {
  const { goTo, open, toast } = useUI();
  const low = useLowData();
  const [hint, setHint] = useState(() => !lowDataHintSeen());
  const showHint = hint && low;
  const closeHint = () => {
    markLowDataHintSeen();
    setHint(false);
  };
  const { key: me } = useMe();
  const { postcards } = useSpace();
  const { tripUnderway } = useDayContext();
  const [active, setActive] = useState<SectionId>("home");
  const unread = postcards.some((p) => p.to === me && !p.readAt);

  useEffect(() => {
    let raf = 0;
    const compute = () => {
      raf = 0;
      const line = window.innerHeight * 0.38;
      let current: SectionId = "home";
      for (const sec of SECTIONS) {
        const el = document.getElementById(sec.id);
        if (el && el.getBoundingClientRect().top <= line) current = sec.id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(compute);
    };
    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <nav className={s.rail} aria-label="Sections">
      <span className={s.railMark} aria-hidden>
        <HeartMark size={26} />
      </span>
      <ul className={s.railList}>
        {SECTIONS.map((sec) => (
          <li key={sec.id}>
            <button
              type="button"
              className={s.railItem}
              aria-current={active === sec.id ? "true" : undefined}
              data-active={active === sec.id}
              onClick={() => goTo(sec.id, { focusToday: sec.id === "planner" && tripUnderway })}
            >
              <span className={s.railLabel}>{sec.label}</span>
              {sec.id === "memories" && unread && (
                <span className={s.railDot} aria-label="(new postcard)" role="img" />
              )}
            </button>
          </li>
        ))}
      </ul>
      <div className={s.railTools}>
        <ThinkingButton compact />
        <span className={s.cloudWrap}>
        <button
          type="button"
          className={`icon-btn ${s.railTool} ${s.cloud}`}
          aria-pressed={!low}
          aria-label={low ? "Low data mode — load photos in full quality" : "Photos in full quality — switch to low data mode"}
          data-full={!low || undefined}
          onClick={() => {
            if (showHint) closeHint();
            setLowData(!low);
            toast(low ? "Loading photos in full quality." : "Low data mode: photos stay small.");
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
            <path
              d="M5.6 15.5h8.9a3.4 3.4 0 0 0 .4-6.8A4.8 4.8 0 0 0 5.6 7.6a4 4 0 0 0 0 7.9Z"
              fill={low ? "none" : "currentColor"}
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinejoin="round"
            />
            {low && <path d="M10 9v4.2M8.2 11.6 10 13.4l1.8-1.8" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />}
          </svg>
        </button>
        {showHint && (
          <div className={s.hint} role="dialog" aria-label="Low Data Mode">
            <p className={s.hintTitle}>Hey {PEOPLE[me].name}, du bist jz in Low Data Mode</p>
            <p className={s.hintText}>
              Ideas und Postcards werden nur noch als Mini-Preview im Cache gespeichert. Für die normalen Bilder, wenn du Wifi hast, kannst du
              auf die Wolke hier drücken :)
            </p>
            <button type="button" className={s.hintOk} onClick={closeHint}>
              Okay
            </button>
          </div>
        )}
        </span>
        <button type="button" className={`icon-btn ${s.railTool}`} aria-label="Settings" onClick={() => open({ kind: "settings" })}>
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
            <path d="M2 5h14M2 9h14M2 13h14" stroke="currentColor" strokeWidth="1.3" />
            <circle cx="6" cy="5" r="1.8" fill="var(--paper)" stroke="currentColor" strokeWidth="1.3" />
            <circle cx="12" cy="9" r="1.8" fill="var(--paper)" stroke="currentColor" strokeWidth="1.3" />
            <circle cx="7" cy="13" r="1.8" fill="var(--paper)" stroke="currentColor" strokeWidth="1.3" />
          </svg>
        </button>
      </div>
    </nav>
  );
}
