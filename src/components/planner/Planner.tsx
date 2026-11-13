"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { assignItem } from "@/lib/actions";
import { formatDay } from "@/lib/dates";
import { useMe } from "@/lib/session";
import { useSpace } from "@/lib/space";
import type { FixedEvent, TravelEvent, WishItem } from "@/lib/types";
import { Photo } from "../ui/Photo";
import { useUI } from "../ui/ui-state";
import { FallbackArt } from "../wishlist/ItemCard";
import { useDayContext } from "./plan-utils";
import s from "./planner.module.css";

export function Planner() {
  const { items, travel, fixed, config } = useSpace();
  const { key: me } = useMe();
  const { open, toast } = useUI();
  const { days, today, cityByDay } = useDayContext();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dragging, setDragging] = useState<WishItem | null>(null);
  const daysRef = useRef<HTMLOListElement>(null);
  const [drawerShown, setDrawerShown] = useState(() => typeof IntersectionObserver === "undefined");

  // Only bring the drawer in once the day list has reached the middle of the screen.
  useEffect(() => {
    const el = daysRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setDrawerShown(e.isIntersecting || e.boundingClientRect.top < 0), {
      rootMargin: "0px 0px -45% 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Long-press to pick up on touch, so ordinary scrolling never assigns by accident.
    useSensor(TouchSensor, { activationConstraint: { delay: 260, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const byDay = useMemo(() => {
    const m = new Map<string, WishItem[]>();
    for (const it of items) {
      if (!it.plannedDate) continue;
      const arr = m.get(it.plannedDate) ?? [];
      arr.push(it);
      m.set(it.plannedDate, arr);
    }
    for (const arr of m.values()) arr.sort((a, b) => a.plannedOrder - b.plannedOrder);
    return m;
  }, [items]);

  // Items planned on a date outside the trip window still count as planned, but we surface them.
  const outside = useMemo(() => items.filter((i) => i.plannedDate && !days.includes(i.plannedDate)), [items, days]);
  const unassigned = useMemo(() => items.filter((i) => !i.plannedDate), [items]);

  async function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    const item = items.find((i) => `item:${i.id}` === e.active.id);
    const target = e.over?.id;
    if (!item || !target) return;
    const date = target === "drawer" ? null : String(target).replace("day:", "");
    if (date === item.plannedDate) return;
    try {
      await assignItem(me, item, date);
      toast(
        date
          ? `${item.title} → ${formatDay(date, { weekday: "short", day: "numeric", month: "short" })}`
          : `${item.title} is back in the drawer.`,
        "ok",
      );
    } catch {
      toast("Couldn't move it. Try again.", "error");
    }
  }

  const fixedByDay = new Map<string, FixedEvent[]>();
  for (const f of fixed) fixedByDay.set(f.date, [...(fixedByDay.get(f.date) ?? []), f]);
  const travelByDay = new Map<string, TravelEvent[]>();
  for (const t of travel) travelByDay.set(t.date, [...(travelByDay.get(t.date) ?? []), t]);

  return (
    <section id="planner" className={s.section} aria-labelledby="planner-h">
      <header className={s.head}>
        <p className="eyebrow">Vietnam, day by day</p>
        <div className={s.titleRow}>
          <h2 id="planner-h" className={s.h}>
            Planner
          </h2>
          <button type="button" className="btn" onClick={() => open({ kind: "travel" })}>
            <span aria-hidden>+</span> Commute
          </button>
        </div>
        <p className={s.range}>
          {formatDay(config.tripStart, { day: "numeric", month: "long" })} – {formatDay(config.tripEnd, { day: "numeric", month: "long" })}{" "}
          · {days.length} days
        </p>
      </header>

      <DndContext
        sensors={sensors}
        onDragStart={(e: DragStartEvent) => setDragging(items.find((i) => `item:${i.id}` === e.active.id) ?? null)}
        onDragCancel={() => setDragging(null)}
        onDragEnd={(e) => void onDragEnd(e)}
        autoScroll={{ threshold: { x: 0, y: 0.18 }, acceleration: 12 }}
      >
        <ol ref={daysRef} className={s.days}>
          {days.map((d, i) => {
            const moves = travelByDay.get(d) ?? [];
            return (
              <Fragment key={d}>
                {i === 0 && (
                  <li className={s.cityLabel}>
                    <span>Starting in</span> {cityByDay.get(d) || "—"}
                  </li>
                )}
                {/* A commute sits between days, where the city changes. */}
                {moves.map((t) => (
                  <li key={t.id} className={s.commuteLine}>
                    <button type="button" onClick={() => open({ kind: "travel", id: t.id })}>
                      <span className={s.commuteKind}>Commute</span>
                      <span className={s.commuteRoute}>
                        {t.from || "?"} <span aria-hidden>→</span>
                        <span className="sr-only">to</span> {t.to}
                      </span>
                      {t.transport && <span className={s.commuteHow}>{t.transport}</span>}
                    </button>
                  </li>
                ))}
                <DayRow
                  day={d}
                  index={i + 1}
                  isToday={d === today}
                  isPast={d < today}
                  fixed={fixedByDay.get(d) ?? []}
                  items={byDay.get(d) ?? []}
                  onOpenItem={(id) => open({ kind: "item", id })}
                  onOpenFixed={(id) => open({ kind: "fixed", id })}
                  dropping={dragging !== null}
                />
              </Fragment>
            );
          })}
        </ol>

        {outside.length > 0 && (
          <p className={s.outside}>
            {outside.length} planned {outside.length === 1 ? "idea is" : "ideas are"} on a date outside the trip:{" "}
            {outside.map((o, i) => (
              <Fragment key={o.id}>
                {i > 0 && ", "}
                <button type="button" className="link-btn" onClick={() => open({ kind: "item", id: o.id })}>
                  {o.title}
                </button>
              </Fragment>
            ))}
            .
          </p>
        )}

        <Drawer
          shown={drawerShown || drawerOpen || dragging !== null}
          items={unassigned}
          open={drawerOpen}
          setOpen={setDrawerOpen}
          onTap={(id) => open({ kind: "assign", id })}
          dragging={dragging}
        />

        <DragOverlay dropAnimation={null}>{dragging ? <MiniCard item={dragging} lifted /> : null}</DragOverlay>
      </DndContext>
    </section>
  );
}

function DayRow({
  day,
  index,
  isToday,
  isPast,
  fixed,
  items,
  onOpenItem,
  onOpenFixed,
  dropping,
}: {
  day: string;
  index: number;
  isToday: boolean;
  isPast: boolean;
  fixed: FixedEvent[];
  items: WishItem[];
  onOpenItem: (id: string) => void;
  onOpenFixed: (id: string) => void;
  dropping: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${day}` });
  const label = formatDay(day, { weekday: "long", day: "numeric", month: "long" });
  const empty = !fixed.length && !items.length;

  return (
    <li
      ref={setNodeRef}
      id={`day-${day}`}
      className={s.day}
      data-today={isToday || undefined}
      data-past={isPast || undefined}
      data-over={isOver || undefined}
      data-dropping={dropping || undefined}
      aria-label={`Day ${index}, ${label}${isToday ? ", today" : ""}`}
    >
      <div className={s.dayNum}>
        <span className={s.num}>{formatDay(day, { day: "2-digit" })}</span>
        <span className={s.wd}>{formatDay(day, { weekday: "short" })}</span>
        <span className={s.dn}>Day {index}</span>
        {isToday && <span className={s.todayTag}>Today</span>}
      </div>
      <div className={s.dayBody}>
        {fixed.map((f) => (
          <button
            key={f.id}
            type="button"
            className={s.tile}
            onClick={() => onOpenFixed(f.id)}
            aria-label={`Fixed ${f.kind}: ${f.title}${f.note ? `. ${f.note}` : ""}`}
          >
            <span className={s.tileSquare} data-fixed aria-hidden>
              <svg width="10" height="12" viewBox="0 0 9 11">
                <rect x="0.5" y="4.5" width="8" height="6" fill="none" stroke="currentColor" />
                <path d="M2 4.5V3a2.5 2.5 0 015 0v1.5" fill="none" stroke="currentColor" />
              </svg>
              <span className={s.fixedKind}>{f.kind === "arrival" ? "Arrival" : "Departure"}</span>
              <span className={s.fixedCity}>{f.city}</span>
            </span>
            <span className={s.tileTitle} aria-hidden>
              {f.title}
            </span>
          </button>
        ))}
        {items.map((it) => (
          <DraggableMini key={it.id} item={it} onTap={() => onOpenItem(it.id)} />
        ))}
        {isOver ? (
          <span className={s.dropHint}>Drop to plan it for {formatDay(day, { weekday: "short", day: "numeric" })}</span>
        ) : (
          empty && <span className={s.emptyDay} aria-label="Nothing planned yet" />
        )}
      </div>
    </li>
  );
}

function DraggableMini({ item, onTap }: { item: WishItem; onTap: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `item:${item.id}` });
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={s.miniBtn}
      data-dragging={isDragging || undefined}
      onClick={onTap}
      {...attributes}
      {...listeners}
      aria-roledescription="Draggable idea"
      aria-label={`${item.title}. Tap for details, or hold and drag to another day.`}
    >
      <MiniCard item={item} />
    </button>
  );
}

function MiniCard({ item, lifted }: { item: WishItem; lifted?: boolean }) {
  return (
    <span className={s.tile} data-lifted={lifted || undefined} data-visited={item.visited || undefined}>
      <span className={s.tileSquare}>
        {item.image ? <Photo saver image={item.image} alt="" /> : <FallbackArt item={item} size="xs" />}
        {item.visited && <span className={s.tileCheck}>✓</span>}
      </span>
      <span className={s.tileTitle}>{item.title}</span>
    </span>
  );
}

function Drawer({
  shown,
  items,
  open,
  setOpen,
  onTap,
  dragging,
}: {
  shown: boolean;
  items: WishItem[];
  open: boolean;
  setOpen: (v: boolean) => void;
  onTap: (id: string) => void;
  dragging: WishItem | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "drawer" });
  const showDropTarget = dragging && dragging.plannedDate;
  return (
    <div
      ref={setNodeRef}
      className={s.drawer}
      data-shown={shown || undefined}
      data-open={open || undefined}
      data-over={isOver || undefined}
    >
      <button type="button" className={s.drawerBar} aria-expanded={open} aria-controls="drawer-panel" onClick={() => setOpen(!open)}>
        <span>
          {showDropTarget ? "Drop here to unplan" : "Unassigned ideas"} <span className={s.drawerCount}>· {items.length}</span>
        </span>
        <svg width="12" height="8" viewBox="0 0 12 8" aria-hidden className={s.chev}>
          <path d="M1 7l5-5 5 5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
      {open && (
        <div id="drawer-panel" className={s.drawerPanel}>
          {items.length === 0 ? (
            <p className={s.drawerEmpty}>Every idea has a day. Add more in the Wishlist.</p>
          ) : (
            <>
              <p className={s.drawerHint}>Hold a card and drag it onto a day — or tap it to choose.</p>
              <div className={s.drawerRow}>
                {items.map((it) => (
                  <DrawerCard key={it.id} item={it} onTap={() => onTap(it.id)} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function DrawerCard({ item, onTap }: { item: WishItem; onTap: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `item:${item.id}` });
  return (
    <button
      ref={setNodeRef}
      type="button"
      className={s.dcard}
      data-dragging={isDragging || undefined}
      onClick={onTap}
      {...attributes}
      {...listeners}
      aria-roledescription="Draggable idea"
      aria-label={`${item.title}. Tap to choose a day, or hold and drag onto a day.`}
    >
      <span className={s.dcardImg}>{item.image ? <Photo saver image={item.image} alt="" /> : <FallbackArt item={item} size="m" />}</span>
      <span className={s.dcardTitle}>{item.title}</span>
      <span className={s.dcardMeta}>{item.placeName}</span>
    </button>
  );
}
