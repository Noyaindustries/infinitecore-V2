import { Link } from 'react-router-dom';
import { Cloud, Download, MessageCircle, Server } from 'lucide-react';
import { LICENSE_DELIVERY_STEPS, SUBSCRIPTION_DELIVERY_STEPS } from '../lib/appDeliveryGuide';

type Variant = 'shop' | 'dashboard' | 'detail';

type Props = {
  variant?: Variant;
  showMessagerieLink?: boolean;
};

export default function AppHowToGetAppGuide({ variant = 'shop', showMessagerieLink = true }: Props) {
  const compact = variant === 'dashboard';

  return (
    <section
      className={
        compact
          ? 'rounded-2xl border border-white/[0.08] bg-[#0a0e18]/85 p-5 sm:p-6'
          : 'rounded-2xl border border-border bg-noya-sidebar/80 p-5 sm:p-6'
      }
    >
      <h2
        className={
          compact
            ? 'font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-luxe-champagne/85'
            : 'text-lg font-bold text-text-primary'
        }
      >
        Comment obtenir votre application
      </h2>
      {!compact && (
        <p className="mt-2 text-sm text-text-secondary">
          Licence à vie = installation chez vous. Abonnement = application en ligne (SaaS), facturée par Infinite Core
          ou par l&apos;éditeur de l&apos;app.
        </p>
      )}

      <div className={`mt-4 grid gap-4 ${compact ? 'sm:grid-cols-2' : 'md:grid-cols-2'}`}>
        <div className="rounded-xl border border-noya-blue/25 bg-noya-blue/5 p-4">
          <div className="mb-3 flex items-center gap-2 text-noya-blue">
            <Server className="h-4 w-4 shrink-0" aria-hidden />
            <p className="text-sm font-bold">Licence à vie — chez vous</p>
          </div>
          <ol className="list-decimal space-y-2 pl-4 text-xs leading-relaxed text-text-secondary">
            {LICENSE_DELIVERY_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>

        <div className="rounded-xl border border-noya-orange/25 bg-noya-orange/5 p-4">
          <div className="mb-3 flex items-center gap-2 text-noya-orange">
            <Cloud className="h-4 w-4 shrink-0" aria-hidden />
            <p className="text-sm font-bold">Abonnement — SaaS en ligne</p>
          </div>
          <ol className="list-decimal space-y-2 pl-4 text-xs leading-relaxed text-text-secondary">
            {SUBSCRIPTION_DELIVERY_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-text-muted">
        <span className="inline-flex items-center gap-1.5">
          <Download className="h-3.5 w-3.5 text-noya-blue" aria-hidden />
          Package licence : Mon espace ou messagerie
        </span>
        {showMessagerieLink ? (
          <Link
            to="/dashboard/messagerie"
            className="inline-flex items-center gap-1.5 font-semibold text-noya-orange hover:underline"
          >
            <MessageCircle className="h-3.5 w-3.5" aria-hidden />
            Ouvrir la messagerie
          </Link>
        ) : null}
      </div>
    </section>
  );
}
