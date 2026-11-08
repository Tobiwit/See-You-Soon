"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { fb, firebaseConfigured } from "./firebase";
import type { PersonKey } from "@/config/app";

export interface Identity {
  key: PersonKey;
  me: { key: PersonKey; name: string; traveller: boolean };
  partner: { key: PersonKey; name: string; traveller: boolean };
}

type State =
  | { status: "unconfigured" }
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "not-member"; email: string }
  | { status: "identity-error"; message: string }
  | { status: "ready"; user: User; identity: Identity };

interface SessionValue {
  state: State;
  signIn: (email: string, password: string) => Promise<void>;
  signOutNow: () => Promise<void>;
  retry: () => void;
}

const Ctx = createContext<SessionValue | null>(null);
const cacheKey = (uid: string) => `sys.identity.${uid}`;

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(() =>
    firebaseConfigured ? { status: "loading" } : { status: "unconfigured" },
  );
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!firebaseConfigured) return;
    const { auth } = fb();
    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setState({ status: "signed-out" });
        return;
      }
      // Use the cached identity immediately so the app opens offline.
      let cached: Identity | null = null;
      try {
        const raw = localStorage.getItem(cacheKey(user.uid));
        if (raw) cached = JSON.parse(raw) as Identity;
      } catch {}
      if (cached) setState({ status: "ready", user, identity: cached });
      else setState({ status: "loading" });

      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } });
        if (res.status === 403) {
          try {
            localStorage.removeItem(cacheKey(user.uid));
          } catch {}
          setState({ status: "not-member", email: user.email ?? "" });
          return;
        }
        if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? `HTTP ${res.status}`);
        const identity = (await res.json()) as Identity;
        try {
          localStorage.setItem(cacheKey(user.uid), JSON.stringify(identity));
        } catch {}
        setState({ status: "ready", user, identity });
      } catch (e) {
        if (!cached) {
          setState({
            status: "identity-error",
            message: navigator.onLine ? (e as Error).message : "You're offline. Connect once to finish signing in.",
          });
        }
      }
    });
  }, [nonce]);

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(fb().auth, email.trim(), password);
  }, []);

  const signOutNow = useCallback(async () => {
    await signOut(fb().auth);
  }, []);

  const retry = useCallback(() => setNonce((n) => n + 1), []);

  const value = useMemo(() => ({ state, signIn, signOutNow, retry }), [state, signIn, signOutNow, retry]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession outside provider");
  return v;
}

/** Only valid inside the signed-in app. */
export function useMe() {
  const { state } = useSession();
  if (state.status !== "ready") throw new Error("useMe before ready");
  return state.identity;
}

export async function authedFetch(path: string, init: RequestInit = {}) {
  const user = fb().auth.currentUser;
  if (!user) throw new Error("Not signed in");
  const token = await user.getIdToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(path, { ...init, headers });
}
