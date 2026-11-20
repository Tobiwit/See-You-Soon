"use client";

import { useMemo, useState, type FormEvent } from "react";
import { deleteTravel, saveTravel } from "@/lib/actions";
import { addDays, formatDay } from "@/lib/dates";
import { useMe } from "@/lib/session";
import { useSpace } from "@/lib/space";
import { Confirm, Sheet } from "../ui/Sheet";
import { useUI } from "../ui/ui-state";
import type { CommuteMode } from "@/lib/types";
import { COMMUTE_MODES, CommuteIcon, MODE_LABEL } from "./CommuteIcon";
import { useDayContext } from "./plan-utils";
import s from "./planner.module.css";

export function TravelForm({ id, date: initialDate }: { id?: string; date?: string }) {
  const { travel, places, fixed, sync } = useSpace();
  const { key: me } = useMe();
  const { close, toast } = useUI();
  const { days, cityByDay, today } = useDayContext();
  const existing = id ? travel.find((t) => t.id === id) : undefined;

  const defaultDate = existing?.date ?? initialDate ?? (days.includes(today) ? today : days[1] ?? days[0]);
  const [date, setDate] = useState(defaultDate);
  const [from, setFrom] = useState(existing?.from ?? cityByDay.get(addDays(defaultDate, -1)) ?? cityByDay.get(defaultDate) ?? "");
  const [to, setTo] = useState(existing?.to ?? "");
  const [transport, setTransport] = useState(existing?.transport ?? "");
  const [placement, setPlacement] = useState<"between" | "day">(existing?.placement ?? "between");
  const [mode, setMode] = useState<CommuteMode>(existing?.mode ?? "train");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const cities = useMemo(() => {
    const set = new Set<string>();
    fixed.forEach((f) => f.city && set.add(f.city));
    travel.forEach((t) => {
      if (t.from) set.add(t.from);
      if (t.to) set.add(t.to);
    });
    places.forEach((p) => {
      if (p.city) set.add(p.city);
    });
    return [...set].sort();
  }, [fixed, travel, places]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!to.trim() || !date) return;
    setBusy(true);
    setError(null);
    try {
      // A new during-the-day commute starts after the day's ideas; move it with the arrows.
      const slot = existing && existing.placement === "day" && existing.date === date ? existing.slot : 99;
      await saveTravel(me, { id: existing?.id, date, from, to, transport, placement, slot, mode });
      toast(existing ? "Commute updated." : `Commute to ${to.trim()} added.`, "ok");
      close();
    } catch {
      setError("Couldn't save. Nothing was lost — try again.");
      setBusy(false);
    }
  }

  async function remove() {
    if (!existing) return;
    setBusy(true);
    try {
      await deleteTravel(existing.id);
      toast("Commute removed.", "ok");
      close();
    } catch {
      setError("Couldn't remove it.");
      setBusy(false);
    }
  }

  return (
    <Sheet
      title={existing ? "Commute" : "Add a commute"}
      onClose={() => !busy && close()}
      footer={
        <button type="submit" form="travel-form" className="btn btn-primary btn-block" disabled={busy}>
          {busy && <span className="spinner" />}
          {busy ? (sync === "online" ? "Saving…" : "Waiting for connection…") : existing ? "Save" : "Add commute"}
        </button>
      }
    >
      <form id="travel-form" onSubmit={(e) => void submit(e)} noValidate>
        <datalist id="known-cities">
          {cities.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
        <fieldset className={`field ${s.fieldset}`}>
          <legend className="label">Where it goes</legend>
          <div className={s.segRow}>
            <button type="button" className={s.seg} aria-pressed={placement === "between"} onClick={() => setPlacement("between")}>
              Between days
            </button>
            <button type="button" className={s.seg} aria-pressed={placement === "day"} onClick={() => setPlacement("day")}>
              During a day
            </button>
          </div>
          <span className="hint">
            {placement === "between"
              ? "Shown as a line between the day before and this day."
              : "Shown inside the day — move it above or below the ideas with the arrows."}
          </span>
        </fieldset>
        <div className="field">
          <label htmlFor="t-date">
            Day <span className="req">required</span>
          </label>
          <select
            id="t-date"
            className="select"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              if (!existing && !from) setFrom(cityByDay.get(addDays(e.target.value, -1)) ?? "");
            }}
          >
            {days.map((d) => (
              <option key={d} value={d}>
                {formatDay(d, { weekday: "short", day: "numeric", month: "short" })}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="t-from">From</label>
          <input id="t-from" className="input" list="known-cities" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="t-to">
            To <span className="req">required</span>
          </label>
          <input
            id="t-to"
            className="input"
            list="known-cities"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            aria-invalid={touched && !to.trim()}
            placeholder="e.g. Hoi An"
          />
          {touched && !to.trim() && <span className="err">Where are you going?</span>}
          <span className="hint">From this day on, the planner shows you in this city.</span>
        </div>
        <fieldset className={`field ${s.fieldset}`}>
          <legend className="label">How</legend>
          <div className={s.segRow}>
            {COMMUTE_MODES.map((m) => (
              <button key={m} type="button" className={s.seg} aria-pressed={mode === m} onClick={() => setMode(m)}>
                <CommuteIcon mode={m} size={14} />
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="field">
          <label htmlFor="t-how">Details</label>
          <input
            id="t-how"
            className="input"
            value={transport}
            maxLength={120}
            onChange={(e) => setTransport(e.target.value)}
            placeholder={mode === "train" ? "e.g. SE3, 22:00, cabin 4" : mode === "plane" ? "e.g. VN 163, 10:40" : mode === "bus" ? "e.g. Sapa Express, 07:00" : "Optional"}
          />
        </div>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        {existing && !confirming && (
          <button type="button" className="link-btn" style={{ color: "var(--danger)" }} onClick={() => setConfirming(true)}>
            Remove this commute
          </button>
        )}
        {confirming && (
          <Confirm
            title="Remove this commute?"
            body="The days after it will show the previous city again."
            confirmLabel="Remove"
            busy={busy}
            onCancel={() => setConfirming(false)}
            onConfirm={() => void remove()}
          />
        )}
      </form>
    </Sheet>
  );
}
