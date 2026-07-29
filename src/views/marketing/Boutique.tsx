import { useMemo, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../components/AuthProvider';
import { useAppCatalog } from '../../hooks/useAppCatalog';
import { resolveBoutiqueCta } from '../../lib/boutiqueCheckout';
import {
  BOUTIQUE_FILTERS,
  BOUTIQUE_SORT_OPTIONS,
  buildBoutiqueProducts,
  formatBoutiqueFcfa,
  sortBoutiqueProducts,
  type BoutiqueProduct,
  type BoutiqueSector,
  type BoutiqueSort,
} from '../../data/boutiqueProducts';
import './Boutique.css';

type TabId = 'apercu' | 'features' | 'pricing';

const CONTACT_TEL = 'tel:+2250777225185';
const CONTACT_DISPLAY = '+225 07 77 22 51 85';

function whatsappHref(product: BoutiqueProduct): string | null {
  const raw = product.whatsappNumber?.replace(/\D/g, '');
  if (!raw) return null;
  const text = encodeURIComponent(
    product.whatsappMessage || `Bonjour, je souhaite une démo de ${product.n}.`
  );
  return `https://wa.me/${raw}?text=${text}`;
}

function demoHref(product: BoutiqueProduct): string {
  return product.demoUrl || whatsappHref(product) || CONTACT_TEL;
}

function stars(rating: number): string {
  let s = '';
  for (let i = 0; i < 5; i++) {
    s += i < Math.floor(rating) ? '★' : '☆';
  }
  return s;
}

function stopCardToggle(e: MouseEvent) {
  e.stopPropagation();
}

function DashPreview({ product }: { product: BoutiqueProduct }) {
  const { dash, c } = product;
  const bmax = Math.max(...dash.bars, 1);
  return (
    <div className="dash-preview">
      <div className="dp-bar">
        <div className="dp-dot" style={{ background: '#E05252' }} />
        <div className="dp-dot" style={{ background: '#E8961E' }} />
        <div className="dp-dot" style={{ background: '#2EB464' }} />
        <div className="dp-title">{dash.title}</div>
      </div>
      <div className="dp-body">
        <div className="dp-stats">
          {dash.stats.map((s) => (
            <div key={s.l} className="dp-stat">
              <div className="dp-stat-v">{s.v}</div>
              <div className="dp-stat-l">{s.l}</div>
            </div>
          ))}
        </div>
        <div className="dp-chart">
          <div className="dp-chart-lbl">Activité — 12 dernières périodes</div>
          <div className="chart-bars">
            {dash.bars.map((b, i) => (
              <div
                key={`${dash.title}-bar-${i}`}
                className="bar"
                style={{ background: c, height: `${Math.round((b / bmax) * 44)}px` }}
              />
            ))}
          </div>
        </div>
        <div className="dp-list">
          {dash.rows.map((r) => (
            <div key={r.n} className="dp-row">
              <span className="dp-row-n">{r.n}</span>
              <span className="dp-row-v" style={{ color: r.c }}>
                {r.v}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ product }: { product: BoutiqueProduct }) {
  return (
    <div className="ov-grid">
      <DashPreview product={product} />
      <div className="ov-right">
        <p className="ov-desc">{product.desc}</p>
        <div className="incl-title">Ce qui est inclus</div>
        <div className="incl-grid">
          {product.incl.map(([ic, label]) => (
            <div key={label} className="incl-item">
              <span className="incl-ic">{ic}</span>
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FeaturesTab({ product }: { product: BoutiqueProduct }) {
  return (
    <div className="mod-grid">
      {product.modules.map((m) => (
        <div key={m.n} className="mod">
          <div className="mod-name">
            <span className="mod-ic">{m.ic}</span>
            {m.n}
          </div>
          <div className="mod-feats">
            {m.fs.map((f) => (
              <div key={f} className="mf">
                <div className="mf-dot" style={{ background: product.c }} />
                {f}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PricingTab({
  product,
  annual,
  onAnnualChange,
  isClient,
}: {
  product: BoutiqueProduct;
  annual: boolean;
  onAnnualChange: (v: boolean) => void;
  isClient: boolean;
}) {
  const hasSub = product.monthlyPrice != null;
  const displayMonthly =
    annual && product.annualMonthlyPrice != null
      ? product.annualMonthlyPrice
      : product.monthlyPrice;
  const annualTotal = product.annualTotalPrice;
  const subCta = resolveBoutiqueCta(isClient, {
    appId: product.id,
    pricing: 'subscription',
    billing: annual ? 'year' : 'month',
  });
  const licenseCta = resolveBoutiqueCta(isClient, {
    appId: product.id,
    pricing: 'license',
  });
  const trialCta = resolveBoutiqueCta(isClient, {
    appId: product.id,
    pricing: 'subscription',
    billing: 'month',
    trial: true,
  });

  return (
    <>
      {hasSub ? (
        <>
          <div className="lic-toggle">
            <span className="lic-lbl">Abonnement SaaS :</span>
            <div className="lic-t">
              <button
                type="button"
                className={`lt${annual ? '' : ' on'}`}
                onClick={() => onAnnualChange(false)}
              >
                Mensuel
              </button>
              <button
                type="button"
                className={`lt${annual ? ' on' : ''}`}
                onClick={() => onAnnualChange(true)}
              >
                Annuel
              </button>
            </div>
            {annual ? <span className="ann-badge">−20% sur l&apos;annuel</span> : null}
          </div>

          <div className="plans" style={{ gridTemplateColumns: '1fr' }}>
            <div className="plan popular">
              <div className="plan-pop-badge">Hébergé par Infinite Core</div>
              <div className="plan-name">Abonnement SaaS</div>
              <div className="plan-desc">Accès immédiat — rien à installer sur votre serveur</div>
              {displayMonthly != null ? (
                <div className="plan-price">
                  <div className="plan-v">
                    {formatBoutiqueFcfa(displayMonthly)}
                    <span className="plan-fcfa"> FCFA</span>
                  </div>
                  <div className="plan-u">
                    par mois
                    {annual && annualTotal != null
                      ? ` · ${formatBoutiqueFcfa(annualTotal)} FCFA / an`
                      : ''}
                  </div>
                </div>
              ) : null}
              <div className="plan-divider" />
              <div className="plan-feats">
                {[
                  'Hébergement et mises à jour inclus',
                  'Accès multi-appareils',
                  'Support en français',
                  'Paiement sécurisé (Stripe) · Mobile Money via l’équipe',
                ].map((t) => (
                  <div key={t} className="pf">
                    <span className="pf-ok">✓</span>
                    <span>{t}</span>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Link
                  className="plan-btn primary"
                  to={subCta}
                  style={{ background: product.c, color: '#fff' }}
                >
                  {annual ? "S'abonner à l'année" : "S'abonner au mois"}
                </Link>
                <Link className="plan-btn ghost" to={trialCta}>
                  Essai 14 jours gratuit
                </Link>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {product.licPrice != null ? (
        <div className="lic-box">
          <div>
            <div className="lb-title">Licence à vie</div>
            <p className="lb-desc">
              Payez une seule fois et hébergez l&apos;application chez vous. Sans abonnement mensuel —
              idéal si vous préférez un investissement unique et un contrôle total de
              l&apos;infrastructure.
            </p>
            <div className="lb-incl">
              <span className="lbi">À vie</span>
              <span className="lbi">Auto-hébergée</span>
              <span className="lbi">Package ZIP</span>
              <span className="lbi">Sans abonnement</span>
            </div>
          </div>
          <div className="lb-price">
            <div className="lb-v">
              {formatBoutiqueFcfa(product.licPrice)}
              <span className="lb-fcfa"> FCFA</span>
            </div>
            <div className="lb-note">Paiement unique</div>
            <Link className="lb-btn" to={licenseCta} style={{ background: product.c }}>
              Acheter la licence
            </Link>
          </div>
        </div>
      ) : null}

      {!hasSub && product.licPrice == null ? (
        <div className="lic-box">
          <div>
            <div className="lb-title">Tarification sur mesure</div>
            <p className="lb-desc">
              Contactez-nous pour un devis adapté à votre organisation.
            </p>
          </div>
          <div className="lb-price">
            <a className="lb-btn" href={CONTACT_TEL} style={{ background: product.c }}>
              Nous contacter
            </a>
          </div>
        </div>
      ) : null}
    </>
  );
}

function ProductDetail({
  product,
  tab,
  onTab,
  annual,
  onAnnualChange,
  isClient,
}: {
  product: BoutiqueProduct;
  tab: TabId;
  onTab: (t: TabId) => void;
  annual: boolean;
  onAnnualChange: (v: boolean) => void;
  isClient: boolean;
}) {
  const trialCta = resolveBoutiqueCta(isClient, {
    appId: product.id,
    pricing: 'subscription',
    billing: 'month',
    trial: true,
  });
  const demo = demoHref(product);

  let content: ReactNode;
  switch (tab) {
    case 'apercu':
      content = <OverviewTab product={product} />;
      break;
    case 'features':
      content = <FeaturesTab product={product} />;
      break;
    case 'pricing':
      content = (
        <PricingTab
          product={product}
          annual={annual}
          onAnnualChange={onAnnualChange}
          isClient={isClient}
        />
      );
      break;
    default: {
      const _exhaustive: never = tab;
      content = _exhaustive;
    }
  }

  return (
    <div className="detail" onClick={stopCardToggle} onKeyDown={(e) => e.stopPropagation()}>
      <div className="detail-inner">
        <div className="tabs">
          {(
            [
              ['apercu', 'Aperçu'],
              ['features', 'Fonctionnalités'],
              ['pricing', 'Tarifs & Licences'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`tab${tab === id ? ' on' : ''}`}
              onClick={() => onTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        {content}
      </div>
      <div className="det-footer">
        <div className="df-trial">
          <strong>14 jours gratuits</strong> — sans carte bancaire, sans engagement
        </div>
        <div className="df-btns">
          {demo.startsWith('/') ? (
            <Link className="df-ghost" to={demo}>
              Voir la démo
            </Link>
          ) : (
            <a className="df-ghost" href={demo} target="_blank" rel="noopener noreferrer">
              Voir la démo
            </a>
          )}
          <Link className="df-pri" to={trialCta} style={{ background: product.c }}>
            Commencer l&apos;essai gratuit
          </Link>
        </div>
      </div>
    </div>
  );
}

function ProductCard({
  product,
  open,
  onToggle,
  tab,
  onTab,
  annual,
  onAnnualChange,
  isClient,
}: {
  product: BoutiqueProduct;
  open: boolean;
  onToggle: () => void;
  tab: TabId;
  onTab: (t: TabId) => void;
  annual: boolean;
  onAnnualChange: (v: boolean) => void;
  isClient: boolean;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const price = product.monthlyPrice;
  const licenseOnly = price == null && product.licPrice != null;

  const handleToggle = () => {
    const willOpen = !open;
    onToggle();
    if (willOpen) {
      window.setTimeout(() => {
        cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    }
  };

  const badgeClass =
    product.badge === 'Populaire' ? 'badge-pop' : product.badge ? 'badge-new' : null;

  return (
    <div
      ref={cardRef}
      className={`pc${open ? ' open' : ''}`}
      role="button"
      tabIndex={0}
      onClick={handleToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleToggle();
        }
      }}
    >
      <div className="pc-head">
        <div className="pc-icon" style={{ background: `${product.c}22` }}>
          {product.ic}
        </div>
        <div className="pc-info">
          <div className="pc-name">
            {product.n}
            {product.badge && badgeClass ? (
              <span className={badgeClass}>{product.badge}</span>
            ) : null}
          </div>
          <div className="pc-meta">
            <span className="pc-sector">{product.sg}</span>
            <span className="pc-rating">
              <span className="stars">{stars(product.rating)}</span>
              {product.rating} ({product.users} clients)
            </span>
            <Link
              to={`/applications/${product.id}`}
              className="pc-sector"
              style={{ color: '#E8961E' }}
              onClick={stopCardToggle}
            >
              Fiche produit →
            </Link>
          </div>
        </div>
        <div className="pc-price-col">
          <div className="pc-price-from">{licenseOnly ? 'Licence à vie' : 'À partir de'}</div>
          <div className="pc-price-val">
            {price != null
              ? formatBoutiqueFcfa(price)
              : product.licPrice != null
                ? formatBoutiqueFcfa(product.licPrice)
                : 'Sur devis'}
            <span className="pc-price-unit">
              {price != null ? ' FCFA/mois' : product.licPrice != null ? ' FCFA' : ''}
            </span>
          </div>
        </div>
        <div className="pc-chevron" aria-hidden>
          ▼
        </div>
      </div>
      <p className="pc-tagline">{product.tl}</p>
      {open ? (
        <ProductDetail
          product={product}
          tab={tab}
          onTab={onTab}
          annual={annual}
          onAnnualChange={onAnnualChange}
          isClient={isClient}
        />
      ) : null}
    </div>
  );
}

export default function Boutique() {
  const { user, userData } = useAuth();
  const { apps, loading } = useAppCatalog();
  const [filter, setFilter] = useState<'all' | BoutiqueSector>('all');
  const [sort, setSort] = useState<BoutiqueSort>('popularity');
  const [openId, setOpenId] = useState<string | null>(null);
  const [tabMap, setTabMap] = useState<Record<string, TabId>>({});
  const [annualMap, setAnnualMap] = useState<Record<string, boolean>>({});

  const role = typeof userData?.role === 'string' ? userData.role : user?.role;
  const isClient = Boolean(user && role === 'client');

  const allProducts = useMemo(() => buildBoutiqueProducts(apps), [apps]);

  const products = useMemo(() => {
    const filtered =
      filter === 'all' ? allProducts : allProducts.filter((p) => p.s === filter);
    return sortBoutiqueProducts(filtered, sort);
  }, [allProducts, filter, sort]);

  return (
    <div className="boutique-page">
      <nav className="b-bc" aria-label="Fil d'Ariane">
        <Link to="/">Accueil</Link>
        <span>›</span>
        <Link to="/solutions">Produits</Link>
        <span>›</span>
        <em>Boutique</em>
      </nav>

      <section className="hero">
        <div className="hero-top">
          <div className="ht-left">
            <div className="ey">
              <div className="ey-d" />
              <span className="ey-t">Suite logicielle · Made in Abidjan</span>
            </div>
            <h1>
              Trouvez le logiciel fait
              <br />
              pour <em>votre métier</em>
            </h1>
            <p className="hero-sub">
              Abonnements flexibles ou licences à vie. Mobile Money accepté. Interface en français.
              Testez 14 jours gratuitement, aucune carte requise.
            </p>
          </div>
          <div className="stats-row">
            <div className="st">
              <div className="st-v">{allProducts.length || '—'}</div>
              <div className="st-l">Logiciels métier</div>
            </div>
            <div className="st">
              <div className="st-v">300+</div>
              <div className="st-l">Clients actifs</div>
            </div>
            <div className="st">
              <div className="st-v">4.8★</div>
              <div className="st-l">Note moyenne</div>
            </div>
          </div>
        </div>
      </section>

      <div className="ctrl">
        <div className="filters">
          {BOUTIQUE_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`fp${filter === f.id ? ' on' : ''}`}
              onClick={() => {
                setFilter(f.id);
                setOpenId(null);
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="sort-row">
          <span className="sort-lbl">Trier par</span>
          <select
            className="sort-sel"
            value={sort}
            onChange={(e) => setSort(e.target.value as BoutiqueSort)}
            aria-label="Trier les logiciels"
          >
            {BOUTIQUE_SORT_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="layout">
        {loading ? (
          <>
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="pc"
                style={{ minHeight: 120, opacity: 0.5 }}
                aria-hidden
              />
            ))}
          </>
        ) : products.length === 0 ? (
          <p className="hero-sub" style={{ padding: '24px 0' }}>
            Aucun logiciel dans cette catégorie.
          </p>
        ) : (
          products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              open={openId === p.id}
              onToggle={() => setOpenId((cur) => (cur === p.id ? null : p.id))}
              tab={tabMap[p.id] ?? 'apercu'}
              onTab={(t) => setTabMap((m) => ({ ...m, [p.id]: t }))}
              annual={annualMap[p.id] ?? false}
              onAnnualChange={(v) => setAnnualMap((m) => ({ ...m, [p.id]: v }))}
              isClient={isClient}
            />
          ))
        )}
      </div>

      <div className="pack-sec">
        <div className="pack">
          <div>
            <div className="pey">Offre Entreprise</div>
            <div className="pt">Pack Complet Infinite Core</div>
            <p className="pd">
              Accédez à l&apos;ensemble des modules à un tarif préférentiel. Idéal pour les holdings,
              groupes et entreprises multi-activités qui veulent un outil de gestion unifié avec un
              seul contrat.
            </p>
            <div className="pms">
              {allProducts.map((p) => (
                <span key={p.id} className="pm">
                  {p.n}
                </span>
              ))}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <a className="pcta-btn" href={CONTACT_TEL}>
              Demander un devis entreprise
            </a>
            <p className="pcta-note">
              {CONTACT_DISPLAY}
              <br />
              Réponse sous 24h ouvrées
            </p>
          </div>
        </div>
      </div>

      <div className="tbar">
        <div className="tbi">
          <div className="tbit">
            <div className="tbi-ic" aria-hidden>
              🔓
            </div>
            <div>
              <div className="tbi-lbl">14 jours gratuits</div>
              <div className="tbi-s">Aucune carte requise</div>
            </div>
          </div>
          <div className="tbit">
            <div className="tbi-ic" aria-hidden>
              📱
            </div>
            <div>
              <div className="tbi-lbl">Mobile Money</div>
              <div className="tbi-s">Via l&apos;équipe · Stripe carte</div>
            </div>
          </div>
          <div className="tbit">
            <div className="tbi-ic" aria-hidden>
              🇨🇮
            </div>
            <div>
              <div className="tbi-lbl">Conçu à Abidjan</div>
              <div className="tbi-s">Pour les PME africaines</div>
            </div>
          </div>
          <div className="tbit">
            <div className="tbi-ic" aria-hidden>
              💬
            </div>
            <div>
              <div className="tbi-lbl">Support français</div>
              <div className="tbi-s">Réactif 5j/7</div>
            </div>
          </div>
          <div className="tbit">
            <div className="tbi-ic" aria-hidden>
              📄
            </div>
            <div>
              <div className="tbi-lbl">Licence ou abonnement</div>
              <div className="tbi-s">Vous choisissez</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
