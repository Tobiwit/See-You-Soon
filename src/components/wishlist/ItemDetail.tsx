"use client";

import { useState } from "react";
import { PEOPLE, typeLabel } from "@/config/app";
import { deleteItem, setVisited } from "@/lib/actions";
import { formatDay, relativeTime } from "@/lib/dates";
import { useMe } from "@/lib/session";
import { usePlacesById, useSpace } from "@/lib/space";
import { Credit, Photo } from "../ui/Photo";
import { Confirm, Sheet } from "../ui/Sheet";
import { useUI } from "../ui/ui-state";
import { FallbackArt } from "./ItemCard";
import s from "./wishlist.module.css";

const isMapsUrl = (u: string) => /(^|\.)google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps|maps\.apple\.com/i.test(u);

export function mapsUrl(name: string, lat?: number, lon?: number) {
  const apple = typeof navigator !== "undefined" && /iPhone|iPad|Macintosh/.test(navigator.userAgent);
  if (typeof lat === "number" && typeof lon === "number") {
    return apple
      ? `https://maps.apple.com/?q=${encodeURIComponent(name)}&ll=${lat},${lon}`
      : `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
  }
  return apple
    ? `https://maps.apple.com/?q=${encodeURIComponent(name)}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`;
}

export function ItemDetail({ id }: { id: string }) {
  const { items, loaded } = useSpace();
  const placesById = usePlacesById();
  const { key: me } = useMe();
  const { close, open, toast } = useUI();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState<null | "delete" | "visited">(null);
  const item = items.find((i) => i.id === id);

  if (!item) {
    return (
      <Sheet title="Idea" onClose={close}>
        <p>{loaded ? "This idea isn't on the list any more." : "Loading…"}</p>
      </Sheet>
    );
  }

  const place = placesById.get(item.placeId);
  const linkIsMap = item.url ? isMapsUrl(item.url) : false;

  async function remove() {
    setBusy("delete");
    try {
      await deleteItem(item!);
      toast("Deleted.", "ok");
      close();
    } catch {
      toast("Couldn't delete it. Try again.", "error");
      setBusy(null);
    }
  }

  async function unvisit() {
    setBusy("visited");
    try {
      await setVisited(me, item!, false);
    } catch {
      toast("Couldn't update.", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Sheet title={item.title} hideTitle onClose={close} full>
      <div className={s.detailMedia}>
        {item.image ? <Photo image={item.image} variant="full" alt={item.title} eager /> : <FallbackArt item={item} size="l" />}
      </div>
      <Credit image={item.image} />

      <div className={s.detailHead}>
        <p className={s.detailMeta}>
          {typeLabel(item.type)} · {item.placeName}
        </p>
        <h2 className={s.detailTitle}>{item.title}</h2>
        {item.visited && (
          <p className={s.visitedLine}>
            ✓ Visited{item.visitedAt ? ` · ${item.visitedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}` : ""}
          </p>
        )}
      </div>

      {item.description && <p className={s.detailDesc}>{item.description}</p>}

      <dl className={s.facts}>
        {item.desiredDate && (
          <>
            <dt>Ideally</dt>
            <dd>{formatDay(item.desiredDate, { weekday: "long", day: "numeric", month: "long" })}</dd>
          </>
        )}
        <dt>Planned</dt>
        <dd>{item.plannedDate ? formatDay(item.plannedDate, { weekday: "long", day: "numeric", month: "long" }) : "Not on a day yet"}</dd>
        <dt>Added by</dt>
        <dd>
          {PEOPLE[item.by]?.name ?? "—"}
          {item.createdAt ? `, ${relativeTime(item.createdAt)}` : ""}
          {item.pending ? " · not synced yet" : ""}
        </dd>
      </dl>

      <div className={s.detailActions}>
        {item.url && (
          <a className="btn btn-primary" href={item.url} target="_blank" rel="noreferrer noopener">
            {linkIsMap ? "Open in Maps" : "Open link"} ↗
          </a>
        )}
        {!linkIsMap && (
          <a className="btn" href={mapsUrl(item.placeName, place?.lat, place?.lon)} target="_blank" rel="noreferrer noopener">
            {place?.lat !== undefined ? "Show on map" : "Search in Maps"} ↗
          </a>
        )}
        <button type="button" className="btn" onClick={() => open({ kind: "assign", id: item.id })}>
          {item.plannedDate ? "Move to another day" : "Add to day…"}
        </button>
        {item.visited ? (
          <button type="button" className="btn" onClick={() => void unvisit()} disabled={busy !== null}>
            {busy === "visited" && <span className="spinner" />}
            Mark as not visited
          </button>
        ) : (
          <button type="button" className="btn btn-accent" onClick={() => open({ kind: "visit", id: item.id })}>
            Mark as visited
          </button>
        )}
      </div>

      {item.visited && (item.visitNote || item.visitImage) && (
        <div className={s.memory}>
          <p className="eyebrow">The memory</p>
          {item.visitImage && (
            <div className={s.memoryImg}>
              <Photo image={item.visitImage} variant="full" alt={`Memory of ${item.title}`} />
            </div>
          )}
          {item.visitNote && <p className={s.memoryNote}>{item.visitNote}</p>}
          <button type="button" className="link-btn" onClick={() => open({ kind: "visit", id: item.id })}>
            Edit memory
          </button>
        </div>
      )}
      {item.visited && !item.visitNote && !item.visitImage && (
        <button type="button" className="link-btn" onClick={() => open({ kind: "visit", id: item.id })}>
          Add a note or photo from the visit
        </button>
      )}

      <div className={s.detailFoot}>
        <button type="button" className="btn" onClick={() => open({ kind: "item-form", id: item.id })}>
          Edit
        </button>
        <button type="button" className="btn btn-ghost" style={{ color: "var(--danger)" }} onClick={() => setConfirming(true)}>
          Delete
        </button>
      </div>
      {confirming && (
        <Confirm
          title={`Delete “${item.title}”?`}
          body="It disappears for both of you, including from the planner. This can't be undone."
          confirmLabel="Delete"
          busy={busy === "delete"}
          onCancel={() => setConfirming(false)}
          onConfirm={() => void remove()}
        />
      )}
    </Sheet>
  );
}
