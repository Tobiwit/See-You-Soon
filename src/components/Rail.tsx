"use client";

import { useEffect, useState } from "react";
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
  const { goTo, open } = useUI();
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
