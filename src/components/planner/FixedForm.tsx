"use client";

import { useState, type FormEvent } from "react";
import { saveFixed } from "@/lib/actions";
import { useSpace } from "@/lib/space";
import { Sheet } from "../ui/Sheet";
import { useUI } from "../ui/ui-state";

/** Fixed anchors (arrival / departure) can be edited deliberately but never removed. */
export function FixedForm({ id }: { id: string }) {
  const { fixed, sync } = useSpace();
  const { close, toast } = useUI();
  const ev = fixed.find((f) => f.id === id);
  const [title, setTitle] = useState(ev?.title ?? "");
  const [city, setCity] = useState(ev?.city ?? "");
  const [date, setDate] = useState(ev?.date ?? "");
  const [note, setNote] = useState(ev?.note ?? "");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!ev) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !city.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError("Title, city and date are needed.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await saveFixed({ ...ev!, title, city, date, note });
      toast("Saved.", "ok");
      close();
    } catch {
      setError("Couldn't save. Try again.");
      setBusy(false);
    }
  }

  return (
    <Sheet
      title={ev.kind === "arrival" ? "Arrival" : "Departure"}
      onClose={() => !busy && close()}
      footer={
        editing ? (
          <>
            <button type="button" className="btn" onClick={() => setEditing(false)} disabled={busy}>
              Cancel
            </button>
            <button type="submit" form="fixed-form" className="btn btn-primary" style={{ flex: 1 }} disabled={busy}>
              {busy && <span className="spinner" />}
              {busy ? (sync === "online" ? "Saving…" : "Waiting for connection…") : "Save changes"}
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-block" onClick={() => setEditing(true)}>
            Change details
          </button>
        )
      }
    >
      {!editing ? (
        <>
          <p className="serif" style={{ fontSize: 30, lineHeight: 1.1, margin: "0 0 8px" }}>
            {ev.title}
          </p>
          <p style={{ margin: 0, color: "var(--ink-2)" }}>{ev.city}</p>
          {ev.note && <p style={{ marginTop: 16 }}>{ev.note}</p>}
          <p className="notice" style={{ marginTop: 24 }}>
            A fixed anchor of the trip. It can&apos;t be deleted — only changed if plans change.
          </p>
        </>
      ) : (
        <form id="fixed-form" onSubmit={(e) => void submit(e)} noValidate>
          <div className="field">
            <label htmlFor="fx-title">Title</label>
            <input id="fx-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="fx-city">City</label>
            <input id="fx-city" className="input" value={city} onChange={(e) => setCity(e.target.value)} />
            {ev.kind === "arrival" && <span className="hint">The planner starts in this city.</span>}
          </div>
          <div className="field">
            <label htmlFor="fx-date">Date</label>
            <input id="fx-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
            <span className="hint">To change the trip window itself, use Settings.</span>
          </div>
          <div className="field">
            <label htmlFor="fx-note">Note</label>
            <textarea
              id="fx-note"
              className="textarea"
              value={note}
              maxLength={300}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Flight time, terminal… (optional)"
            />
          </div>
          {error && (
            <p className="notice error" role="alert">
              {error}
            </p>
          )}
        </form>
      )}
    </Sheet>
  );
}
