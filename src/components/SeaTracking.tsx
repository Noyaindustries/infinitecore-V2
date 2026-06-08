import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { siteUrl } from '@/lib/seo';

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'] as const;

declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
    gtag?: (...args: unknown[]) => void;
  }
}

function readPublicEnv(key: string): string {
  return String(process.env[key] ?? '').trim();
}

function injectScript(id: string, src: string) {
  if (document.getElementById(id)) return;
  const s = document.createElement('script');
  s.id = id;
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

function captureUtm(search: string) {
  const params = new URLSearchParams(search);
  const utm: Record<string, string> = {};
  for (const key of UTM_KEYS) {
    const v = params.get(key);
    if (v) utm[key] = v;
  }
  if (Object.keys(utm).length) {
    sessionStorage.setItem('ic_utm', JSON.stringify(utm));
  }
}

/** Événement conversion SEA (Google Ads / Analytics via gtag ou GTM dataLayer). */
export function trackSeaEvent(
  eventName: string,
  params?: Record<string, string | number | boolean | undefined>
) {
  const payload: Record<string, unknown> = {
    event: eventName,
    page_path: window.location.pathname,
    page_location: window.location.href,
    ...params,
  };
  try {
    const utmRaw = sessionStorage.getItem('ic_utm');
    if (utmRaw) Object.assign(payload, JSON.parse(utmRaw));
  } catch {
    /* ignore */
  }

  window.dataLayer?.push(payload);
  window.gtag?.('event', eventName, payload);
}

export default function SeaTracking() {
  const location = useLocation();
  const gtmId = readPublicEnv('NEXT_PUBLIC_GTM_ID');
  const adsId = readPublicEnv('NEXT_PUBLIC_GOOGLE_ADS_ID');

  useEffect(() => {
    captureUtm(location.search);
  }, [location.search]);

  useEffect(() => {
    if (gtmId) {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
      injectScript('ic-gtm', `https://www.googletagmanager.com/gtm.js?id=${gtmId}`);
    }
    if (adsId) {
      injectScript('ic-gtag', `https://www.googletagmanager.com/gtag/js?id=${adsId}`);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function gtag(...args: unknown[]) {
        window.dataLayer?.push(args as unknown as Record<string, unknown>);
      };
      window.gtag('js', new Date());
      window.gtag('config', adsId, { send_page_view: false });
    }
  }, [gtmId, adsId]);

  useEffect(() => {
    const page = {
      page_path: location.pathname + location.search,
      page_title: document.title,
      page_location: `${siteUrl()}${location.pathname}${location.search}`,
    };
    window.dataLayer?.push({ event: 'page_view', ...page });
    window.gtag?.('event', 'page_view', page);
  }, [location.pathname, location.search]);

  return null;
}
