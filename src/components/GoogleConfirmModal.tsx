import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ShieldCheck } from "lucide-react";
import {
  rememberGoogleConfirmForSession,
  resolveGoogleConfirmDialog,
  useGoogleConfirmUI,
} from "../lib/googleConfirmUI";

/**
 * Confirmation premium avant ouverture de Google OAuth.
 */
export default function GoogleConfirmModal() {
  const { open, title, description, confirmLabel, cancelLabel } = useGoogleConfirmUI();
  const [rememberChoice, setRememberChoice] = useState(false);

  useEffect(() => {
    if (open) setRememberChoice(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") resolveGoogleConfirmDialog(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const handleConfirm = () => {
    rememberGoogleConfirmForSession(rememberChoice);
    resolveGoogleConfirmDialog(true);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[10060] flex items-center justify-center bg-black/75 px-4 py-8 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="google-confirm-title"
      aria-describedby="google-confirm-description"
    >
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1E1E2E] p-6 shadow-2xl">
        <div className="mb-4 flex items-start gap-3">
          <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/5">
            <ShieldCheck className="h-5 w-5 text-luxe-champagne-bright" aria-hidden />
          </div>
          <div>
            <h2 id="google-confirm-title" className="text-lg font-semibold text-white">
              {title}
            </h2>
            <p id="google-confirm-description" className="mt-1 text-sm text-[#9CA3AF]">
              {description}
            </p>
          </div>
        </div>

        <label className="mb-4 flex cursor-pointer items-start gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-left">
          <input
            type="checkbox"
            checked={rememberChoice}
            onChange={(e) => setRememberChoice(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-[#2d2d3d] bg-[#0A0A0F] text-luxe-champagne focus:ring-luxe-champagne/40"
          />
          <span className="text-xs text-[#C7CEDC]">
            Ne plus demander pendant cette session
          </span>
        </label>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="rounded-xl border border-[#2d2d3d] px-4 py-2.5 text-sm font-medium text-[#D1D5DB] transition-colors hover:bg-white/5"
            onClick={() => resolveGoogleConfirmDialog(false)}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="rounded-xl bg-luxe-champagne px-4 py-2.5 text-sm font-semibold text-[#0A0A0F] transition-colors hover:brightness-105"
            onClick={handleConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
