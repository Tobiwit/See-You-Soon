"use client";

import { useMemo } from "react";
import { PEOPLE, type PersonKey } from "@/config/app";
import { dayKeyInTz, formatDay } from "@/lib/dates";
import { useMe } from "@/lib/session";
import { useSpace } from "@/lib/space";
import type { ImageRef, Postcard } from "@/lib/types";
import { Photo } from "../ui/Photo";
import { useUI } from "../ui/ui-state";
import { DailyBlock } from "./Daily";
import s from "./memories.module.css";

export function Memories() {
  const { postcards, moments, items, config, loaded } = useSpace();
  const { key: me, partner } = useMe();
  const { open } = useUI();

  // One stack per sender. Postcards arrive newest first, so the sender who wrote
  // most recently comes first and each stack's first card is its newest.
  const stacks = useMemo(() => {
    const bySender = new Map<PersonKey, Postcard[]>();
    for (const p of postcards) {
      const list = bySender.get(p.by);
      if (list) list.push(p);
      else bySender.set(p.by, [p]);
    }
    return [...bySender.entries()].map(([by, cards]) => ({ by, top: cards[0], older: cards.slice(1) }));
  }, [postcards]);

  // Moments + visited wishlist items, newest day first. Visited items are linked, not copied.
  const timeline = useMemo(() => {
    type Entry =
      | { kind: "moment"; id: string; day: string; caption: string; image: ImageRef | null; by: string }
      | { kind: "visit"; id: string; day: string; title: string; note: string; image: ImageRef | null; place: string };
    const entries: Entry[] = [];
    for (const m of moments) entries.push({ kind: "moment", id: m.id, day: m.date, caption: m.caption, image: m.image, by: PEOPLE[m.by]?.name ?? "" });
    for (const it of items) {
      if (!it.visited) continue;
      const day = it.visitedAt ? dayKeyInTz(it.visitedAt, config.timezone) : it.plannedDate ?? "";
      entries.push({ kind: "visit", id: it.id, day, title: it.title, note: it.visitNote, image: it.visitImage ?? it.image, place: it.placeName });
    }
    entries.sort((a, b) => b.day.localeCompare(a.day));
    const groups: { day: string; entries: Entry[] }[] = [];
    for (const e of entries) {
      const g = groups[groups.length - 1];
      if (g && g.day === e.day) g.entries.push(e);
      else groups.push({ day: e.day, entries: [e] });
    }
    return groups;
  }, [moments, items, config.timezone]);

  return (
    <section id="memories" className={s.section} aria-labelledby="memories-h">
      <header className={s.head}>
        <p className="eyebrow">Memories</p>
        <div className={s.titleRow}>
          <h2 id="memories-h" className={s.h}>
            Postcards
          </h2>
        </div>
        <button type="button" className={`btn btn-primary ${s.write}`} onClick={() => open({ kind: "compose" })}>
          Write {partner.name} a postcard
        </button>
      </header>

      {loaded && postcards.length === 0 ? (
        <p className={s.empty}>No postcards yet. The first one is yours to send.</p>
      ) : (
        <div className={s.stacks}>
          {stacks.map((st, i) => (
            <section key={st.by} className={s.stackGroup} aria-label={`Postcards from ${PEOPLE[st.by]?.name ?? ""}`}>
              <div
                className={s.stack}
                data-depth={Math.min(2, st.older.length) || undefined}
                style={{ ["--tilt" as string]: `${i % 2 ? 1.1 : -0.9}deg` }}
              >
                <PostcardFront postcard={st.top} me={me} onOpen={() => open({ kind: "postcard", id: st.top.id })} />
              </div>
              {st.older.length > 0 && (
                <ul className={s.minis} aria-label="Older postcards">
                  {st.older.map((p) => (
                    <li key={p.id}>
                      <MiniPostcard postcard={p} me={me} onOpen={() => open({ kind: "postcard", id: p.id })} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}

      <DailyBlock />

      <div className={s.collected}>
        <div className={s.titleRow}>
          <h3 className={s.h3}>Collected</h3>
          <button type="button" className="btn" onClick={() => open({ kind: "moment-form" })}>
            <span aria-hidden>+</span> Moment
          </button>
        </div>
        {timeline.length === 0 ? (
          <p className={s.empty}>Photos, small moments and places you&apos;ve marked as visited will gather here.</p>
        ) : (
          timeline.map((g) => (
            <div key={g.day || "undated"} className={s.group}>
              <p className={s.groupDay}>{g.day ? formatDay(g.day, { weekday: "long", day: "numeric", month: "long" }) : "Undated"}</p>
              {g.entries.map((e) =>
                e.kind === "moment" ? (
                  <button key={`m-${e.id}`} type="button" className={s.entry} onClick={() => open({ kind: "moment", id: e.id })}>
                    {e.image && (
                      <span className={s.entryImg}>
                        <Photo image={e.image} alt={e.caption || "Moment"} />
                      </span>
                    )}
                    <span className={s.entryText}>
                      {e.caption && <span className={s.caption}>{e.caption}</span>}
                      <span className={s.entryMeta}>Moment · {e.by}</span>
                    </span>
                  </button>
                ) : (
                  <button key={`v-${e.id}`} type="button" className={s.entry} onClick={() => open({ kind: "item", id: e.id })}>
                    {e.image && (
                      <span className={s.entryImg}>
                        <Photo saver image={e.image} alt={e.title} />
                      </span>
                    )}
                    <span className={s.entryText}>
                      <span className={s.visitTitle}>✓ {e.title}</span>
                      {e.note && <span className={s.caption}>{e.note}</span>}
                      <span className={s.entryMeta}>Visited · {e.place} · from the wishlist</span>
                    </span>
                  </button>
                ),
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

/** Small version of an older postcard, three to a row. */
function MiniPostcard({ postcard: p, me, onOpen }: { postcard: Postcard; me: string; onOpen: () => void }) {
  const unread = p.to === me && !p.readAt;
  const date = p.createdAt ? p.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "";
  return (
    <button
      type="button"
      className={s.mini}
      onClick={onOpen}
      aria-label={`Postcard${p.title ? `: ${p.title}` : ""}, ${date}${unread ? ", unread" : ""}`}
    >
      <span className={s.miniFace}>
        {p.image ? (
          <Photo saver image={p.image} alt="" />
        ) : (
          <span className={s.miniType} aria-hidden>
            <span className="display">{p.title || "Postcard"}</span>
          </span>
        )}
        {unread && <span className={s.miniUnread} aria-hidden />}
      </span>
      <span className={s.miniDate}>{date}</span>
    </button>
  );
}

function PostcardFront({ postcard: p, me, onOpen }: { postcard: Postcard; me: string; onOpen: () => void }) {
  const unread = p.to === me && !p.readAt;
  const from = PEOPLE[p.by]?.name ?? "";
  const date = p.createdAt ? p.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "";
  return (
    <button type="button" className={s.card} onClick={onOpen} aria-label={`Postcard from ${from}${p.title ? `: ${p.title}` : ""}${unread ? ", unread" : ""}`}>
      <span className={s.cardFace}>
        {p.image ? (
          <Photo saver image={p.image} alt="" />
        ) : (
          <span className={s.cardType} aria-hidden>
            <span className="display">{p.title || `From ${from}`}</span>
          </span>
        )}
        {unread && <span className={s.unread}>New · for you</span>}
        {p.pending && <span className={s.sending}>Sending…</span>}
      </span>
      <span className={s.cardStrip}>
        <span className={s.cardTitle}>{p.title || "Untitled"}</span>
        <span className={s.cardMeta}>
          From {from}
          {p.place ? ` · ${p.place}` : ""} · {date}
        </span>
      </span>
    </button>
  );
}
