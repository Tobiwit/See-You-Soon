"use client";

import { useMemo, useRef, useState } from "react";
import { MOODS, PEOPLE, THINKING_COOLDOWN_MS, TRAVELLER, partnerOf, type MoodId } from "@/config/app";
import { removeMoodPhoto, sendSignal, setMood, setMoodPhoto, type SignalKind } from "@/lib/actions";
import { prepareImage } from "@/lib/images";
import { Photo } from "../ui/Photo";
import { relativeTime } from "@/lib/dates";
import { useMe } from "@/lib/session";
import { activeMood, useNow, useSpace } from "@/lib/space";
import { useUI } from "../ui/ui-state";
import { useReveal } from "../ui/useReveal";
import s from "./home.module.css";

/** One tap, one small signal. A short cooldown stops accidental double-sends. */
export function ThinkingButton({ compact = false }: { compact?: boolean }) {
  const { events, sync } = useSpace();
  const { key: me, partner } = useMe();
  const { toast } = useUI();
  const [busy, setBusy] = useState(false);
  const [pulse, setPulse] = useState(0);

  const lastMine = useMemo(() => events.find((e) => e.by === me && e.type === "thinking_of_you")?.createdAt ?? null, [events, me]);

  async function send() {
    if (busy) return;
    if (lastMine && Date.now() - lastMine.getTime() < THINKING_COOLDOWN_MS) {
      toast(`Already on its way to ${partner.name}.`);
      return;
    }
    setBusy(true);
    setPulse((p) => p + 1);
    if (sync === "offline") toast("Offline — it will send when you're back.");
    try {
      await sendSignal(me, "thinking_of_you", lastMine);
      toast(`${partner.name} will know you're thinking of them.`, "ok");
    } catch {
      toast("Couldn't send it. Try again in a moment.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={compact ? s.thinkCompact : s.thinkBig}
      onClick={() => void send()}
      aria-label={`Thinking of you — send a small signal to ${partner.name}`}
      aria-busy={busy}
    >
      <span className={s.thinkGlyph} aria-hidden>
        <svg viewBox="0 0 28 20" width={compact ? 22 : 36} height={compact ? 16 : 26}>
          <circle cx="10" cy="10" r="7.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="18" cy="10" r="7.5" fill="var(--blush)" style={{ mixBlendMode: "multiply" }} />
        </svg>
        {pulse > 0 && <span key={pulse} className={s.thinkRing} />}
      </span>
      {!compact && (
        <span className={s.thinkText}>
          <span className="display">Thinking of you</span>
          <span className={s.thinkSub}>{busy ? "Sending…" : `One tap. ${partner.name} gets a small signal.`}</span>
        </span>
      )}
    </button>
  );
}

const SMALL_SIGNALS: {
  kind: Exclude<SignalKind, "thinking_of_you">;
  title: string;
  sent: (partner: string) => string;
  glyph: React.ReactNode;
}[] = [
  {
    kind: "feeling_down",
    title: "Feeling down",
    sent: (p) => `${p} knows you're feeling down.`,
    glyph: (
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
        <path
          d="M7 15.5h10a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.6-1.2A4 4 0 0 0 7 15.5Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M9 18.5v2M12.5 18v2.5M16 18.5v2" stroke="var(--cobalt)" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    kind: "call_me",
    title: "Call me?",
    sent: (p) => `${p} knows you'd love a call.`,
    glyph: (
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
        <path
          d="M6.6 3.8 9 3.3l1.6 4-1.9 1.3a10.5 10.5 0 0 0 6.7 6.7l1.3-1.9 4 1.6-.5 2.4a2 2 0 0 1-2.1 1.6C10.6 18.5 5.5 13.4 5 6a2 2 0 0 1 1.6-2.2Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M15 3.5a5.5 5.5 0 0 1 5.5 5.5" fill="none" stroke="var(--cobalt)" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
  },
];

/** Two smaller one-tap signals under "Thinking of you", side by side. */
function SmallSignals() {
  const { events, sync } = useSpace();
  const { key: me, partner } = useMe();
  const { toast } = useUI();
  const [busy, setBusy] = useState<SignalKind | null>(null);

  async function send(sig: (typeof SMALL_SIGNALS)[number]) {
    if (busy) return;
    const last = events.find((e) => e.by === me && e.type === sig.kind)?.createdAt ?? null;
    setBusy(sig.kind);
    if (sync === "offline") toast("Offline — it will send when you're back.");
    try {
      // sendSignal applies the cooldown itself.
      const result = await sendSignal(me, sig.kind, last);
      toast(result === "cooldown" ? `Already on its way to ${partner.name}.` : sig.sent(partner.name), result === "cooldown" ? undefined : "ok");
    } catch {
      toast("Couldn't send it. Try again in a moment.", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={s.signalRow}>
      {SMALL_SIGNALS.map((sig) => (
        <button
          key={sig.kind}
          type="button"
          className={s.signalSmall}
          onClick={() => void send(sig)}
          aria-label={`${sig.title} — send a signal to ${partner.name}`}
          aria-busy={busy === sig.kind}
        >
          <span className={s.signalGlyph}>{busy === sig.kind ? <span className="spinner" /> : sig.glyph}</span>
          <span className={`display ${s.signalTitle}`}>{sig.title}</span>
        </button>
      ))}
    </div>
  );
}

export function BetweenUs() {
  const { moods, events, config, moodPhotos } = useSpace();
  const { key: me } = useMe();
  const partner = partnerOf(me);
  const now = useNow(60_000);
  const { toast } = useUI();
  const ref = useReveal<HTMLDivElement>();
  const [saving, setSaving] = useState<MoodId | "clear" | null>(null);

  const mine = activeMood(moods[me], now);
  const theirs = activeMood(moods[partner], now);
  const theirMood = MOODS.find((m) => m.id === theirs?.mood);
  const lastThought = events.find((e) => e.by === partner && e.type === "thinking_of_you");

  // You see the picture your partner chose for the mood you selected.
  const tier = MOODS.find((m) => m.id === mine?.mood) ?? null;
  const picture = tier ? moodPhotos.find((p) => p.by === partner && p.tier === tier.id) : undefined;
  // Each tap replays the "peek" (alternating names restarts the CSS animation).
  const [peeks, setPeeks] = useState(0);

  async function choose(id: MoodId | null) {
    setSaving(id ?? "clear");
    try {
      await setMood(me, id, config.moodExpiryHours);
    } catch {
      toast("Couldn't update your mood.", "error");
    } finally {
      setSaving(null);
    }
  }

  return (
    <section id="between-us" className={s.between} aria-labelledby="between-h">
      <div ref={ref} className="reveal">
        <p className="eyebrow" id="between-h">
          Between us
        </p>
        <ThinkingButton />
        <SmallSignals />
        {lastThought?.createdAt && (
          <p className={s.thoughtLine}>
            {PEOPLE[partner].name} last thought of you {relativeTime(lastThought.createdAt, now)}.
          </p>
        )}

        <div className={s.mood}>
          <h3 className={s.moodTitle}>
            State of mind <span>a.k.a. the horniness indicator</span>
          </h3>

          <p className={s.moodTheirs}>
            {theirMood ? (
              <>
                <span className={s.moodEmoji} aria-hidden>
                  {theirMood.emoji}
                </span>
                <span>
                  {PEOPLE[partner].name}: <strong>{theirMood.label}</strong>
                  <span className={s.moodWhen}> · {relativeTime(theirs?.updatedAt, now)}</span>
                </span>
              </>
            ) : (
              <span className={s.moodWhen}>{PEOPLE[partner].name} hasn&apos;t set a mood lately.</span>
            )}
          </p>

          <div className={s.moodPicker} role="group" aria-label="Your mood">
            {MOODS.map((m) => (
              <button
                key={m.id}
                type="button"
                className={s.moodBtn}
                aria-pressed={mine?.mood === m.id}
                disabled={saving !== null}
                onClick={() => void choose(mine?.mood === m.id ? null : m.id)}
              >
                <span className={s.moodChip} aria-hidden>
                  {saving === m.id ? <span className="spinner" /> : m.emoji}
                </span>
                <span className={s.moodLabel}>{m.label}</span>
              </button>
            ))}
          </div>
          <p className={s.moodFoot}>
            {mine ? (
              <>
                Yours fades{" "}
                {mine.expiresAt ? `at ${mine.expiresAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "soon"}.{" "}
                <button type="button" className="link-btn" onClick={() => void choose(null)} disabled={saving !== null}>
                  Clear it now
                </button>
              </>
            ) : (
              `Optional. Fades after ${config.moodExpiryHours} hours.`
            )}
          </p>

          {tier && picture && (
            <figure className={s.moodPicture}>
              <button
                type="button"
                className={s.moodPictureFrame}
                data-peek={peeks ? (peeks % 2 ? "a" : "b") : undefined}
                onClick={() => setPeeks((n) => n + 1)}
                aria-label={`Picture for ${tier.label} — tap to peek`}
              >
                <Photo key={picture.imageId} image={{ kind: "upload", id: picture.imageId, w: 0, h: 0 }} variant="full" alt="" />
              </button>
              <figcaption>Tap to peek</figcaption>
            </figure>
          )}
        </div>
        <MoodPictures />
      </div>
    </section>
  );
}

/** Your own set: one picture per mood tier, shown to your partner when they pick that mood. */
function MoodPictures() {
  const { moodPhotos: all } = useSpace();
  const { key: me } = useMe();
  const { toast } = useUI();
  const moodPhotos = useMemo(() => all.filter((p) => p.by === me), [all, me]);
  const input = useRef<HTMLInputElement>(null);
  const target = useRef<MoodId | null>(null);
  const [busy, setBusy] = useState<MoodId | null>(null);

  function pick(tier: MoodId) {
    target.current = tier;
    input.current?.click();
  }

  async function upload(file: File | undefined) {
    const tier = target.current;
    if (!file || !tier) return;
    setBusy(tier);
    try {
      const prev = moodPhotos.find((p) => p.tier === tier) ?? null;
      await setMoodPhoto(me, tier, await prepareImage(file), prev && { id: prev.id, imageId: prev.imageId });
      toast(`Picture set for “${MOODS.find((m) => m.id === tier)?.label}”.`, "ok");
    } catch (e) {
      toast(
        (e as { code?: string }).code === "permission-denied"
          ? "The server refused this — are the latest firestore.rules published?"
          : (e as Error).message || "Couldn't add that photo.",
        "error",
      );
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  }

  async function remove(tier: MoodId, id: string, imageId: string) {
    if (!window.confirm("Remove this picture?")) return;
    setBusy(tier);
    try {
      await removeMoodPhoto(id, imageId);
    } catch {
      toast("Couldn't remove it.", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={s.bgManager}>
      <p className="eyebrow">You can add a picture for each Mood</p>
      {me === TRAVELLER && <p className={s.bgNote}>Fühl dich nicht gezwungen {PEOPLE[me].name} &lt;3</p>}
      <div className={s.tierRow}>
        {MOODS.map((m) => {
          const photo = moodPhotos.find((p) => p.tier === m.id);
          return (
            <div key={m.id} className={s.tierItem}>
              <button
                type="button"
                className={s.tierSlot}
                disabled={busy !== null}
                onClick={() => pick(m.id)}
                aria-label={`${photo ? "Replace" : "Add"} the picture for ${m.label}`}
              >
                {busy === m.id ? (
                  <span className="spinner" />
                ) : photo ? (
                  <Photo key={photo.imageId} image={{ kind: "upload", id: photo.imageId, w: 0, h: 0 }} alt="" />
                ) : (
                  <span className={s.tierPlus} aria-hidden>
                    +
                  </span>
                )}
              </button>
              {photo && busy === null && (
                <button
                  type="button"
                  className={s.bgRemove}
                  aria-label={`Remove the picture for ${m.label}`}
                  onClick={() => void remove(m.id, photo.id, photo.imageId)}
                >
                  ×
                </button>
              )}
              <span className={s.tierLabel}>
                {m.emoji} {m.label}
              </span>
            </div>
          );
        })}
      </div>
      <input ref={input} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={(e) => void upload(e.target.files?.[0])} />
    </div>
  );
}
