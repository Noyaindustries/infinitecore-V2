import { useMemo } from 'react';
import { useLocation, matchPath } from 'react-router-dom';
import { useAppCatalog } from '../hooks/useAppCatalog';
import PageSeo from './PageSeo';
import { STATIC_SEO_ROUTES, buildAppProductJsonLd, siteUrl } from '@/lib/seo';

export default function MarketingSeo() {
  const { pathname } = useLocation();
  const { apps } = useAppCatalog();

  const appMatch = matchPath({ path: '/applications/:appId', end: true }, pathname);
  const app = appMatch?.params.appId
    ? apps.find((a) => a.id === appMatch.params.appId)
    : undefined;

  const appJsonLd = useMemo(() => {
    if (!app) return undefined;
    return [
      buildAppProductJsonLd(app),
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Accueil', item: `${siteUrl()}/` },
          { '@type': 'ListItem', position: 2, name: 'Boutique', item: `${siteUrl()}/#boutique` },
          { '@type': 'ListItem', position: 3, name: app.title },
        ],
      },
    ];
  }, [app]);

  if (app) {
    const desc = (app.longDescription || app.desc).slice(0, 160);
    return (
      <PageSeo
        title={`${app.title} — Licence & abonnement | Infinite Core`}
        description={desc}
        path={`/applications/${app.id}`}
        image={app.imageUrl || `/apps/${app.id}.svg`}
        type="product"
        jsonLd={appJsonLd}
      />
    );
  }

  const staticSeo = STATIC_SEO_ROUTES[pathname];
  if (staticSeo) {
    return <PageSeo {...staticSeo} path={pathname} />;
  }

  return (
    <PageSeo
      title="Infinite Core — Applications métier pour entreprises africaines"
      description="ERP, CRM, caisse et solutions sectorielles. Licences et abonnements en FCFA."
      path={pathname}
    />
  );
}
