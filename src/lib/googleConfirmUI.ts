import { create } from "zustand";

const GOOGLE_CONFIRM_SESSION_KEY = "ic_google_confirm_skip_session";

type GoogleConfirmDialogPayload = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

type GoogleConfirmUIState = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  resolve: ((confirmed: boolean) => void) | null;
};

export const useGoogleConfirmUI = create<GoogleConfirmUIState>(() => ({
  open: false,
  title: "",
  description: "",
  confirmLabel: "Continuer",
  cancelLabel: "Annuler",
  resolve: null,
}));

export function openGoogleConfirmDialog(payload: GoogleConfirmDialogPayload): Promise<boolean> {
  if (typeof window !== "undefined" && window.sessionStorage.getItem(GOOGLE_CONFIRM_SESSION_KEY) === "1") {
    return Promise.resolve(true);
  }

  return new Promise((resolve) => {
    useGoogleConfirmUI.setState({
      open: true,
      title: payload.title.trim(),
      description: payload.description.trim(),
      confirmLabel: payload.confirmLabel?.trim() || "Continuer",
      cancelLabel: payload.cancelLabel?.trim() || "Annuler",
      resolve,
    });
  });
}

export function rememberGoogleConfirmForSession(remember: boolean) {
  if (typeof window === "undefined") return;
  if (remember) {
    window.sessionStorage.setItem(GOOGLE_CONFIRM_SESSION_KEY, "1");
  } else {
    window.sessionStorage.removeItem(GOOGLE_CONFIRM_SESSION_KEY);
  }
}

export function resolveGoogleConfirmDialog(confirmed: boolean) {
  const { resolve } = useGoogleConfirmUI.getState();
  useGoogleConfirmUI.setState({
    open: false,
    title: "",
    description: "",
    confirmLabel: "Continuer",
    cancelLabel: "Annuler",
    resolve: null,
  });
  resolve?.(confirmed);
}
