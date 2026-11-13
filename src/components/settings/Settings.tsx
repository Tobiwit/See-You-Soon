"use client";

import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { OWNER, PEOPLE, type RouteStop, type SpaceConfig } from "@/config/app";
import { savePushSubscription, saveQuestionOrder, setCover, updateConfig } from "@/lib/actions";
import { effectiveOrder, questionById, useDaily } from "@/lib/daily";
import { lowDataOnLaunch, setLowDataOnLaunch } from "@/lib/data-mode";
import { diffDays, isDayKey } from "@/lib/dates";
import type { PreparedImage } from "@/lib/images";
import { useMe, useSession } from "@/lib/session";
import { useSpace, type SyncStatus } from "@/lib/space";
import { ImagePicker } from "../ui/ImagePicker";
import { Photo } from "../ui/Photo";
import { PlaceSearch, type PlacePick } from "../ui/PlaceSearch";
import { Sheet } from "../ui/Sheet";
import { useUI } from "../ui/ui-state";
import s from "./settings.module.css";

const SYNC_TEXT: Record<SyncStatus, string> = {
  online: "Connected — changes sync instantly.",
  connecting: "Connecting…",
  offline: "Offline — showing the last synced copy.",
  denied: "The server refused access (check rules / account emails).",
  error: "Can't reach the server.",
};

export function Settings() {
  const { close } = useUI();
  const { state, signOutNow } = useSession();
  const { me } = useMe();
  const { sync, config } = useSpace();
  const email = state.status === "ready" ? state.user.email : "";

  return (
    <Sheet title="Settings" onClose={close} full>
      <section className={s.block}>
        <p className="eyebrow">You</p>
        <p className={s.big}>{me.name}</p>
        <p className="meta">{email}</p>
        <p className={s.sync} data-state={sync}>
          {SYNC_TEXT[sync]}
        </p>
        <button type="button" className="btn" onClick={() => void signOutNow()}>
          Sign out on this device
        </button>
      </section>

      <InstallHint />
      <Notifications />
      <DataSaving />
      {me.key === OWNER ? (
        <>
          <CoverSetting />
          <TripSettings key={JSON.stringify(pickTrip(config))} />
          <RouteSettings key={JSON.stringify(config.route)} />
          <QuestionSettings />
        </>
      ) : (
        <section className={s.block}>
          <p className="eyebrow">Trip settings</p>
          <p>Dates, the cover photo and the route are looked after by {PEOPLE[OWNER].name}.</p>
        </section>
      )}
    </Sheet>
  );
}

const isIOS = () => typeof navigator !== "undefined" && /iPhone|iPad|iPod/.test(navigator.userAgent);
const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

function InstallHint() {
  const standalone = useSyncExternalStore(
    () => () => {},
    isStandalone,
    () => true,
  );
  if (standalone) return null;
  return (
    <section className={s.block}>
      <p className="eyebrow">Put it on your Home Screen</p>
      {isIOS() ? (
        <ol className={s.steps}>
          <li>In Safari, tap the Share button (square with an arrow).</li>
          <li>Choose “Add to Home Screen”.</li>
          <li>Open it from the new icon — it runs full-screen, like an app.</li>
        </ol>
      ) : (
        <p>Open this page in Safari on your iPhone, tap Share → “Add to Home Screen”.</p>
      )}
    </section>
  );
}

function urlB64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function Notifications() {
  const { key: me, partner } = useMe();
  const { members } = useSpace();
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">(() =>
    "Notification" in window && "serviceWorker" in navigator && "PushManager" in window ? Notification.permission : "unsupported",
  );
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enabled = Boolean(process.env.NEXT_PUBLIC_PUSH_ENABLED);

  useEffect(() => {
    if (perm === "unsupported") return;
    void navigator.serviceWorker.ready.then((reg) => reg.pushManager.getSubscription()).then((sub) => setSubscribed(Boolean(sub)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!enabled) return null;

  async function turnOn() {
    setBusy(true);
    setError(null);
    try {
      const p = await Notification.requestPermission();
      setPerm(p);
      if (p !== "granted") return;
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
        }));
      await savePushSubscription(me, sub.toJSON());
      setSubscribed(true);
    } catch {
      setError("Couldn't turn notifications on. In-app updates still work.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      await (await reg.pushManager.getSubscription())?.unsubscribe();
      await savePushSubscription(me, null);
      setSubscribed(false);
    } catch {
      setError("Couldn't turn them off.");
    } finally {
      setBusy(false);
    }
  }

  const partnerOn = Boolean(members[partner.key]?.push);

  return (
    <section className={s.block}>
      <p className="eyebrow">Notifications</p>
      <p>
        Get a quiet alert when {partner.name} sends a postcard, adds an idea, sends a signal, answers the daily question or turns the mood up. Optional — the cover
        always shows what&apos;s new.
      </p>
      {perm === "unsupported" ? (
        <p className="notice">
          {isIOS() && !isStandalone()
            ? "On iPhone, notifications only work from the Home Screen app (iOS 16.4+). Add it to your Home Screen first."
            : "This browser doesn't support web notifications."}
        </p>
      ) : perm === "denied" ? (
        <p className="notice warn">
          Notifications are blocked for this app. To allow them, open iOS Settings → Notifications → See You Soon.
        </p>
      ) : subscribed ? (
        <div className={s.row}>
          <span className={s.on}>On for this device</span>
          <button type="button" className="link-btn" onClick={() => void turnOff()} disabled={busy}>
            Turn off
          </button>
        </div>
      ) : (
        <button type="button" className="btn btn-primary" onClick={() => void turnOn()} disabled={busy}>
          {busy && <span className="spinner" />}
          Turn on notifications
        </button>
      )}
      <p className="meta">
        {partner.name}: {partnerOn ? "notifications on" : "notifications off"}
      </p>
      {error && <p className="notice error">{error}</p>}
    </section>
  );
}

function CoverSetting() {
  const { config } = useSpace();
  const { key: me } = useMe();
  const { toast } = useUI();
  const [img, setImg] = useState<PreparedImage | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(next: PreparedImage | null) {
    setBusy(true);
    try {
      await setCover(me, next, config.coverImageId);
      setImg(null);
      toast(next ? "New cover photo." : "Cover photo removed.", "ok");
    } catch {
      toast("Couldn't save the cover photo.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={s.block}>
      <p className="eyebrow">Cover photo</p>
      <p>A photo of the two of you. It&apos;s softened behind the title.</p>
      <ImagePicker
        value={img}
        onChange={setImg}
        aspect="3 / 4"
        label="Choose a cover photo"
        existing={config.coverImageId ? <Photo image={{ kind: "upload", id: config.coverImageId, w: 0, h: 0 }} variant="full" alt="Current cover" eager cached /> : undefined}
      />
      <div className={s.row}>
        {img && (
          <button type="button" className="btn btn-primary" onClick={() => void save(img)} disabled={busy}>
            {busy && <span className="spinner" />}
            Use this photo
          </button>
        )}
        {config.coverImageId && !img && (
          <button type="button" className="link-btn" onClick={() => void save(null)} disabled={busy}>
            Remove cover photo
          </button>
        )}
      </div>
    </section>
  );
}

const TIMEZONES = ["Asia/Ho_Chi_Minh", "Asia/Tokyo", "Asia/Seoul", "Asia/Tashkent", "Europe/Berlin", "Europe/London", "UTC"];

function TripSettings() {
  const { config } = useSpace();
  const { toast } = useUI();
  const [form, setForm] = useState(() => pickTrip(config));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const dates = [form.separationStart, form.reunionDate, form.tripStart, form.tripEnd];
    if (!dates.every(isDayKey) || !/^\d{2}:\d{2}$/.test(form.reunionTime)) return setError("Fill in every date and the time.");
    if (diffDays(form.separationStart, form.reunionDate) <= 0) return setError("The reunion must be after the first day apart.");
    if (diffDays(form.tripStart, form.tripEnd) < 0) return setError("The trip must end after it starts.");
    if (diffDays(form.separationStart, form.tripEnd) > 400) return setError("That's a very long stretch — check the dates.");
    if (!form.title.trim()) return setError("The title can't be empty.");
    setBusy(true);
    setError(null);
    try {
      await updateConfig({ ...form, title: form.title.trim(), moodExpiryHours: Math.min(48, Math.max(1, Number(form.moodExpiryHours) || 6)) });
      toast("Dates saved for both of you.", "ok");
    } catch {
      setError("Couldn't save. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={s.block}>
      <p className="eyebrow">Dates &amp; details</p>
      <form onSubmit={(e) => void submit(e)} noValidate>
        <div className="field">
          <label htmlFor="st-title">Title on the cover</label>
          <input id="st-title" className="input" value={form.title} maxLength={40} onChange={(e) => set("title", e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="st-sep">First day apart</label>
          <input id="st-sep" type="date" className="input" value={form.separationStart} onChange={(e) => set("separationStart", e.target.value)} />
        </div>
        <div className={s.two}>
          <div className="field">
            <label htmlFor="st-rd">Reunion day</label>
            <input id="st-rd" type="date" className="input" value={form.reunionDate} onChange={(e) => set("reunionDate", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="st-rt">Time</label>
            <input id="st-rt" type="time" className="input" value={form.reunionTime} onChange={(e) => set("reunionTime", e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="st-rp">Reunion place</label>
          <input id="st-rp" className="input" value={form.reunionPlace} onChange={(e) => set("reunionPlace", e.target.value)} />
        </div>
        <div className={s.two}>
          <div className="field">
            <label htmlFor="st-ts">Trip starts</label>
            <input id="st-ts" type="date" className="input" value={form.tripStart} onChange={(e) => set("tripStart", e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="st-te">Trip ends</label>
            <input id="st-te" type="date" className="input" value={form.tripEnd} onChange={(e) => set("tripEnd", e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="st-tz">Timezone for all dates</label>
          <select id="st-tz" className="select" value={form.timezone} onChange={(e) => set("timezone", e.target.value)}>
            {[...new Set([form.timezone, ...TIMEZONES])].map((t) => (
              <option key={t} value={t}>
                {t.replace("_", " ")}
              </option>
            ))}
          </select>
          <span className="hint">The reunion time, “today” and the planner all use this zone.</span>
        </div>
        <div className="field">
          <label htmlFor="st-mood">Moods fade after (hours)</label>
          <input
            id="st-mood"
            type="number"
            min={1}
            max={48}
            className="input"
            value={form.moodExpiryHours}
            onChange={(e) => set("moodExpiryHours", Number(e.target.value))}
          />
        </div>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy && <span className="spinner" />}
          Save dates
        </button>
      </form>
    </section>
  );
}

function pickTrip(c: SpaceConfig) {
  return {
    title: c.title,
    separationStart: c.separationStart,
    reunionDate: c.reunionDate,
    reunionTime: c.reunionTime,
    reunionPlace: c.reunionPlace,
    tripStart: c.tripStart,
    tripEnd: c.tripEnd,
    timezone: c.timezone,
    moodExpiryHours: c.moodExpiryHours,
  };
}

function RouteSettings() {
  const { config } = useSpace();
  const { toast } = useUI();
  const [stops, setStops] = useState<RouteStop[]>(config.route);
  const [adding, setAdding] = useState<PlacePick | null>(null);
  const [busy, setBusy] = useState(false);
  const changed = JSON.stringify(stops) !== JSON.stringify(config.route);

  function move(i: number, d: -1 | 1) {
    const j = i + d;
    if (j < 0 || j >= stops.length) return;
    const next = [...stops];
    [next[i], next[j]] = [next[j], next[i]];
    setStops(next);
  }

  function add(p: PlacePick | null) {
    setAdding(null);
    if (!p || typeof p.lat !== "number" || typeof p.lon !== "number") {
      if (p) toast("Pick a result from the map so it can be drawn.", "error");
      return;
    }
    setStops((st) => [...st, { id: crypto.randomUUID().slice(0, 8), name: p.name, lat: p.lat!, lon: p.lon! }]);
  }

  async function save() {
    setBusy(true);
    try {
      await updateConfig({ route: stops });
      toast("Route saved.", "ok");
    } catch {
      toast("Couldn't save the route.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={s.block}>
      <p className="eyebrow">Journey route</p>
      <p>The stops drawn on the map, in order. The highlighted stop follows the shared location.</p>
      <ol className={s.stops}>
        {stops.map((st, i) => (
          <li key={st.id}>
            <span className={s.stopName}>
              {i + 1}. {st.name}
            </span>
            <span className={s.stopBtns}>
              <button type="button" className="icon-btn" aria-label={`Move ${st.name} up`} onClick={() => move(i, -1)} disabled={i === 0}>
                ↑
              </button>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Move ${st.name} down`}
                onClick={() => move(i, 1)}
                disabled={i === stops.length - 1}
              >
                ↓
              </button>
              <button type="button" className="icon-btn" aria-label={`Remove ${st.name}`} onClick={() => setStops(stops.filter((x) => x.id !== st.id))}>
                ×
              </button>
            </span>
          </li>
        ))}
      </ol>
      <div className="field">
        <label htmlFor="route-add">Add a stop</label>
        <PlaceSearch id="route-add" value={adding} onChange={add} includeSaved={false} placeholder="City or country" />
      </div>
      {changed && (
        <div className={s.row}>
          <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={busy || stops.length === 0}>
            {busy && <span className="spinner" />}
            Save route
          </button>
          <button type="button" className="link-btn" onClick={() => setStops(config.route)}>
            Undo changes
          </button>
        </div>
      )}
    </section>
  );
}

/** Owner only: reorder the questions that haven't been asked yet. */
function QuestionSettings() {
  const { order, todayIndex, remaining } = useDaily();
  const upcoming = order.slice(Math.max(0, todayIndex + 1));
  // Remount when the saved order or the day changes, so the editable list starts fresh.
  return <QuestionOrderEditor key={`${todayIndex}|${upcoming.join(",")}`} upcoming={upcoming} asked={Math.max(0, Math.min(order.length, todayIndex + 1))} remaining={remaining} />;
}

function QuestionOrderEditor({ upcoming, asked, remaining }: { upcoming: string[]; asked: number; remaining: number }) {
  const { toast } = useUI();
  const { questionOrder } = useSpace();
  const daily = useDaily();
  const [list, setList] = useState(upcoming);
  const [busy, setBusy] = useState(false);
  const changed = list.join(",") !== upcoming.join(",");
  const current = daily.todayIndex >= 0 ? daily.byDay.get(daily.today)?.question ?? null : null;

  function move(i: number, d: -1 | 1) {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    setList(next);
  }

  async function save() {
    setBusy(true);
    try {
      // Re-derive what's already asked (incl. today's) at save time, then append the new order.
      const full = effectiveOrder(questionOrder);
      const locked = full.slice(0, Math.max(0, daily.todayIndex + 1));
      await saveQuestionOrder([...locked, ...list.filter((id) => !locked.includes(id))]);
      toast("Question order saved.", "ok");
    } catch {
      toast("Couldn't save the order.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={s.block}>
      <p className="eyebrow">Daily questions</p>
      <p>
        <strong>{remaining}</strong> {remaining === 1 ? "question" : "questions"} still to come · {asked} asked so far. New ones are added in{" "}
        <code>src/config/questions.ts</code>.
      </p>
      {current && (
        <p className="meta">
          Today: {current.text}
        </p>
      )}
      {list.length > 0 && (
        <ol className={s.stops}>
          {list.map((id, i) => {
            const q = questionById(id);
            if (!q) return null;
            return (
              <li key={id}>
                <span className={`${s.stopName} ${s.qName}`}>
                  {i + 1}. {q.text}
                  <span className={s.qKind}>{q.kind === "choice" ? " · choice" : " · free"}</span>
                </span>
                <span className={s.stopBtns}>
                  <button type="button" className="icon-btn" aria-label={`Move “${q.text}” earlier`} onClick={() => move(i, -1)} disabled={i === 0}>
                    ↑
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Move “${q.text}” later`}
                    onClick={() => move(i, 1)}
                    disabled={i === list.length - 1}
                  >
                    ↓
                  </button>
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {changed && (
        <div className={s.row}>
          <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={busy}>
            {busy && <span className="spinner" />}
            Save order
          </button>
          <button type="button" className="link-btn" onClick={() => setList(upcoming)}>
            Undo changes
          </button>
        </div>
      )}
    </section>
  );
}

/** Per device: start each launch in low data mode (tiny blurred photo previews). */
function DataSaving() {
  const [on, setOn] = useState(lowDataOnLaunch);
  return (
    <section className={s.block}>
      <p className="eyebrow">Data saving</p>
      <label className={s.check}>
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => {
            setOn(e.target.checked);
            setLowDataOnLaunch(e.target.checked);
          }}
        />
        <span>Start in low data mode</span>
      </label>
      <p className="meta">
        Idea and postcard photos show as small, blurred previews until you tap the cloud in the side bar. The cover and mood pictures always
        load. Only this phone is affected — it can&apos;t tell
        Wi-Fi from mobile data, so it&apos;s up to you.
      </p>
    </section>
  );
}
