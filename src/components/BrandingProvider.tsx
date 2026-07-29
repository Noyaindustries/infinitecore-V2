import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiUrl } from "../lib/apiBase";

const DEFAULT_LOGO = "/infinite-core-logo.png";
const DEFAULT_FAVICON = "/infinite-core-logo.png";

export type BrandingState = {
  logoUrl: string;
  faviconUrl: string;
  siteName: string;
  ready: boolean;
  refresh: () => Promise<void>;
};

const BrandingContext = createContext<BrandingState>({
  logoUrl: DEFAULT_LOGO,
  faviconUrl: DEFAULT_FAVICON,
  siteName: "",
  ready: false,
  refresh: async () => undefined,
});

function applyFavicon(url: string) {
  if (typeof document === "undefined") return;
  const href = url.trim() || DEFAULT_FAVICON;
  const ensureLink = (rel: string, sizes?: string) => {
    const selector = sizes
      ? `link[rel="${rel}"][sizes="${sizes}"]`
      : `link[rel="${rel}"]:not([sizes])`;
    let link = document.head.querySelector<HTMLLinkElement>(selector);
    if (!link) {
      link = document.createElement("link");
      link.rel = rel;
      if (sizes) link.sizes = sizes;
      document.head.appendChild(link);
    }
    link.type = "image/png";
    link.href = href;
  };
  ensureLink("icon", "32x32");
  ensureLink("icon", "192x192");
  ensureLink("apple-touch-icon", "180x180");
  // Catch-all icon without sizes (browsers often prefer this)
  const generic = document.head.querySelectorAll<HTMLLinkElement>('link[rel="icon"]');
  if (generic.length === 0) {
    ensureLink("icon");
  } else {
    generic.forEach((link) => {
      if (!link.sizes?.value) link.href = href;
    });
  }
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [logoUrl, setLogoUrl] = useState(DEFAULT_LOGO);
  const [faviconUrl, setFaviconUrl] = useState(DEFAULT_FAVICON);
  const [siteName, setSiteName] = useState("");
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(apiUrl("/api/branding"), { credentials: "include" });
      if (!res.ok) throw new Error(`branding ${res.status}`);
      const data = (await res.json()) as {
        logoUrl?: string;
        faviconUrl?: string;
        siteName?: string;
      };
      const nextLogo = (data.logoUrl || "").trim() || DEFAULT_LOGO;
      const nextFavicon = (data.faviconUrl || "").trim() || DEFAULT_FAVICON;
      setLogoUrl(nextLogo);
      setFaviconUrl(nextFavicon);
      setSiteName((data.siteName || "").trim());
      applyFavicon(nextFavicon);
    } catch (error) {
      console.warn("[BrandingProvider] fetch failed, using defaults", error);
      setLogoUrl(DEFAULT_LOGO);
      setFaviconUrl(DEFAULT_FAVICON);
      applyFavicon(DEFAULT_FAVICON);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo(
    () => ({ logoUrl, faviconUrl, siteName, ready, refresh }),
    [logoUrl, faviconUrl, siteName, ready, refresh]
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding(): BrandingState {
  return useContext(BrandingContext);
}

export { DEFAULT_LOGO, DEFAULT_FAVICON };
