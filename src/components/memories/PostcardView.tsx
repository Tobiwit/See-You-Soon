"use client";

import { useEffect, useState } from "react";
import { PEOPLE } from "@/config/app";
import { deletePostcard, markEventSeen, markPostcardRead } from "@/lib/actions";
import { useMe } from "@/lib/session";
import { useSpace } from "@/lib/space";
import { Photo } from "../ui/Photo";
import { Confirm, Sheet } from "../ui/Sheet";
import { useUI } from "../ui/ui-state";
import s from "./memories.module.css";

/** A postcard you can turn over. Opening one addressed to you marks it read. */
export function PostcardView({ id }: { id: string }) {
  const { postcards, events, loaded } = useSpace();
  const { key: me } = useMe();
  const { close, toast } = useUI();
  const p = postcards.find((x) => x.id === id);
  const [back, setBack] = useState(() => !p?.image);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!p || p.to !== me) return;
    if (!p.readAt && !p.pending) void markPostcardRead(p.id).catch(() => {});
    const ev = events.find((e) => e.type === "postcard_created" && e.refId === p.id && !e.seen[me]);
    if (ev) void markEventSeen(me, ev.id).catch(() => {});
  }, [p, me, events]);

  if (!p) {
    return (
      <Sheet title="Postcard" onClose={close}>
        <p>{loaded ? "This postcard couldn't be found." : "Loading…"}</p>
      </Sheet>
    );
  }

  const from = PEOPLE[p.by]?.name ?? "";
  const to = PEOPLE[p.to]?.name ?? "";
  const date = p.createdAt?.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }) ?? "";

  return (
    <Sheet title={p.title || `Postcard from ${from}`} onClose={close} tone="ink">
      <div className={s.flipWrap}>
        <button
          type="button"
          className={s.flip}
          data-back={back || undefined}
          onClick={() => setBack((b) => !b)}
          aria-label={back ? "Show the photo side" : "Turn over to read"}
        >
          <span className={s.front} aria-hidden={back}>
            {p.image ? (
              <Photo saver image={p.image} variant="full" alt={p.title || "Postcard photo"} eager />
            ) : (
              <span className={s.cardType}>
                <span className="display">{p.title || `From ${from}`}</span>
              </span>
            )}
          </span>
          <span className={s.back} aria-hidden={!back}>
            <span className={s.backMsg}>
              {p.title && <span className={s.backTitle}>{p.title}</span>}
              <span className={s.backText}>{p.message}</span>
              <span className={s.backSign}>— {from}</span>
            </span>
            <span className={s.backSide}>
              <span className={s.stamp}>
                <span className="display">{from.slice(0, 1)}</span>
              </span>
              <span className={s.postmark}>
                {p.place || "Somewhere"}
                <br />
                {p.createdAt?.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit" })}
              </span>
              <span className={s.addr}>
                To
                <br />
                <strong>{to}</strong>
              </span>
            </span>
          </span>
        </button>
      </div>
      <p className={s.flipHint}>{back ? "Tap the card to see the photo." : "Tap the card to turn it over."}</p>
      <div className={s.viewFoot}>
        <p className={s.viewMeta}>
          From {from} to {to} · {date}
          {p.place ? ` · ${p.place}` : ""}
        </p>
        {p.by === me && !confirming && (
          <button type="button" className={`icon-btn ${s.trash}`} aria-label="Delete this postcard" onClick={() => setConfirming(true)}>
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden>
              <path
                d="M3.5 5.5h13M8 5.5V3.8c0-.4.3-.8.8-.8h2.4c.5 0 .8.4.8.8v1.7M5.2 5.5l.8 10.7c0 .5.5.8 1 .8h6c.5 0 1-.3 1-.8l.8-10.7M8.3 8.5v5.5M11.7 8.5v5.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>
      {confirming && (
        <Confirm
          title="Delete this postcard?"
          body={`It disappears for both of you, including from ${PEOPLE[p.to]?.name ?? "the other person"}'s activity. This can't be undone.`}
          confirmLabel="Delete"
          busy={deleting}
          onCancel={() => setConfirming(false)}
          onConfirm={async () => {
            setDeleting(true);
            try {
              const eventIds = events.filter((e) => e.type === "postcard_created" && e.refId === p.id && e.by === me).map((e) => e.id);
              await deletePostcard(p, eventIds);
              toast("Postcard deleted.", "ok");
              close();
            } catch {
              toast("Couldn't delete it. Try again.", "error");
              setDeleting(false);
            }
          }}
        />
      )}
      {/* Full message for assistive tech regardless of side */}
      <div className="sr-only">
        <p>{p.message}</p>
      </div>
    </Sheet>
  );
}
