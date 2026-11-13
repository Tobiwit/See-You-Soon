"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useLowData } from "@/lib/data-mode";
import { imageSrcSync, loadImage, subscribeTinies, tinySrc, tinyVersionSnapshot } from "@/lib/images";
import type { ImageRef } from "@/lib/types";
import s from "./ui.module.css";

/**
 * Lazy photo: only fetches the (private) image document once it is near the
 * viewport. Renders nothing visual itself while loading — the parent provides
 * the background so there's no layout jump. With `saver` (idea and postcard
 * photos), low data mode shows a tiny, blurred preview instead and downloads
 * nothing (unless the photo is already in memory from earlier in this session).
 */
export function Photo(props: PhotoProps) {
  const k = props.image.kind === "upload" ? props.image.id : props.image.url;
  return <PhotoInner key={`${k}:${props.variant ?? "thumb"}`} {...props} />;
}

interface PhotoProps {
  image: ImageRef;
  variant?: "thumb" | "full";
  alt: string;
  className?: string;
  eager?: boolean;
  /** Idea and postcard photos: held back in low data mode (tiny preview instead). */
  saver?: boolean;
  onError?: () => void;
}

function PhotoInner({
  image,
  variant = "thumb",
  alt,
  className,
  eager = false,
  saver = false,
  onError,
}: PhotoProps) {
  const [src, setSrc] = useState<string | null>(() => imageSrcSync(image, variant));
  const [failed, setFailed] = useState(false);
  const holder = useRef<HTMLSpanElement>(null);
  const low = useLowData() && saver;
  useSyncExternalStore(subscribeTinies, tinyVersionSnapshot, tinyVersionSnapshot);
  const tiny = low && !src ? tinySrc(image) : null;
  useEffect(() => {
    if (low) return; // wait for the cloud button
    let alive = true;
    const load = () =>
      loadImage(image, variant)
        .then((u) => alive && setSrc(u))
        .catch(() => {
          if (!alive) return;
          setFailed(true);
          onError?.();
        });
    if (eager || !holder.current || typeof IntersectionObserver === "undefined") {
      void load();
      return () => {
        alive = false;
      };
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          void load();
        }
      },
      { rootMargin: "400px 0px" },
    );
    io.observe(holder.current);
    return () => {
      alive = false;
      io.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [low]);

  if (failed) {
    return (
      <span ref={holder} className={`${s.photoFailed} ${className ?? ""}`} role="img" aria-label={`${alt} (photo unavailable)`}>
        Photo unavailable
      </span>
    );
  }
  if (!src && low) {
    return tiny ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={tiny} alt={alt} className={`${s.photo} ${s.photoTiny} ${className ?? ""}`} draggable={false} referrerPolicy="no-referrer" />
    ) : (
      <span className={`${s.photoLow} ${className ?? ""}`} role="img" aria-label={alt || undefined} aria-hidden={!alt || undefined} />
    );
  }
  if (!src) return <span ref={holder} className={`${s.photoPending} ${className ?? ""}`} aria-hidden />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={`${s.photo} ${className ?? ""}`}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      draggable={false}
      referrerPolicy="no-referrer"
    />
  );
}

export function Credit({ image }: { image: ImageRef | null }) {
  if (!image || image.kind !== "unsplash") return null;
  return (
    <span className={s.credit}>
      Photo:{" "}
      <a href={image.credit.link} target="_blank" rel="noreferrer">
        {image.credit.name}
      </a>{" "}
      /{" "}
      <a href="https://unsplash.com/?utm_source=see_you_soon&utm_medium=referral" target="_blank" rel="noreferrer">
        Unsplash
      </a>
    </span>
  );
}
