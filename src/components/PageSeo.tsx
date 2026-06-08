import { useEffect } from 'react';
import { absoluteUrl, type SeoPayload } from '@/lib/seo';

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  if (!content || typeof document === 'undefined') return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel: string, href: string) {
  if (!href || typeof document === 'undefined') return;
  let el = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

function upsertJsonLd(id: string, data: Record<string, unknown> | Record<string, unknown>[]) {
  if (typeof document === 'undefined') return;
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement('script');
    el.id = id;
    el.type = 'application/ld+json';
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

type Props = SeoPayload;

export default function PageSeo({
  title,
  description,
  path = '/',
  image = '/infinite-core-logo-v2.png',
  type = 'website',
  noindex = false,
  jsonLd,
}: Props) {
  useEffect(() => {
    document.title = title;
    upsertMeta('name', 'description', description);
    upsertMeta('name', 'robots', noindex ? 'noindex,nofollow' : 'index,follow');
    upsertLink('canonical', absoluteUrl(path));

    const img = absoluteUrl(image);
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:type', type === 'product' ? 'product' : 'website');
    upsertMeta('property', 'og:url', absoluteUrl(path));
    upsertMeta('property', 'og:image', img);
    upsertMeta('property', 'og:locale', 'fr_FR');
    upsertMeta('property', 'og:site_name', 'Infinite Core');

    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', description);
    upsertMeta('name', 'twitter:image', img);

    const org = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'Infinite Core',
      url: absoluteUrl('/'),
      logo: absoluteUrl('/infinite-core-logo-v2.png'),
    };
    upsertJsonLd('ic-jsonld-org', org);

    if (jsonLd) {
      upsertJsonLd('ic-jsonld-page', jsonLd);
    } else {
      document.getElementById('ic-jsonld-page')?.remove();
    }
  }, [title, description, path, image, type, noindex, jsonLd]);

  return null;
}
