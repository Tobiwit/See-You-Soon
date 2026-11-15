"use client";

import { useEffect, useRef, useState } from "react";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  Timestamp,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { OWNER, PEOPLE, SPACE_ID, type PersonKey } from "@/config/app";
import { fb } from "@/lib/firebase";
import { useMe } from "@/lib/session";
import { Photo } from "../ui/Photo";
import { Sheet } from "../ui/Sheet";
import { useUI } from "../ui/ui-state";
import s from "./gallery.module.css";

const PAGE = 12;

interface Shot {
  id: string;
  thumb: string;
  by: PersonKey | null;
  at: Date | null;
}

const when = (d: Date | null) =>
  d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "Date unknown";

/**
 * Toby only: every photo stored in the `images` collection, newest first. Each one has a small
 * twin in `thumbs` (same id), so the grid pages through those — 12 at a time — and only a tapped
 * photo loads its full version.
 */
export function Gallery() {
  const { close } = useUI();
  const { key: me } = useMe();
  const [shots, setShots] = useState<Shot[]>([]);
  const [state, setState] = useState<"loading" | "idle" | "done" | "error">("loading");
  const [open, setOpen] = useState<number | null>(null);
  const cursor = useRef<QueryDocumentSnapshot | null>(null);

  // Fetches the next page of thumbnails (no state changes, so it can start from an effect).
  async function fetchPage() {
    const col = collection(fb().db, "spaces", SPACE_ID, "thumbs");
    const q = cursor.current
      ? query(col, orderBy("createdAt", "desc"), startAfter(cursor.current), limit(PAGE))
      : query(col, orderBy("createdAt", "desc"), limit(PAGE));
    const snap = await getDocs(q);
    const page = snap.docs.flatMap((d): Shot[] => {
      const data = d.get("data");
      if (typeof data !== "string") return [];
      const by = d.get("by");
      const at = d.get("createdAt");
      return [{ id: d.id, thumb: data, by: by === "alex" || by === "toby" ? by : null, at: at instanceof Timestamp ? at.toDate() : null }];
    });
    cursor.current = snap.docs[snap.docs.length - 1] ?? cursor.current;
    return { page, last: snap.size < PAGE };
  }

  function apply(r: { page: Shot[]; last: boolean }) {
    setShots((prev) => [...prev, ...r.page.filter((p) => !prev.some((x) => x.id === p.id))]);
    setState(r.last ? "done" : "idle");
  }

  async function loadPage() {
    setState("loading");
    try {
      apply(await fetchPage());
    } catch {
      setState("error");
    }
  }

  useEffect(() => {
    if (me !== OWNER) return;
    let alive = true;
    fetchPage()
      .then((r) => alive && apply(r))
      .catch(() => alive && setState("error"));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (me !== OWNER) {
    return (
      <Sheet title="Gallery" onClose={close}>
        <p>Only {PEOPLE[OWNER].name} can open the gallery.</p>
      </Sheet>
    );
  }

  const current = open !== null ? shots[open] : null;
  const meta = (sh: Shot) => [sh.by ? `Uploaded by ${PEOPLE[sh.by].name}` : null, when(sh.at)].filter(Boolean).join(" · ");

  return (
    <Sheet title="Gallery" onClose={current ? () => setOpen(null) : close} full>
      {current ? (
        <div className={s.viewer}>
          <div className={s.big}>
            <Photo key={current.id} image={{ kind: "upload", id: current.id, w: 0, h: 0 }} variant="full" alt="" eager />
          </div>
          <p className={s.meta}>{meta(current)}</p>
          <div className={s.nav}>
            <button type="button" className="btn" onClick={() => setOpen((i) => Math.max(0, (i ?? 0) - 1))} disabled={open === 0}>
              ← Newer
            </button>
            <span className={s.count}>
              {(open ?? 0) + 1} / {shots.length}
              {state !== "done" ? "+" : ""}
            </span>
            <button
              type="button"
              className="btn"
              onClick={() => {
                const next = (open ?? 0) + 1;
                if (next < shots.length) setOpen(next);
                else if (state === "idle") void loadPage().then(() => setOpen(next));
              }}
              disabled={open === shots.length - 1 && state !== "idle"}
            >
              Older →
            </button>
          </div>
          <button type="button" className="link-btn" onClick={() => setOpen(null)}>
            Back to all photos
          </button>
        </div>
      ) : (
        <>
          <p className={s.lead}>
            {shots.length} {shots.length === 1 ? "photo" : "photos"}
            {state !== "done" ? " so far" : ""} · newest first
          </p>
          {shots.length > 0 && (
            <ul className={s.grid}>
              {shots.map((sh, i) => (
                <li key={sh.id}>
                  <button type="button" className={s.tile} onClick={() => setOpen(i)} aria-label={`Photo — ${meta(sh)}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={sh.thumb} alt="" loading="lazy" decoding="async" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className={s.more}>
            {state === "loading" && <span className="spinner" />}
            {state === "idle" && (
              <button type="button" className="btn" onClick={() => void loadPage()}>
                Load more
              </button>
            )}
            {state === "done" && shots.length === 0 && <p className={s.empty}>No photos uploaded yet.</p>}
            {state === "error" && (
              <button type="button" className="btn" onClick={() => void loadPage()}>
                Couldn’t load — try again
              </button>
            )}
          </div>
        </>
      )}
    </Sheet>
  );
}
