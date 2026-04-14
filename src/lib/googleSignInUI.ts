import { create } from "zustand";

type GoogleSignInUIState = {
  open: boolean;
  hint: string;
  resolve: ((email: string | null) => void) | null;
};

export const useGoogleSignInUI = create<GoogleSignInUIState>(() => ({
  open: false,
  hint: "",
  resolve: null,
}));

/** Ouvre la modale (centrée) et résout avec l’email saisi ou `null` si annulation. */
export function openGoogleEmailDialog(hint: string): Promise<string | null> {
  return new Promise((resolve) => {
    useGoogleSignInUI.setState({
      open: true,
      hint: hint.trim(),
      resolve,
    });
  });
}

export function resolveGoogleEmailDialog(email: string | null) {
  const { resolve } = useGoogleSignInUI.getState();
  useGoogleSignInUI.setState({ open: false, hint: "", resolve: null });
  resolve?.(email);
}
