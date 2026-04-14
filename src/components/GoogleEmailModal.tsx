import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Mail } from "lucide-react";
import { resolveGoogleEmailDialog, useGoogleSignInUI } from "../lib/googleSignInUI";

/**
 * Saisie d’email pour « Continuer avec Google » (remplace le prompt navigateur).
 * Rendu dans un portail pour rester centré sur l’écran.
 */
export default function GoogleEmailModal() {
  const { open, hint } = useGoogleSignInUI();
  const [value, setValue] = useState("");

  useEffect(() => {
    if (open) {
      setValue(hint || "");
    }
  }, [open, hint]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") resolveGoogleEmailDialog(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    resolveGoogleEmailDialog(trimmed);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/75 px-4 py-8 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="google-email-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1E1E2E] p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5">
            <Mail className="h-5 w-5 text-[#9CA3AF]" aria-hidden />
          </div>
          <div>
            <h2 id="google-email-title" className="text-lg font-semibold text-white">
              Connexion avec Google
            </h2>
            <p className="text-sm text-[#9CA3AF]">Indique l’adresse Gmail ou Google Workspace utilisée pour ton compte.</p>
          </div>
        </div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[#6B7280]">E-mail</label>
        <input
          type="email"
          autoComplete="email"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="vous@exemple.com"
          className="mb-6 w-full rounded-xl border border-[#2d2d3d] bg-[#0A0A0F] px-4 py-3 text-sm text-white placeholder:text-[#6B7280] outline-none ring-0 focus:border-[#6EA7EA]/50"
        />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="rounded-xl border border-[#2d2d3d] px-4 py-2.5 text-sm font-medium text-[#D1D5DB] transition-colors hover:bg-white/5"
            onClick={() => resolveGoogleEmailDialog(null)}
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={!value.trim()}
            className="rounded-xl bg-[#6EA7EA] px-4 py-2.5 text-sm font-semibold text-[#0A0A0F] transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            onClick={submit}
          >
            Continuer
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
