"use client";

import { useState } from "react";
import { HOME_BASE, PEOPLE, TRAVELLER } from "@/config/app";
import { shareLocation } from "@/lib/actions";
import { relativeTime, zonedToInstant } from "@/lib/dates";
import { haversineKm } from "@/lib/geo";
import { authedFetch, useMe } from "@/lib/session";
import { useNow, useSpace } from "@/lib/space";
import { PlaceSearch, type PlacePick } from "../ui/PlaceSearch";
import { useUI } from "../ui/ui-state";
import { useReveal } from "../ui/useReveal";
import { Clocks } from "./Clocks";
import { JourneyMap } from "./JourneyMap";
import s from "./home.module.css";

type Candidate = {
  name: string;
  city?: string;
  country?: string;
  countryCode?: string;
  lat?: number;
  lon?: number;
  source: "gps" | "manual";
};

type Step =
  | { t: "idle" }
  | { t: "locating" }
  | { t: "resolving" }
  | { t: "confirm"; c: Candidate }
  | { t: "manual"; reason?: string }
  | { t: "saving"; c: Candidate }
  | { t: "error"; message: string; c: Candidate };

export function Journey() {
  const { config, location, sync } = useSpace();
  const { me, partner } = useMe();
  const now = useNow(60_000);
  const { toast } = useUI();
  const ref = useReveal<HTMLDivElement>();
  const [step, setStep] = useState<Step>({ t: "idle" });
  const [manualPick, setManualPick] = useState<PlacePick | null>(null);
  const traveller = PEOPLE[TRAVELLER].name;

  async function locate() {
    if (!("geolocation" in navigator)) {
      setStep({ t: "manual", reason: "This browser can't share a location. Type the place instead." });
      return;
    }
    setStep({ t: "locating" });
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        setStep({ t: "resolving" });
        try {
          const res = await authedFetch(`/api/places/reverse?lat=${lat}&lon=${lon}`);
          if (!res.ok) throw new Error();
          const { place } = (await res.json()) as {
            place: { name: string; city?: string; country?: string; countryCode?: string } | null;
          };
          const name = place?.city ?? place?.name ?? "";
          if (!name) throw new Error();
          setStep({
            t: "confirm",
            c: { name, city: place?.city ?? name, country: place?.country, countryCode: place?.countryCode, lat, lon, source: "gps" },
          });
        } catch {
          setStep({ t: "manual", reason: "Got your position but couldn't name the place. Pick it below." });
        }
      },
      (err) => {
        setStep({
          t: "manual",
          reason:
            err.code === err.PERMISSION_DENIED
              ? "Location access is off for this app. Allow it in iOS Settings → Privacy & Security → Location Services, or just type the place."
              : err.code === err.TIMEOUT
                ? "Finding your position took too long. Type the place instead, or try again."
                : "Couldn't get a position right now. Type the place instead.",
        });
      },
      { enableHighAccuracy: false, timeout: 15_000, maximumAge: 120_000 },
    );
  }

  async function save(c: Candidate) {
    setStep({ t: "saving", c });
    try {
      await shareLocation(me.key, c);
      setStep({ t: "idle" });
      setManualPick(null);
      toast(`Shared: ${c.city ?? c.name}`, "ok");
    } catch {
      setStep({ t: "error", message: "Couldn't save. Nothing was shared — try again.", c });
    }
  }

  const where = location.city || location.name;

  // Until the reunion the one at home is in HOME_BASE; from then on you're together (0 km).
  const reunited = now.getTime() >= zonedToInstant(config.reunionDate, config.reunionTime, config.timezone).getTime();
  const km = reunited
    ? 0
    : typeof location.lat === "number" && typeof location.lon === "number"
      ? Math.round(haversineKm(HOME_BASE, { lat: location.lat, lon: location.lon }))
      : null;

  return (
    <section id="journey" className={s.journey} aria-labelledby="journey-h">
      <div ref={ref} className="reveal">
        <p className="eyebrow" id="journey-h">
          {traveller}&apos;s route
        </p>
        <JourneyMap route={config.route} location={location} />

        <div className={s.locBlock}>
          <p className="eyebrow">Currently in</p>
          {where ? (
            <>
              <p className={s.locName}>{where}</p>
              <p className={s.locMeta}>
                {location.source === "default"
                  ? `${location.country} · until ${traveller} shares an update`
                  : [location.country, location.updatedAt ? `shared ${relativeTime(location.updatedAt, now)}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                {location.source === "manual" ? " · typed in" : ""}
              </p>
              {km !== null && (
                <p className={s.locDistance}>
                  Distance between you and {partner.name}:{" "}
                  <strong>{new Intl.NumberFormat("en-GB").format(km)} km</strong>
                </p>
              )}
            </>
          ) : (
            <p className={s.locMeta}>No location shared yet.</p>
          )}

          {me.traveller ? (
            <div className={s.locActions}>
              {(step.t === "idle" || step.t === "locating" || step.t === "resolving") && (
                <>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={locate}
                    disabled={step.t !== "idle" || sync === "offline"}
                  >
                    {step.t !== "idle" && <span className="spinner" />}
                    {step.t === "locating" ? "Finding you…" : step.t === "resolving" ? "Naming the place…" : "Update location"}
                  </button>
                  {step.t === "idle" && (
                    <button type="button" className="link-btn" onClick={() => setStep({ t: "manual" })}>
                      Type it instead
                    </button>
                  )}
                </>
              )}

              {(step.t === "confirm" || step.t === "saving" || step.t === "error") && (
                <div className={s.locConfirm}>
                  <p>
                    Share <strong>{step.c.city ?? step.c.name}</strong>
                    {step.c.country ? `, ${step.c.country}` : ""} with {PEOPLE.toby.name}?
                  </p>
                  {step.t === "error" && (
                    <p className="notice error" role="alert">
                      {step.message}
                    </p>
                  )}
                  <div className={s.row}>
                    <button type="button" className="btn btn-primary" onClick={() => void save(step.c)} disabled={step.t === "saving"}>
                      {step.t === "saving" && <span className="spinner" />}
                      {step.t === "saving" ? (sync === "online" ? "Sharing…" : "Waiting for connection…") : "Share"}
                    </button>
                    <button type="button" className="btn" onClick={() => setStep({ t: "manual" })} disabled={step.t === "saving"}>
                      Not quite
                    </button>
                  </div>
                </div>
              )}

              {step.t === "manual" && (
                <div className={s.locConfirm}>
                  {step.reason && <p className="notice warn">{step.reason}</p>}
                  <label className="eyebrow" htmlFor="manual-loc">
                    Where are you?
                  </label>
                  <PlaceSearch id="manual-loc" value={manualPick} onChange={setManualPick} includeSaved={false} placeholder="City or town" />
                  <div className={s.row}>
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={!manualPick}
                      onClick={() =>
                        manualPick &&
                        void save({
                          name: manualPick.name,
                          city: manualPick.city ?? manualPick.name,
                          country: manualPick.country,
                          countryCode: manualPick.countryCode,
                          lat: manualPick.lat,
                          lon: manualPick.lon,
                          source: "manual",
                        })
                      }
                    >
                      Share this place
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => {
                        setStep({ t: "idle" });
                        setManualPick(null);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className={s.locNote}>Only shared when {traveller} taps “Update location” — never tracked in the background.</p>
          )}
        </div>

        <Clocks />
      </div>
    </section>
  );
}
