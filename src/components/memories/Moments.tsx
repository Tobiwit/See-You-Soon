"use client";

import { useState, type FormEvent } from "react";
import { PEOPLE } from "@/config/app";
import { addMoment, deleteMoment } from "@/lib/actions";
import { dayKeyInTz, formatDay } from "@/lib/dates";
import type { PreparedImage } from "@/lib/images";
import { useMe } from "@/lib/session";
import { useSpace } from "@/lib/space";
import { ImagePicker } from "../ui/ImagePicker";
import { Photo } from "../ui/Photo";
import { Confirm, Sheet } from "../ui/Sheet";
import { useUI } from "../ui/ui-state";
import s from "./memories.module.css";

export function MomentForm() {
  const { config, sync } = useSpace();
  const { key: me } = useMe();
  const { close, toast } = useUI();
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [caption, setCaption] = useState("");
  const [date, setDate] = useState(() => dayKeyInTz(new Date(), config.timezone));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!image && !caption.trim()) {
      setError("Add a photo or a few words.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await addMoment(me, { caption, date, image });
      toast("Saved to Memories.", "ok");
      close();
    } catch {
      setError("Couldn't save. Nothing was lost — try again.");
      setBusy(false);
    }
  }

  return (
    <Sheet
      title="Keep a moment"
      onClose={() => {
        if (busy) return;
        if ((image || caption) && !window.confirm("Discard this moment?")) return;
        close();
      }}
      footer={
        <button type="submit" form="moment-form" className="btn btn-primary btn-block" disabled={busy}>
          {busy && <span className="spinner" />}
          {busy ? (sync === "online" ? "Saving…" : "Waiting for connection…") : "Save moment"}
        </button>
      }
    >
      <form id="moment-form" onSubmit={(e) => void submit(e)} noValidate>
        <div className="field">
          <span className="label">Photo</span>
          <ImagePicker value={image} onChange={setImage} />
        </div>
        <div className="field">
          <label htmlFor="mo-cap">Caption</label>
          <textarea id="mo-cap" className="textarea" value={caption} maxLength={300} onChange={(e) => setCaption(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="mo-date">Day</label>
          <input id="mo-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
      </form>
    </Sheet>
  );
}

export function MomentView({ id }: { id: string }) {
  const { moments } = useSpace();
  const { close, toast } = useUI();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const m = moments.find((x) => x.id === id);
  if (!m) {
    return (
      <Sheet title="Moment" onClose={close}>
        <p>This moment was removed.</p>
      </Sheet>
    );
  }
  return (
    <Sheet title={formatDay(m.date, { weekday: "long", day: "numeric", month: "long" })} onClose={close}>
      {m.image && (
        <div className={s.momentImg}>
          <Photo image={m.image} variant="full" alt={m.caption || "Moment"} eager />
        </div>
      )}
      {m.caption && <p className={s.momentCaption}>{m.caption}</p>}
      <p className="meta">Kept by {PEOPLE[m.by]?.name}</p>
      {!confirming ? (
        <button type="button" className="link-btn" style={{ color: "var(--danger)" }} onClick={() => setConfirming(true)}>
          Delete moment
        </button>
      ) : (
        <Confirm
          title="Delete this moment?"
          body="It disappears for both of you. This can't be undone."
          confirmLabel="Delete"
          busy={busy}
          onCancel={() => setConfirming(false)}
          onConfirm={async () => {
            setBusy(true);
            try {
              await deleteMoment(m.id, m.image);
              toast("Deleted.", "ok");
              close();
            } catch {
              toast("Couldn't delete it.", "error");
              setBusy(false);
            }
          }}
        />
      )}
    </Sheet>
  );
}
