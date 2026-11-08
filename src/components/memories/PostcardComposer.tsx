"use client";

import { useState, type FormEvent } from "react";
import { sendPostcard } from "@/lib/actions";
import type { PreparedImage } from "@/lib/images";
import { useMe } from "@/lib/session";
import { useSpace } from "@/lib/space";
import { ImagePicker } from "../ui/ImagePicker";
import { Sheet } from "../ui/Sheet";
import { useUI } from "../ui/ui-state";
import s from "./memories.module.css";

export function PostcardComposer() {
  const { location, sync } = useSpace();
  const { key: me, partner, me: self } = useMe();
  const { close, toast, replace } = useUI();
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [place, setPlace] = useState(self.traveller ? location?.city ?? location?.name ?? "" : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const dirty = Boolean(image || title || message);

  function onClose() {
    if (busy) return;
    if (dirty && !window.confirm("Throw this postcard away?")) return;
    close();
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!message.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const id = await sendPostcard(me, partner.key, { title, message, place, image });
      toast(`Sent to ${partner.name}.`, "ok");
      replace({ kind: "postcard", id });
    } catch {
      setError("It didn't send. Your postcard is still here — try again.");
      setBusy(false);
    }
  }

  return (
    <Sheet
      title={`A postcard for ${partner.name}`}
      onClose={onClose}
      full
      footer={
        <button type="submit" form="pc-form" className="btn btn-primary btn-block" disabled={busy}>
          {busy && <span className="spinner" />}
          {busy ? (sync === "online" ? "Sending…" : "Waiting for connection…") : "Send postcard"}
        </button>
      }
    >
      <form id="pc-form" onSubmit={(e) => void submit(e)} noValidate className={s.compose}>
        <ImagePicker value={image} onChange={setImage} aspect="3 / 2" label="Add the front photo" />
        <div className={s.composeBack}>
          <input
            className={s.greeting}
            value={title}
            maxLength={80}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Greetings from…"
            aria-label="Greeting"
          />
          <textarea
            className={s.lines}
            value={message}
            maxLength={1200}
            rows={7}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Write something only they'd understand."
            aria-label="Message (required)"
            aria-invalid={touched && !message.trim()}
          />
          {touched && !message.trim() && <span className="err">Write a few words first.</span>}
          <div className={s.composeFoot}>
            <input className={s.placeInput} value={place} maxLength={80} onChange={(e) => setPlace(e.target.value)} placeholder="Sent from (optional)" aria-label="Sent from" />
            <span className={s.toLine}>
              To <strong>{partner.name}</strong>
            </span>
          </div>
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
