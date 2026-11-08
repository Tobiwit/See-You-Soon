"use client";

import { typeLabel } from "@/config/app";
import { formatDay } from "@/lib/dates";
import type { WishItem } from "@/lib/types";
import { Photo } from "../ui/Photo";
import s from "./wishlist.module.css";

/** Text scale for a card or tile: xs (planner tiles) … l (big bento squares, detail view). */
export type ArtSize = "xs" | "s" | "m" | "l" | "row";

export const BENTO_COLS = 7;

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

export interface BentoSlot {
  col: number; // 1-based grid line
  row: number;
  size: number; // spans size × size cells (2–5)
}

/**
 * Skyline packing on a 7-column grid. Every card is a square of 2–5 cells. The
 * size (and left/right placement) is picked from the idea's id, so the board
 * looks random but never reshuffles; sizes that would leave a 1-column sliver
 * are skipped.
 */
export function packBento(items: { id: string }[]): Map<string, BentoSlot> {
  const heights = new Array<number>(BENTO_COLS).fill(0);
  const out = new Map<string, BentoSlot>();
  for (const it of items) {
    const h = hash(it.id);
    for (let guard = 0; guard < 50; guard++) {
      const minH = Math.min(...heights);
      const c = heights.indexOf(minH);
      let w = 0;
      while (c + w < BENTO_COLS && heights[c + w] === minH) w++;
      if (w === 1) {
        // A single-column pit can't hold a square: level it with its lower neighbour.
        const n = [heights[c - 1], heights[c + 1]].filter((x) => x !== undefined) as number[];
        heights[c] = Math.min(...n);
        continue;
      }
      // Every size that fits this gap without leaving a 1-column sliver; the idea's id picks one.
      const fits = [2, 3, 4, 5].filter((n) => n <= w && w - n !== 1);
      const size = fits[(h >>> 3) % fits.length];
      // Alternate sides so equal-sized gaps don't always fill left first.
      const col = (h & 1) && w > size ? c + (w - size) : c;
      out.set(it.id, { col: col + 1, row: minH + 1, size });
      for (let k = col; k < col + size; k++) heights[k] = minH + size;
      break;
    }
  }
  return out;
}

const artFor = (size: number): ArtSize => (size <= 2 ? "s" : size === 3 ? "m" : "l");

/** Typographic card used when there is no photo — intentional, never "broken". */
export function FallbackArt({ item, size = "m" }: { item: Pick<WishItem, "title" | "type" | "placeName">; size?: ArtSize }) {
  return (
    <div className={s.fallback} data-type={item.type} data-size={size} aria-hidden>
      <span className={s.fbType}>{typeLabel(item.type)}</span>
      <span className={`display ${s.fbTitle}`}>{item.title}</span>
      <span className={s.fbPlace}>{item.placeName}</span>
    </div>
  );
}

export function ItemCard({ item, slot, onOpen }: { item: WishItem; slot: BentoSlot; onOpen: () => void }) {
  const art = artFor(slot.size);
  return (
    <button
      type="button"
      className={s.card}
      data-size={art}
      data-visited={item.visited || undefined}
      style={{ gridColumn: `${slot.col} / span ${slot.size}`, gridRow: `${slot.row} / span ${slot.size}` }}
      onClick={onOpen}
      aria-label={`${item.title}, ${typeLabel(item.type)} in ${item.placeName}${item.visited ? ", visited" : ""}`}
    >
      {item.image ? (
        <>
          <span className={s.cardImg}>
            <Photo image={item.image} alt="" />
          </span>
          <span className={s.cardShade} aria-hidden />
          <span className={s.cardText} aria-hidden>
            {art !== "s" && (
              <span className={s.cardMeta}>
                {typeLabel(item.type)} · {item.placeName}
              </span>
            )}
            <span className={s.cardTitle}>{item.title}</span>
          </span>
        </>
      ) : (
        <FallbackArt item={item} size={art} />
      )}
      {item.visited && (
        <span className={s.stamp} aria-hidden>
          ✓{art !== "s" && " Visited"}
        </span>
      )}
      {item.plannedDate && !item.visited && art !== "s" && (
        <span className={s.planned} aria-hidden>
          {formatDay(item.plannedDate, { day: "numeric", month: "short" })}
        </span>
      )}
      {item.pending && <span className={s.pendingDot} title="Not synced yet" aria-hidden />}
    </button>
  );
}

export function ItemRow({ item, onOpen }: { item: WishItem; onOpen: () => void }) {
  return (
    <button type="button" className={s.row} onClick={onOpen} data-visited={item.visited || undefined}>
      <span className={s.rowThumb}>
        {item.image ? <Photo image={item.image} alt="" /> : <FallbackArt item={item} size="row" />}
      </span>
      <span className={s.rowMain}>
        <span className={s.rowTitle}>{item.title}</span>
        <span className={s.rowMeta}>
          {typeLabel(item.type)} · {item.placeName}
          {item.desiredDate ? ` · ideally ${formatDay(item.desiredDate, { day: "numeric", month: "short" })}` : ""}
        </span>
        {item.description && <span className={s.rowDesc}>{item.description}</span>}
      </span>
      <span className={s.rowSide}>
        {item.visited ? (
          <span className={s.rowVisited}>✓ Visited</span>
        ) : item.plannedDate ? (
          <span className={s.rowPlanned}>{formatDay(item.plannedDate, { weekday: "short", day: "numeric" })}</span>
        ) : (
          <span className={s.rowOpen}>Not planned</span>
        )}
      </span>
    </button>
  );
}
