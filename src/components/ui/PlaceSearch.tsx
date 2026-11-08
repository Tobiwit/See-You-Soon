"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Fuse from "fuse.js";
import type { PlaceInput } from "@/lib/actions";
import { authedFetch } from "@/lib/session";
import { useSpace } from "@/lib/space";
import s from "./place.module.css";

interface Remote {
  providerId: string;
  name: string;
  label: string;
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
  lat: number;
  lon: number;
}

export type PlacePick = PlaceInput & { countryCode?: string; label?: string };

/**
 * Fuzzy place picker: your own saved places first (typo-tolerant), then
 * OpenStreetMap results, and always the option to create exactly what you typed.
 */
export function PlaceSearch({
  id,
  value,
  onChange,
  includeSaved = true,
  placeholder = "Search a place or type a new one",
  invalid,
  autoFocus,
}: {
  id?: string;
  value: PlacePick | null;
  onChange: (p: PlacePick | null) => void;
  includeSaved?: boolean;
  placeholder?: string;
  invalid?: boolean;
  autoFocus?: boolean;
}) {
  const { places } = useSpace();
  const [q, setQ] = useState("");
  const [remote, setRemote] = useState<Remote[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [activeIdx, setActiveIdx] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const fuse = useMemo(
    () => new Fuse(places, { keys: ["name", "city", "country"], threshold: 0.38, ignoreLocation: true }),
    [places],
  );

  const saved = useMemo(() => {
    if (!includeSaved) return [];
    const t = q.trim();
    if (!t) return places.slice(0, 6);
    return fuse.search(t, { limit: 6 }).map((r) => r.item);
  }, [q, fuse, places, includeSaved]);

  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) return;
    const ctl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await authedFetch(`/api/places/search?q=${encodeURIComponent(t)}`, { signal: ctl.signal });
        if (!res.ok) throw new Error();
        const json = (await res.json()) as { results: Remote[] };
        setRemote(json.results);
        setStatus("idle");
      } catch (e) {
        if ((e as Error).name !== "AbortError") setStatus("error");
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      ctl.abort();
    };
  }, [q]);

  const options = useMemo(() => {
    const out: Array<{ key: string; title: string; sub: string; tag: string; pick: PlacePick }> = [];
    for (const p of saved) {
      out.push({
        key: `s-${p.id}`,
        title: p.name,
        sub: [p.city !== p.name ? p.city : null, p.country].filter(Boolean).join(", "),
        tag: "Saved",
        pick: { existingId: p.id, name: p.name, city: p.city, country: p.country, lat: p.lat, lon: p.lon },
      });
    }
    const savedProviders = new Set(places.map((p) => p.providerId).filter(Boolean));
    for (const r of q.trim().length < 2 ? [] : remote) {
      if (savedProviders.has(r.providerId)) continue;
      out.push({
        key: `r-${r.providerId}-${r.label}`,
        title: r.name,
        sub: r.label.split(", ").slice(1).join(", "),
        tag: "Map",
        pick: {
          name: r.name,
          city: r.city,
          region: r.region,
          country: r.country,
          countryCode: r.countryCode,
          lat: r.lat,
          lon: r.lon,
          providerId: r.providerId,
          label: r.label,
        },
      });
    }
    const typed = q.trim();
    if (typed && !out.some((o) => o.title.toLowerCase() === typed.toLowerCase())) {
      out.push({ key: "new", title: `Create “${typed}”`, sub: "As a new place", tag: "New", pick: { name: typed } });
    }
    return out;
  }, [saved, remote, q, places]);

  const active = Math.max(0, Math.min(activeIdx, options.length - 1));

  if (value) {
    return (
      <div className={s.chosen}>
        <div>
          <strong>{value.name}</strong>
          <span>{[value.city !== value.name ? value.city : null, value.country].filter(Boolean).join(", ") || (value.existingId ? "Saved place" : "New place")}</span>
        </div>
        <button
          type="button"
          className="link-btn"
          onClick={() => {
            onChange(null);
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
        >
          Change
        </button>
      </div>
    );
  }

  const choose = (i: number) => {
    const o = options[i];
    if (!o) return;
    onChange(o.pick);
    setQ("");
    setStatus("idle");
  };

  return (
    <div className={s.box}>
      <input
        ref={inputRef}
        id={id}
        className="input"
        role="combobox"
        aria-expanded={options.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={options[active] ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setActiveIdx(0);
          setStatus(e.target.value.trim().length >= 2 ? "loading" : "idle");
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIdx(Math.min(options.length - 1, active + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIdx(Math.max(0, active - 1));
          } else if (e.key === "Enter" && options.length) {
            e.preventDefault();
            choose(active);
          }
        }}
      />
      {options.length > 0 && (
        <ul id={listId} role="listbox" className={s.list}>
          {options.map((o, i) => (
            <li
              key={o.key}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              className={s.option}
              data-new={o.tag === "New" || undefined}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(i)}
            >
              <span className={s.optMain}>
                <strong>{o.title}</strong>
                {o.sub && <span>{o.sub}</span>}
              </span>
              <span className={s.tag}>{o.tag}</span>
            </li>
          ))}
        </ul>
      )}
      <p className={s.status} aria-live="polite">
        {status === "loading" ? "Searching the map…" : status === "error" ? "Map search unavailable — you can still create a new place." : ""}
      </p>
    </div>
  );
}
