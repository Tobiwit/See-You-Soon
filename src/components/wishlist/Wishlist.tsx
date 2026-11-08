"use client";

import { useMemo, useState } from "react";
import { ITEM_TYPES } from "@/config/app";
import { useSpace } from "@/lib/space";
import { useUI } from "../ui/ui-state";
import { ItemCard, ItemRow, packBento } from "./ItemCard";
import s from "./wishlist.module.css";

type View = "board" | "list";
const VIEW_KEY = "sys.wishlist.view";

export function Wishlist() {
  const { items, loaded } = useSpace();
  const { open } = useUI();
  const [place, setPlace] = useState("");
  const [type, setType] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [view, setView] = useState<View>(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "board";
    } catch {
      return "board";
    }
  });
  const changeView = (v: View) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {}
  };

  // Place options come from the items themselves, with counts.
  const placeOptions = useMemo(() => {
    const m = new Map<string, { name: string; n: number }>();
    for (const it of items) {
      const cur = m.get(it.placeId) ?? { name: it.placeName, n: 0 };
      cur.n++;
      m.set(it.placeId, cur);
    }
    return [...m.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));
  }, [items]);

  const typeCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const it of items) m.set(it.type, (m.get(it.type) ?? 0) + 1);
    return m;
  }, [items]);

  const filtered = useMemo(
    () => items.filter((it) => (!place || it.placeId === place) && (!type || it.type === type)),
    [items, place, type],
  );
  const filtering = Boolean(place || type);
  const slots = useMemo(() => packBento(filtered), [filtered]);
  const visitedCount = items.filter((i) => i.visited).length;

  return (
    <section id="wishlist" className={s.section} aria-labelledby="wishlist-h">
      <div className={s.opener}>
        <p className="display">Somewhere to go.</p>
      </div>

      <header className={s.head}>
        <div className={s.titleRow}>
          <h2 id="wishlist-h" className={s.h}>
            Wishlist
          </h2>
          <p className={s.count}>
            {items.length} {items.length === 1 ? "idea" : "ideas"}
            {visitedCount ? ` · ${visitedCount} visited` : ""}
          </p>
        </div>
        <div className={s.addRow}>
          <button type="button" className={`btn btn-primary ${s.add}`} onClick={() => open({ kind: "item-form" })}>
            <span aria-hidden>+</span> Add an idea
          </button>
          <button
            type="button"
            className={s.filterBtn}
            aria-expanded={showFilters}
            aria-controls="wishlist-filters"
            aria-label={`Filters${filtering ? ` (${Number(Boolean(place)) + Number(Boolean(type))} active)` : ""}`}
            data-active={filtering || undefined}
            onClick={() => setShowFilters((v) => !v)}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
              <path d="M1 3h14M4 8h8M6.5 13h3" stroke="currentColor" strokeWidth="1.6" />
            </svg>
            {filtering && <span className={s.filterCount}>{Number(Boolean(place)) + Number(Boolean(type))}</span>}
          </button>
          <div className={s.toggle} role="group" aria-label="View">
            <button type="button" aria-pressed={view === "board"} onClick={() => changeView("board")} aria-label="Board view">
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
                <rect x="1" y="1" width="8" height="8" fill="currentColor" />
                <rect x="10" y="1" width="5" height="5" fill="currentColor" />
                <rect x="10" y="7" width="5" height="8" fill="currentColor" />
                <rect x="1" y="10" width="8" height="5" fill="currentColor" />
              </svg>
            </button>
            <button type="button" aria-pressed={view === "list"} onClick={() => changeView("list")} aria-label="List view">
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
                <path d="M1 3h14M1 8h14M1 13h14" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </button>
          </div>
        </div>

        {showFilters && (
          <div id="wishlist-filters" className={s.filters}>
            <label className={s.filter}>
              <span className="sr-only">Filter by place</span>
              <select className="select" value={place} onChange={(e) => setPlace(e.target.value)}>
                <option value="">All places</option>
                {placeOptions.map(([id, p]) => (
                  <option key={id} value={id}>
                    {p.name} ({p.n})
                  </option>
                ))}
              </select>
            </label>
            <label className={s.filter}>
              <span className="sr-only">Filter by type</span>
              <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="">All types</option>
                {ITEM_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                    {typeCounts.get(t.id) ? ` (${typeCounts.get(t.id)})` : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        {filtering && (
          <p className={s.filterNote}>
            Showing {filtered.length} of {items.length}.{" "}
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                setPlace("");
                setType("");
              }}
            >
              Clear filters
            </button>
          </p>
        )}
      </header>

      {!loaded ? (
        <p className={s.empty}>Loading…</p>
      ) : items.length === 0 ? (
        <div className={s.emptyBig}>
          <p className="serif">Nothing on the list yet.</p>
          <p>Add the first place, dish or plan you want to do together.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className={s.emptyBig}>
          <p className="serif">Nothing matches.</p>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setPlace("");
              setType("");
            }}
          >
            Clear filters
          </button>
        </div>
      ) : view === "board" ? (
        <div className={s.bentoWrap}>
          <div className={s.bento}>
            {filtered.map((it) => (
              <ItemCard key={it.id} item={it} slot={slots.get(it.id)!} onOpen={() => open({ kind: "item", id: it.id })} />
            ))}
          </div>
        </div>
      ) : (
        <div className={s.list}>
          {filtered.map((it) => (
            <ItemRow key={it.id} item={it} onOpen={() => open({ kind: "item", id: it.id })} />
          ))}
        </div>
      )}
    </section>
  );
}
