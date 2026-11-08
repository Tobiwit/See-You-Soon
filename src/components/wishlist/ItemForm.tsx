"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";
import { ITEM_TYPES, type ItemType } from "@/config/app";
import { addItem, ConflictError, updateItem, type ItemInput } from "@/lib/actions";
import type { PreparedImage } from "@/lib/images";
import { authedFetch, useMe } from "@/lib/session";
import { useSpace } from "@/lib/space";
import type { ImageRef, WishItem } from "@/lib/types";
import { ImagePicker } from "../ui/ImagePicker";
import { Photo } from "../ui/Photo";
import { PlaceSearch, type PlacePick } from "../ui/PlaceSearch";
import { Sheet } from "../ui/Sheet";
import { useUI } from "../ui/ui-state";
import p from "../ui/picker.module.css";
import s from "./wishlist.module.css";

type Unsplash = Extract<ImageRef, { kind: "unsplash" }>;
type ImageChoice = { t: "keep" } | { t: "none" } | { t: "upload"; img: PreparedImage } | { t: "remote"; img: Unsplash };

export function normaliseUrl(raw: string): string | null | "invalid" {
  const v = raw.trim();
  if (!v) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "invalid";
    if (!u.hostname.includes(".")) return "invalid";
    return u.toString();
  } catch {
    return "invalid";
  }
}

export function ItemForm({ id }: { id?: string }) {
  const { items, places, sync } = useSpace();
  const { key: me } = useMe();
  const { close, toast, replace } = useUI();
  const original = id ? items.find((i) => i.id === id) : undefined;

  const [place, setPlace] = useState<PlacePick | null>(() => {
    if (!original) return null;
    const pl = places.find((x) => x.id === original.placeId);
    return { existingId: original.placeId, name: original.placeName, city: pl?.city, country: pl?.country, lat: pl?.lat, lon: pl?.lon };
  });
  const [type, setType] = useState<ItemType | "">(original?.type ?? "");
  const [title, setTitle] = useState(original?.title ?? "");
  const [description, setDescription] = useState(original?.description ?? "");
  const [date, setDate] = useState(original?.desiredDate ?? "");
  const [link, setLink] = useState(original?.url ?? "");
  const [image, setImage] = useState<ImageChoice>(original?.image ? { t: "keep" } : { t: "none" });
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string[] | null>(null);

  const urlResult = normaliseUrl(link);
  const errors = {
    place: !place ? "Pick or create a place." : null,
    type: !type ? "Choose a type." : null,
    title: !title.trim() ? "Give it a short title." : title.trim().length > 60 ? "Keep it under 60 characters." : null,
    link: urlResult === "invalid" ? "That doesn't look like a web address." : null,
  };
  const hasErrors = Object.values(errors).some(Boolean);

  const dirty =
    !original
      ? Boolean(place || type || title || description || date || link || image.t !== "none")
      : title !== original.title ||
        description !== original.description ||
        type !== original.type ||
        (date || null) !== original.desiredDate ||
        (link || null) !== original.url ||
        image.t !== "keep" ||
        place?.existingId !== original.placeId;

  const onClose = useCallback(() => {
    if (busy) return;
    if (dirty && !window.confirm("Discard what you've written?")) return;
    close();
  }, [busy, dirty, close]);

  async function submit(e: FormEvent, force = false) {
    e.preventDefault();
    setTouched(true);
    if (hasErrors || !place || !type) return;
    setBusy(true);
    setError(null);
    setConflict(null);
    const input: ItemInput = {
      title,
      description,
      type,
      place,
      desiredDate: date || null,
      url: urlResult === "invalid" ? null : urlResult,
      image: image.t === "keep" ? undefined : image.t === "none" ? null : image.img,
    };
    try {
      if (original) {
        await updateItem(me, original, input, force);
        toast("Saved.", "ok");
        replace({ kind: "item", id: original.id });
      } else {
        const newId = await addItem(me, input);
        toast("Added to the wishlist.", "ok");
        replace({ kind: "item", id: newId });
      }
    } catch (err) {
      if (err instanceof ConflictError) setConflict(err.fields);
      else
        setError(
          sync === "offline" || (err as { code?: string }).code === "unavailable"
            ? "You're offline. Nothing was lost — try again when you're connected."
            : (err as Error).message || "Couldn't save. Your text is still here — try again.",
        );
      setBusy(false);
    }
  }

  const unsplashEnabled = Boolean(process.env.NEXT_PUBLIC_IMAGE_SEARCH_ENABLED);

  return (
    <Sheet
      title={original ? "Edit idea" : "Add an idea"}
      onClose={onClose}
      full
      footer={
        <>
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="item-form" className="btn btn-primary" style={{ flex: 1 }} disabled={busy}>
            {busy && <span className="spinner" />}
            {busy ? (sync === "online" ? "Saving…" : "Waiting for connection…") : original ? "Save changes" : "Add to wishlist"}
          </button>
        </>
      }
    >
      <form id="item-form" onSubmit={(e) => void submit(e)} noValidate>
        {original && !items.find((i) => i.id === id) && <p className="notice error">This idea was deleted.</p>}

        <div className="field">
          <label htmlFor="f-place">
            City / Location <span className="req">required</span>
          </label>
          <PlaceSearch id="f-place" value={place} onChange={setPlace} invalid={touched && Boolean(errors.place)} />
          {touched && errors.place && <span className="err">{errors.place}</span>}
        </div>

        <fieldset className={`field ${s.fieldset}`}>
          <legend className="label">
            Type <span className="req">required</span>
          </legend>
          <div className={s.types}>
            {ITEM_TYPES.map((t) => (
              <label key={t.id} className={s.typeOpt} data-checked={type === t.id || undefined}>
                <input type="radio" name="type" value={t.id} checked={type === t.id} onChange={() => setType(t.id)} className="sr-only" />
                {t.label}
              </label>
            ))}
          </div>
          {touched && errors.type && <span className="err">{errors.type}</span>}
        </fieldset>

        <div className="field">
          <label htmlFor="f-title">
            Title <span className="req">required</span>
          </label>
          <input
            id="f-title"
            className="input"
            value={title}
            maxLength={80}
            placeholder="e.g. Egg coffee at Giảng"
            onChange={(e) => setTitle(e.target.value)}
            aria-invalid={touched && Boolean(errors.title)}
          />
          <span className="hint">{title.trim().length}/60</span>
          {touched && errors.title && <span className="err">{errors.title}</span>}
        </div>

        <div className="field">
          <label htmlFor="f-desc">Description</label>
          <textarea id="f-desc" className="textarea" value={description} maxLength={600} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="f-date">Ideal date</label>
          <input id="f-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
          <span className="hint">A wish, not a booking. Plan it into a day in the Planner.</span>
        </div>

        <div className="field">
          <span className="label">Photo</span>
          <ImageChooser
            value={image}
            onChange={setImage}
            original={original}
            searchSeed={[title, place?.name].filter(Boolean).join(" ")}
            unsplashEnabled={unsplashEnabled}
          />
        </div>

        <div className="field">
          <label htmlFor="f-link">Link</label>
          <input
            id="f-link"
            className="input"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            placeholder="Website, booking or Google Maps link"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onBlur={() => setTouched(true)}
            aria-invalid={Boolean(link) && urlResult === "invalid"}
          />
          {link && urlResult === "invalid" && <span className="err">{errors.link}</span>}
        </div>

        {conflict && (
          <div className="notice warn" role="alert">
            <p style={{ margin: "0 0 8px" }}>
              This idea was changed by the other person while you were editing ({conflict.join(", ")}).
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button type="button" className="btn" onClick={() => replace({ kind: "item", id: id! })}>
                See their version
              </button>
              <button type="button" className="btn btn-primary" onClick={(e) => void submit(e as unknown as FormEvent, true)}>
                Save mine anyway
              </button>
            </div>
          </div>
        )}
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        {touched && hasErrors && !error && <p className="err">Fill in the required fields above.</p>}
      </form>
    </Sheet>
  );
}

function ImageChooser({
  value,
  onChange,
  original,
  searchSeed,
  unsplashEnabled,
}: {
  value: ImageChoice;
  onChange: (v: ImageChoice) => void;
  original?: WishItem;
  searchSeed: string;
  unsplashEnabled: boolean;
}) {
  const [searching, setSearching] = useState(false);
  const preview =
    value.t === "keep" && original?.image ? (
      <Photo image={original.image} alt="Current photo" variant="full" eager />
    ) : value.t === "remote" ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={value.img.thumb} alt={value.img.alt || "Chosen photo"} />
    ) : undefined;

  return (
    <div className={p.picker}>
      <ImagePicker
        value={value.t === "upload" ? value.img : null}
        onChange={(img) => onChange(img ? { t: "upload", img } : { t: "none" })}
        existing={preview}
        label="Upload a photo"
      />
      <div className={p.actions}>
        {unsplashEnabled && (
          <button type="button" className="link-btn" onClick={() => setSearching((v) => !v)}>
            {searching ? "Close photo search" : "Find a photo instead"}
          </button>
        )}
        {(value.t === "keep" || value.t === "remote") && (
          <button type="button" className="link-btn" onClick={() => onChange({ t: "none" })}>
            Remove photo
          </button>
        )}
      </div>
      {value.t === "remote" && (
        <p className="hint" style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>
          Photo by {value.img.credit.name} on Unsplash
        </p>
      )}
      {unsplashEnabled && searching && (
        <UnsplashSearch
          seed={searchSeed}
          selected={value.t === "remote" ? value.img.url : null}
          onPick={(img) => {
            onChange({ t: "remote", img });
            setSearching(false);
          }}
        />
      )}
      {!unsplashEnabled && value.t === "none" && (
        <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>No photo? The card gets a typographic cover instead.</p>
      )}
    </div>
  );
}

interface UResult {
  id: string;
  url: string;
  thumb: string;
  w: number;
  h: number;
  alt: string;
  downloadLocation: string;
  credit: { name: string; link: string };
}

function UnsplashSearch({ seed, selected, onPick }: { seed: string; selected: string | null; onPick: (img: Unsplash) => void }) {
  const [q, setQ] = useState(seed);
  const [results, setResults] = useState<UResult[] | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  const search = useMemo(
    () => async (term: string) => {
      if (term.trim().length < 2) return;
      setState("loading");
      try {
        const res = await authedFetch(`/api/images/search?q=${encodeURIComponent(term)}`);
        if (!res.ok) throw new Error();
        setResults(((await res.json()) as { results: UResult[] }).results);
        setState("idle");
      } catch {
        setState("error");
      }
    },
    [],
  );

  return (
    <div className={p.picker}>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          className="input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void search(q);
            }
          }}
          placeholder="Search photos"
          aria-label="Search photos"
        />
        <button type="button" className="btn" onClick={() => void search(q)} disabled={state === "loading"}>
          {state === "loading" ? <span className="spinner" /> : "Search"}
        </button>
      </div>
      {state === "error" && <p className="notice error">Photo search failed. Try again or upload your own.</p>}
      {results && results.length === 0 && <p style={{ fontSize: 13, color: "var(--muted)" }}>No photos for that. Try simpler words.</p>}
      {results && results.length > 0 && (
        <>
          <div className={p.results}>
            {results.map((r) => (
              <button
                key={r.id}
                type="button"
                className={p.result}
                aria-pressed={selected === r.url}
                aria-label={`${r.alt || "Photo"} by ${r.credit.name}`}
                onClick={() => {
                  void authedFetch("/api/images/track", {
                    method: "POST",
                    body: JSON.stringify({ downloadLocation: r.downloadLocation }),
                  }).catch(() => {});
                  onPick({ kind: "unsplash", url: r.url, thumb: r.thumb, w: r.w, h: r.h, credit: r.credit, alt: r.alt });
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={r.thumb} alt="" loading="lazy" />
              </button>
            ))}
          </div>
          <p style={{ fontSize: 11, color: "var(--muted)", margin: 0 }}>Photos from Unsplash. Only pick one that actually shows the place.</p>
        </>
      )}
    </div>
  );
}
