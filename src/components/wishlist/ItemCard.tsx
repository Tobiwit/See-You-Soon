"use client";

import { typeLabel } from "@/config/app";
import { formatDay } from "@/lib/dates";
import type { WishItem } from "@/lib/types";
import { Photo } from "../ui/Photo";
import s from "./wishlist.module.css";

export type BentoSize = "hero" | "wide" | "tall" | "mid" | "square";

function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Stable size per item (never reshuffles), nudged by the photo's orientation. */
export function bentoSize(item: WishItem): BentoSize {
  const h = hash(item.id);
  const img = item.image;
  const pool: BentoSize[] = !img
    ? ["square", "mid", "wide", "square"]
    : img.w > img.h * 1.15
      ? ["wide", "hero", "mid", "square", "wide"]
      : img.h > img.w * 1.15
        ? ["tall", "tall", "mid", "hero"]
        : ["square", "mid", "hero", "tall", "wide"];
  return pool[h % pool.length];
}

/** Typographic card used when there is no photo — intentional, never "broken". */
export function FallbackArt({ item, size = "mid" }: { item: Pick<WishItem, "title" | "type" | "placeName">; size?: BentoSize | "row" }) {
  return (
    <div className={s.fallback} data-type={item.type} data-size={size} aria-hidden>
      <span className={s.fbType}>{typeLabel(item.type)}</span>
      <span className={`display ${s.fbTitle}`}>{item.title}</span>
      <span className={s.fbPlace}>{item.placeName}</span>
    </div>
  );
}

export function ItemCard({ item, onOpen }: { item: WishItem; onOpen: () => void }) {
  const size = bentoSize(item);
  return (
    <button
      type="button"
      className={s.card}
      data-size={size}
      data-visited={item.visited || undefined}
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
            <span className={s.cardMeta}>
              {typeLabel(item.type)} · {item.placeName}
            </span>
            <span className={s.cardTitle}>{item.title}</span>
          </span>
        </>
      ) : (
        <FallbackArt item={item} size={size} />
      )}
      {item.visited && (
        <span className={s.stamp} aria-hidden>
          ✓ Visited
        </span>
      )}
      {item.plannedDate && !item.visited && (
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
