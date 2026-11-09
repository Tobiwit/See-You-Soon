"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

export type SheetSpec =
  | { kind: "item"; id: string }
  | { kind: "item-form"; id?: string }
  | { kind: "assign"; id: string }
  | { kind: "visit"; id: string }
  | { kind: "postcard"; id: string }
  | { kind: "compose" }
  | { kind: "moment-form" }
  | { kind: "moment"; id: string }
  | { kind: "travel"; id?: string; date?: string }
  | { kind: "fixed"; id: string }
  | { kind: "daily"; day?: string }
  | { kind: "daily-archive" }
  | { kind: "settings" };

export type SectionId = "home" | "wishlist" | "planner" | "memories";

interface Toast {
  id: number;
  text: string;
  tone: "info" | "ok" | "error";
}

interface UIValue {
  sheets: SheetSpec[];
  open: (s: SheetSpec) => void;
  replace: (s: SheetSpec) => void;
  close: () => void;
  closeAll: () => void;
  toast: (text: string, tone?: Toast["tone"]) => void;
  toasts: Toast[];
  goTo: (target: SectionId | string, opts?: { focusToday?: boolean }) => void;
}

const Ctx = createContext<UIValue | null>(null);

export const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function UIProvider({ children }: { children: ReactNode }) {
  const [sheets, setSheets] = useState<SheetSpec[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const open = useCallback((s: SheetSpec) => setSheets((st) => [...st, s]), []);
  const replace = useCallback((s: SheetSpec) => setSheets((st) => [...st.slice(0, -1), s]), []);
  const close = useCallback(() => setSheets((st) => st.slice(0, -1)), []);
  const closeAll = useCallback(() => setSheets([]), []);

  const toast = useCallback((text: string, tone: Toast["tone"] = "info") => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 6000 : 3200);
  }, []);

  const goTo = useCallback((target: string, opts?: { focusToday?: boolean }) => {
    let el: HTMLElement | null = null;
    if (opts?.focusToday) el = document.querySelector<HTMLElement>("[data-today='true']");
    if (!el) el = document.getElementById(target);
    if (!el) return;
    const offset = opts?.focusToday ? 72 : 0;
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: reducedMotion() ? "auto" : "smooth" });
  }, []);

  const value = useMemo(
    () => ({ sheets, open, replace, close, closeAll, toast, toasts, goTo }),
    [sheets, open, replace, close, closeAll, toast, toasts, goTo],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useUI() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useUI outside provider");
  return v;
}
