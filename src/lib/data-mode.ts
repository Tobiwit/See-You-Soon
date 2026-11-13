"use client";

import { useSyncExternalStore } from "react";

/**
 * Low data mode (per device). Phones can't tell Wi-Fi from mobile data in a web app, so this
 * is a manual switch: photos show as tiny blurred previews until the cloud button is tapped.
 * Whether a launch starts in low data mode is a per-device setting (on by default).
 */

const KEY = "sys.lowDataOnLaunch";

export function lowDataOnLaunch(): boolean {
  try {
    return localStorage.getItem(KEY) !== "0";
  } catch {
    return true;
  }
}

export function setLowDataOnLaunch(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    /* private mode: the default applies */
  }
}

let low: boolean | null = null;
const listeners = new Set<() => void>();

function get() {
  if (low === null) low = typeof window === "undefined" ? false : lowDataOnLaunch();
  return low;
}

export function setLowData(on: boolean) {
  low = on;
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useLowData() {
  return useSyncExternalStore(subscribe, get, () => false);
}
