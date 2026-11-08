"use client";

import { useState } from "react";
import { setVisited } from "@/lib/actions";
import type { PreparedImage } from "@/lib/images";
import { useMe } from "@/lib/session";
import { useSpace } from "@/lib/space";
import { ImagePicker } from "../ui/ImagePicker";
import { Photo } from "../ui/Photo";
import { Sheet } from "../ui/Sheet";
import { useUI } from "../ui/ui-state";

/** Mark visited, optionally keeping a note/photo. The item stays on the wishlist and shows up in Memories. */
export function VisitSheet({ id }: { id: string }) {
  const { items, sync } = useSpace();
  const { key: me } = useMe();
  const { close, toast } = useUI();
  const item = items.find((i) => i.id === id);
  const [note, setNote] = useState(item?.visitNote ?? "");
  const [image, setImage] = useState<PreparedImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!item) {
    return (
      <Sheet title="Visited" onClose={close}>
        <p>This idea isn&apos;t on the list any more.</p>
      </Sheet>
    );
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await setVisited(me, item!, true, { note, image });
      toast(item!.visited ? "Memory saved." : "Marked as visited.", "ok");
      close();
    } catch {
      setError("Couldn't save. Your note is still here — try again.");
      setBusy(false);
    }
  }

  return (
    <Sheet
      title={item.visited ? "Edit the memory" : `Visited ${item.title}`}
      onClose={() => !busy && close()}
      footer={
        <button type="button" className="btn btn-primary btn-block" onClick={() => void save()} disabled={busy}>
          {busy && <span className="spinner" />}
          {busy ? (sync === "online" ? "Saving…" : "Waiting for connection…") : item.visited ? "Save memory" : "Mark as visited"}
        </button>
      }
    >
      <p style={{ marginTop: 0, color: "var(--ink-2)" }}>Optional: keep a line or a photo. It stays on the wishlist and appears in Memories.</p>
      <div className="field">
        <label htmlFor="visit-note">Note</label>
        <textarea id="visit-note" className="textarea" value={note} maxLength={600} onChange={(e) => setNote(e.target.value)} placeholder="What do you want to remember?" />
      </div>
      <div className="field">
        <span className="label">Photo</span>
        <ImagePicker
          value={image}
          onChange={setImage}
          existing={item.visitImage ? <Photo image={item.visitImage} variant="full" alt="Current memory photo" eager /> : undefined}
        />
      </div>
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
    </Sheet>
  );
}
