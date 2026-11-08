"use client";

import { useState } from "react";
import { assignItem } from "@/lib/actions";
import { formatDay } from "@/lib/dates";
import { useMe } from "@/lib/session";
import { useSpace } from "@/lib/space";
import { Sheet } from "../ui/Sheet";
import { useUI } from "../ui/ui-state";
import { useDayContext } from "./plan-utils";
import s from "./planner.module.css";

/** Tap-to-assign: the non-drag way to put an idea on a day (one day at a time). */
export function AssignSheet({ id }: { id: string }) {
  const { items } = useSpace();
  const { key: me } = useMe();
  const { close, toast } = useUI();
  const { days, cityByDay, today } = useDayContext();
  const [busy, setBusy] = useState<string | null>(null);
  const item = items.find((i) => i.id === id);

  if (!item) {
    return (
      <Sheet title="Add to day" onClose={close}>
        <p>This idea isn&apos;t on the list any more.</p>
      </Sheet>
    );
  }

  const counts = new Map<string, number>();
  for (const it of items) if (it.plannedDate) counts.set(it.plannedDate, (counts.get(it.plannedDate) ?? 0) + 1);

  async function pick(date: string | null) {
    setBusy(date ?? "none");
    try {
      await assignItem(me, item!, date);
      toast(date ? `Planned for ${formatDay(date, { weekday: "long", day: "numeric", month: "short" })}.` : "Back with the unassigned ideas.", "ok");
      close();
    } catch {
      toast("Couldn't save that. Try again.", "error");
      setBusy(null);
    }
  }

  return (
    <Sheet title={`Add “${item.title}” to…`} onClose={close}>
      <ul className={s.assignList}>
        {days.map((d) => {
          const current = item.plannedDate === d;
          const n = (counts.get(d) ?? 0) - (current ? 1 : 0);
          return (
            <li key={d}>
              <button
                type="button"
                className={s.assignBtn}
                aria-current={current || undefined}
                disabled={busy !== null || current}
                onClick={() => void pick(d)}
              >
                <span className={s.assignDate}>
                  <strong>{formatDay(d, { day: "numeric" })}</strong> {formatDay(d, { month: "short" })} · {formatDay(d, { weekday: "short" })}
                  {d === today && <em> · today</em>}
                </span>
                <span className={s.assignCity}>{cityByDay.get(d)}</span>
                <span className={s.assignCount}>
                  {busy === d ? <span className="spinner" /> : current ? "Current" : n ? `${n} planned` : ""}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {item.plannedDate && (
        <button type="button" className="btn btn-block" style={{ marginTop: 16 }} disabled={busy !== null} onClick={() => void pick(null)}>
          {busy === "none" && <span className="spinner" />}
          Remove from the planner
        </button>
      )}
    </Sheet>
  );
}
