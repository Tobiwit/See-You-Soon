"use client";

import { useSyncExternalStore } from "react";
import { SessionProvider, useSession } from "@/lib/session";
import { SpaceProvider } from "@/lib/space";
import { UIProvider } from "./ui/ui-state";
import { Shell } from "./Shell";
import { Gate } from "./Gate";

export function App() {
  // Everything here depends on the browser (auth, IndexedDB, time) — render after mount.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  if (!mounted) return <div style={{ minHeight: "100svh", background: "var(--paper)" }} />;
  return (
    <SessionProvider>
      <Root />
    </SessionProvider>
  );
}

function Root() {
  const { state } = useSession();
  if (state.status !== "ready") return <Gate />;
  return (
    <SpaceProvider me={state.identity.key}>
      <UIProvider>
        <Shell />
      </UIProvider>
    </SpaceProvider>
  );
}
