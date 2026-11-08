"use client";

import { useRef, useState } from "react";
import { prepareImage, type PreparedImage } from "@/lib/images";
import s from "./picker.module.css";

/**
 * Pick + optimise a photo on the device. The preview shows the compressed
 * result, so what you see is exactly what gets saved.
 */
export function ImagePicker({
  value,
  onChange,
  label = "Add a photo",
  existing,
  aspect = "4 / 3",
}: {
  value: PreparedImage | null;
  onChange: (img: PreparedImage | null) => void;
  label?: string;
  /** Rendered when there is no new image (e.g. the current photo while editing). */
  existing?: React.ReactNode;
  aspect?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<{ t: "idle" } | { t: "working" } | { t: "error"; msg: string }>({ t: "idle" });

  async function onFile(f: File | undefined) {
    if (!f) return;
    setState({ t: "working" });
    try {
      const img = await prepareImage(f);
      onChange(img);
      setState({ t: "idle" });
    } catch (e) {
      setState({ t: "error", msg: (e as Error).message || "That photo couldn't be used." });
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div className={s.picker}>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      {value ? (
        <div className={s.preview} style={{ aspectRatio: aspect }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value.thumb} alt="Selected photo preview" />
        </div>
      ) : existing ? (
        <div className={s.preview} style={{ aspectRatio: aspect }}>
          {existing}
        </div>
      ) : (
        <button type="button" className={s.drop} style={{ aspectRatio: aspect }} onClick={() => input.current?.click()} disabled={state.t === "working"}>
          {state.t === "working" ? (
            <>
              <span className="spinner" /> Optimising photo…
            </>
          ) : (
            <>
              <span className={s.plus} aria-hidden>
                +
              </span>
              {label}
            </>
          )}
        </button>
      )}
      {(value || existing) && (
        <div className={s.actions}>
          <button type="button" className="btn" onClick={() => input.current?.click()} disabled={state.t === "working"}>
            {state.t === "working" ? (
              <>
                <span className="spinner" /> Optimising…
              </>
            ) : (
              "Replace photo"
            )}
          </button>
          {value && (
            <button type="button" className="link-btn" onClick={() => onChange(null)}>
              Remove
            </button>
          )}
        </div>
      )}
      {state.t === "error" && (
        <p className="notice error" role="alert">
          {state.msg}
        </p>
      )}
    </div>
  );
}
