"use client";

import { useMemo, useState, type FormEvent } from "react";
import { deleteTravel, saveTravel } from "@/lib/actions";
import { addDays, formatDay } from "@/lib/dates";
import { useMe } from "@/lib/session";
import { useSpace } from "@/lib/space";
import { Confirm, Sheet } from "../ui/Sheet";
import { useUI } from "../ui/ui-state";
import { useDayContext } from "./plan-utils";

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
      await saveTravel(me, { id: existing?.id, date, from, to, transport });
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
        <div className="field">
          <label htmlFor="t-how">How</label>
          <input id="t-how" className="input" value={transport} maxLength={120} onChange={(e) => setTransport(e.target.value)} placeholder="Train, flight, bus… (optional)" />
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
