"use client";

import { useCallback, useEffect, useRef } from "react";
import { useMe } from "@/lib/session";
import { useSpace } from "@/lib/space";
import { markEventSeen } from "@/lib/actions";
import { useUI } from "./ui/ui-state";
import { Rail } from "./Rail";
import { SheetHost } from "./SheetHost";
import { Home } from "./home/Home";
import { Wishlist } from "./wishlist/Wishlist";
import { Planner } from "./planner/Planner";
import { Memories } from "./memories/Memories";
import ui from "./ui/ui.module.css";
import s from "./shell.module.css";

export function Shell() {
  const { toasts, open, goTo, closeAll } = useUI();
  const { key: me } = useMe();
  const space = useSpace();
  const pendingLink = useRef<string | null>(null);

  // Always open on the cover.
  useEffect(() => {
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    const params = new URLSearchParams(location.search);
    const link = params.get("open");
    if (link) {
      pendingLink.current = link;
      history.replaceState(null, "", location.pathname);
    }
  }, []);

  const openLink = useCallback(
    (link: string) => {
      const [type, id] = link.split(":");
      closeAll();
      if (type === "postcard_created" && id) open({ kind: "postcard", id });
      else if ((type === "wishlist_item_added" || type === "planner_item_assigned") && id) open({ kind: "item", id });
      else if (type === "moment_added") goTo("memories");
      else if (type === "location_updated") goTo("journey");
      else if (type === "thinking_of_you" || type === "mood_updated") goTo("between-us");
      // The notification's own event id: mark it seen.
      const ev = space.events.find((e) => e.id === id || e.refId === id);
      if (ev && !ev.seen[me]) void markEventSeen(me, ev.id).catch(() => {});
    },
    [closeAll, open, goTo, space.events, me],
  );

  useEffect(() => {
    if (pendingLink.current && space.loaded && space.sync === "online") {
      const l = pendingLink.current;
      pendingLink.current = null;
      setTimeout(() => openLink(l), 300);
    }
  }, [space.loaded, space.sync, openLink]);

  // Service worker: offline shell + push. Messages arrive when a notification is tapped while open.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    } else {
      // Dev chunks aren't content-hashed; a caching worker would serve stale code.
      void navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => void r.unregister()));
    }
    const onMsg = (e: MessageEvent) => {
      const url = typeof e.data?.open === "string" ? e.data.open : null;
      if (!url) return;
      const link = new URL(url, location.href).searchParams.get("open");
      if (link) openLink(link);
    };
    navigator.serviceWorker.addEventListener("message", onMsg);
    return () => navigator.serviceWorker.removeEventListener("message", onMsg);
  }, [openLink]);

  return (
    <div className={s.frame}>
      <SyncBar />
      <Rail />
      <main className={s.main}>
        <Home />
        <Wishlist />
        <Planner />
        <Memories />
        <footer className={s.colophon}>
          <p className="display">A+T</p>
          <p className="meta">See You Soon · Vol. 01 · Made for two.</p>
        </footer>
      </main>
      <aside className={s.desktopNote} aria-hidden>
        Made for phones — open it on your iPhone and add it to the Home Screen.
      </aside>
      <SheetHost />
      <div className={ui.toasts} role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={ui.toast} data-tone={t.tone}>
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function SyncBar() {
  const { sync, loaded } = useSpace();
  if (!loaded || sync === "online" || sync === "connecting") return null;
  const text =
    sync === "offline"
      ? "Offline — you're seeing the last synced copy. New things will send when you're back."
      : sync === "denied"
        ? "Access denied by the server. Check the Firestore rules / account emails."
        : "Can't reach the server right now.";
  return (
    <div className={ui.syncBar} data-tone={sync} role="status">
      {text}
    </div>
  );
}
