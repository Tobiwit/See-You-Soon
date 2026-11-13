"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { DEFAULT_TRAVELLER_LOCATION } from "@/config/app";
import { markMet } from "@/lib/actions";
import { alexTz, hhmm, tobyNow } from "@/lib/clocks";
import { useMe } from "@/lib/session";
import { useNow, useSpace } from "@/lib/space";
import { reducedMotion, useUI } from "../ui/ui-state";
import s from "./clocks.module.css";

/* ------------------------------------------------------------------ */
/* Seven-segment glyphs                                                */
/* ------------------------------------------------------------------ */

// Segments: a top, b upper right, c lower right, d bottom, e lower left, f upper left, g middle.
const SEG_POINTS: Record<string, string> = {
  a: "5.5,3.5 9,0 31,0 34.5,3.5 31,7 9,7",
  b: "33,9 36.5,5.5 40,9 40,30 36.5,33.5 33,30",
  c: "33,40 36.5,36.5 40,40 40,61 36.5,64.5 33,61",
  d: "5.5,66.5 9,63 31,63 34.5,66.5 31,70 9,70",
  e: "0,40 3.5,36.5 7,40 7,61 3.5,64.5 0,61",
  f: "0,9 3.5,5.5 7,9 7,30 3.5,33.5 0,30",
  g: "5.5,35 9,31.5 31,31.5 34.5,35 31,38.5 9,38.5",
};

const GLYPHS: Record<string, string> = {
  "0": "abcdef",
  "1": "bc",
  "2": "abdeg",
  "3": "abcdg",
  "4": "bcfg",
  "5": "acdfg",
  "6": "acdefg",
  "7": "abc",
  "8": "abcdefg",
  "9": "abcdfg",
  F: "aefg",
  L: "def",
  Y: "bcdfg",
  I: "ef", // drawn narrow, see Glyph
  N: "abcef",
  A: "abcefg",
  R: "eg",
  "-": "g",
  " ": "",
};

function Glyph({ ch }: { ch: string }) {
  const on = GLYPHS[ch] ?? "";
  if (ch === "I") {
    // Just the bar — no unlit segments around it, so it sits close to its neighbours.
    return (
      <svg className={s.glyph} viewBox="-4 -2 16 74" aria-hidden>
        <g transform="skewX(-6) translate(4 0)">
          <polygon points={SEG_POINTS.f} className={s.segOn} />
          <polygon points={SEG_POINTS.e} className={s.segOn} />
        </g>
      </svg>
    );
  }
  return (
    <svg className={s.glyph} viewBox="-2 -2 44 74" aria-hidden>
      <g transform="skewX(-6) translate(4 0)">
        {Object.entries(SEG_POINTS).map(([k, pts]) => (
          <polygon key={k} points={pts} className={on.includes(k) ? s.segOn : s.segOff} />
        ))}
      </g>
    </svg>
  );
}

/**
 * "13:45" with a colon, or a word like "IN AIR". `tick` drives the colon blink — all clocks
 * share the same tick, so their colons blink together.
 */
function Segments({ text, size = "m", tick }: { text: string; size?: "m" | "l"; tick: boolean }) {
  if (!text.includes(":")) {
    return (
      <span className={s.digits} data-size={size} data-word>
        {[...text].map((ch, i) => (ch === " " ? <span key={i} className={s.space} /> : <Glyph key={i} ch={ch} />))}
      </span>
    );
  }
  const [h, m] = text.split(":");
  return (
    <span className={s.digits} data-size={size}>
      <Glyph ch={h[0]} />
      <Glyph ch={h[1]} />
      <span className={s.colon} data-off={!tick || undefined} aria-hidden>
        <i />
        <i />
      </span>
      <Glyph ch={m[0]} />
      <Glyph ch={m[1]} />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Clocks                                                              */
/* ------------------------------------------------------------------ */

const IN_AIR = "IN AIR";

interface ClockFace {
  label: string;
  text: string; // "HH:MM" or IN_AIR
  place: string;
}

function Face({ face, size, tick }: { face: ClockFace; size?: "m" | "l"; tick: boolean }) {
  const flying = face.text === IN_AIR;
  return (
    <div className={s.face} data-size={size}>
      <p className={s.label}>{face.label}</p>
      <Segments text={face.text} size={size} tick={tick} />
      <p className={s.place}>
        {flying && (
          <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden className={s.plane}>
            <path d="M15 8.6 9.4 6.2V2.3a1.3 1.3 0 0 0-2.6 0v3.9L1 8.6v1.6l5.8-1.5v3.2l-1.5 1.1V14l2.4-.7 2.4.7v-1l-1.5-1.1V8.7L15 10.2Z" fill="currentColor" />
          </svg>
        )}
        {face.place}
      </p>
      <span className="sr-only">{flying ? "In the air" : face.text}</span>
    </div>
  );
}

function Pair({ toby, alex, tick }: { toby: ClockFace; alex: ClockFace; tick: boolean }) {
  return (
    <div className={s.pair}>
      <Face face={toby} tick={tick} />
      <span className={s.divider} aria-hidden />
      <Face face={alex} tick={tick} />
    </div>
  );
}

/**
 * Toby Time (from his travel plan) and Alex Time (from Alex's shared location), side by side.
 * Once Toby has landed in Hanoi and both show the same time, "We met" merges them into one.
 */
export function Clocks() {
  const { location, met } = useSpace();
  const { key: me } = useMe();
  const { toast } = useUI();
  const now = useNow(1000);
  const box = useRef<HTMLDivElement>(null);
  const [anim, setAnim] = useState<{ phase: "grow" | "snap"; rect: DOMRect } | null>(null);

  const t = tobyNow(now);
  const tobyText = t.place ? hhmm(now, t.tz) : IN_AIR;
  const tick = now.getSeconds() % 2 === 0;
  const aTz = alexTz(location, "Asia/Tokyo");
  const alexText = hhmm(now, aTz);
  const alexPlace = location.city || location.name || DEFAULT_TRAVELLER_LOCATION.city;

  const toby: ClockFace = { label: "Toby Time", text: tobyText, place: t.place ?? "In the air" };
  const alex: ClockFace = { label: "Alex Time", text: alexText, place: alexPlace };
  const together = t.landed && tobyText === alexText;
  const merged = Boolean(met[me]) || anim?.phase === "snap";

  useEffect(() => {
    if (!anim) return;
    const timer = setTimeout(
      () => {
        if (anim.phase === "grow") setAnim({ ...anim, phase: "snap" });
        else setAnim(null);
      },
      anim.phase === "grow" ? 1600 : 520,
    );
    return () => clearTimeout(timer);
  }, [anim]);

  function weMet() {
    void markMet(me).catch(() => toast("Couldn't save that — try again.", "error"));
    if (reducedMotion() || !box.current) return;
    setAnim({ phase: "grow", rect: box.current.getBoundingClientRect() });
  }

  const one: ClockFace = { label: "Alex & Toby Time ♥", text: hhmm(now, t.tz), place: t.place ?? "Together" };

  return (
    <div className={s.clocks}>
      <div ref={box} className={s.stage} data-hidden={anim?.phase === "grow" || undefined}>
        {merged ? (
          <div className={s.merged} data-pop={anim?.phase === "snap" || undefined}>
            <Face face={one} size="l" tick={tick} />
          </div>
        ) : (
          <Pair toby={toby} alex={alex} tick={tick} />
        )}
      </div>

      {together && !merged && (
        <button type="button" className={`btn btn-primary btn-block ${s.metBtn}`} onClick={weMet}>
          We met <span aria-hidden>♥</span>
        </button>
      )}

      {anim &&
        createPortal(
          <div className={s.overlay} data-phase={anim.phase} aria-hidden>
            <svg
              className={s.heart}
              viewBox="0 0 100 92"
              style={{
                left: anim.rect.left + anim.rect.width / 2,
                top: anim.rect.top + anim.rect.height / 2,
                ["--fill" as string]: String((2.3 * Math.max(window.innerWidth, window.innerHeight)) / 100),
              }}
            >
              <path d="M50 90C22 70 2 52 2 29 2 13 14 2 28 2c9.5 0 17 5 22 13C55 7 62.5 2 72 2c14 0 26 11 26 27 0 23-20 41-48 61Z" />
            </svg>
            {anim.phase === "grow" && (
              <div
                className={s.ghost}
                style={{ left: anim.rect.left, top: anim.rect.top, width: anim.rect.width, height: anim.rect.height }}
              >
                <Pair toby={toby} alex={alex} tick={tick} />
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
