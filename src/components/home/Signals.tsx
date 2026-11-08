"use client";

import { useMemo, useRef, useState } from "react";
import { MOODS, OWNER, PEOPLE, THINKING_COOLDOWN_MS, partnerOf, type MoodId } from "@/config/app";
import { addMoodPhoto, removeMoodPhoto, selectMoodPhoto, setMood, thinkingOfYou } from "@/lib/actions";
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
      await thinkingOfYou(me, lastMine);
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

export function BetweenUs() {
  const { moods, events, config, moodPhotos } = useSpace();
  const { key: me } = useMe();
  const partner = partnerOf(me);
  const now = useNow(60_000);
  const { toast } = useUI();
  const ref = useReveal<HTMLDivElement>();
  const [saving, setSaving] = useState<MoodId | "clear" | null>(null);

  const mine = activeMood(moods[me], now);
  const photo = moodPhotos.find((p) => p.id === config.moodPhotoId) ?? moodPhotos[0] ?? null;
  // Blur follows the hotter of the two current moods: heavy when nobody has set one, never fully sharp.
  const level = Math.max(
    MOODS.findIndex((m) => m.id === activeMood(moods[me], now)?.mood),
    MOODS.findIndex((m) => m.id === activeMood(moods[partner], now)?.mood),
  );
  const blur = level < 0 ? 30 : BLUR_BY_LEVEL[level];
  const theirs = activeMood(moods[partner], now);
  const theirMood = MOODS.find((m) => m.id === theirs?.mood);
  const lastThought = events.find((e) => e.by === partner && e.type === "thinking_of_you");

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
        {lastThought?.createdAt && (
          <p className={s.thoughtLine}>
            {PEOPLE[partner].name} last thought of you {relativeTime(lastThought.createdAt, now)}.
          </p>
        )}

        <div className={s.mood} data-photo={photo ? "" : undefined}>
          {photo && (
            <div className={s.moodBg} aria-hidden style={{ filter: `blur(${blur}px)` }}>
              <Photo image={{ kind: "upload", id: photo.imageId, w: 0, h: 0 }} variant="full" alt="" />
            </div>
          )}
          <div className={s.moodInner}>
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
                  <span className={s.moodEmoji} aria-hidden>
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
          </div>
        </div>
        {photo && <p className={s.moodBgNote}>The photo sharpens as things heat up — it follows whichever of you is more distracted.</p>}
        {me === OWNER && <MoodBackgrounds activeId={photo?.id ?? null} />}
      </div>
    </section>
  );
}

/** innocent → very distracted. */
const BLUR_BY_LEVEL = [24, 18, 12, 7, 3];

/** Toby only: upload, pick and remove the photos behind the mood section. */
function MoodBackgrounds({ activeId }: { activeId: string | null }) {
  const { moodPhotos } = useSpace();
  const { key: me } = useMe();
  const { toast } = useUI();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function add(file: File | undefined) {
    if (!file) return;
    setBusy("add");
    try {
      await addMoodPhoto(me, await prepareImage(file));
      toast("Background added.", "ok");
    } catch (e) {
      toast((e as Error).message || "Couldn't add that photo.", "error");
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  }

  async function run(id: string, fn: () => Promise<void>, fail: string) {
    setBusy(id);
    try {
      await fn();
    } catch {
      toast(fail, "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className={s.bgManager}>
      <p className="eyebrow">Backgrounds · only you can change these</p>
      <div className={s.bgRow}>
        {moodPhotos.map((p) => (
          <div key={p.id} className={s.bgItem}>
            <button
              type="button"
              className={s.bgThumb}
              aria-pressed={p.id === activeId}
              aria-label={p.id === activeId ? "Current background" : "Use this background"}
              disabled={busy !== null}
              onClick={() => p.id !== activeId && void run(p.id, () => selectMoodPhoto(p.id), "Couldn't switch the background.")}
            >
              <Photo image={{ kind: "upload", id: p.imageId, w: 0, h: 0 }} alt="" />
            </button>
            <button
              type="button"
              className={s.bgRemove}
              aria-label="Remove this background"
              disabled={busy !== null}
              onClick={() => {
                if (!window.confirm("Remove this background photo?")) return;
                const next = moodPhotos.find((x) => x.id !== p.id)?.id ?? null;
                void run(p.id, () => removeMoodPhoto(p, p.id === activeId ? next : activeId), "Couldn't remove it.");
              }}
            >
              ×
            </button>
          </div>
        ))}
        <button type="button" className={s.bgAdd} onClick={() => input.current?.click()} disabled={busy !== null}>
          {busy === "add" ? <span className="spinner" /> : <span aria-hidden>+</span>}
          <span>{busy === "add" ? "Adding…" : "Photo"}</span>
        </button>
        <input ref={input} type="file" accept="image/*" className="sr-only" tabIndex={-1} onChange={(e) => void add(e.target.files?.[0])} />
      </div>
    </div>
  );
}
