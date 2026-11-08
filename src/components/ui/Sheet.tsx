"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import s from "./ui.module.css";

/**
 * Mobile bottom sheet. `full` makes it a full-height sheet (detail views).
 * Escape / backdrop / close button all call onClose. Focus moves into the sheet
 * and returns to the previously focused element afterwards.
 */
export function Sheet({
  title,
  onClose,
  children,
  full = false,
  hideTitle = false,
  footer,
  tone = "paper",
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  full?: boolean;
  hideTitle?: boolean;
  footer?: ReactNode;
  tone?: "paper" | "ink";
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  // Callers often pass an inline onClose; keep the latest one in a ref so the
  // mount effect below runs once (re-running it stole focus on every keystroke).
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    document.body.classList.add("sheet-open");
    panel.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab" && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("sheet-open");
      prev?.focus?.({ preventScroll: true });
    };
  }, []);

  return (
    <div className={s.overlay} onClick={() => closeRef.current()}>
      <div
        ref={panel}
        className={`${s.panel} ${full ? s.full : ""} ${tone === "ink" ? s.inkPanel : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={s.sheetHead}>
          <h2 id={titleId} className={hideTitle ? "sr-only" : s.sheetTitle}>
            {title}
          </h2>
          <button type="button" className={`icon-btn ${s.close}`} onClick={() => closeRef.current()} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
              <path d="M2 2l12 12M14 2L2 14" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        </header>
        <div className={s.sheetBody}>{children}</div>
        {footer && <footer className={s.sheetFoot}>{footer}</footer>}
      </div>
    </div>
  );
}

export function Confirm({
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
  busy,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  return (
    <div className={s.confirm} role="alertdialog" aria-label={title}>
      <p className={s.confirmTitle}>{title}</p>
      <p className={s.confirmBody}>{body}</p>
      <div className={s.confirmRow}>
        <button type="button" className="btn" onClick={onCancel} disabled={busy}>
          Keep it
        </button>
        <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>
          {busy && <span className="spinner" />}
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
