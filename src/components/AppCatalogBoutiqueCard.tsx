import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { formatFcfa, type AppCatalogEntry } from '../data/appCatalog';
import AppCatalogCardImage from './AppCatalogCardImage';

type Props = {
  app: AppCatalogEntry;
  buyTo: string;
  buyLabel: string;
};

export default function AppCatalogBoutiqueCard({ app, buyTo, buyLabel }: Props) {
  const sub = app.pricing.find((p) => p.type === 'subscription');
  const license = app.pricing.find((p) => p.type === 'license');

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-white/5 bg-[#0D1320] transition-all duration-500 hover:border-[#FFB332]/35 hover:shadow-[0_0_40px_rgba(255,179,50,0.12)]">
      <Link to={`/applications/${app.id}`} className="block shrink-0">
        <AppCatalogCardImage app={app} showTitle={false} className="rounded-none border-0 border-b border-white/5" />
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <Link to={`/applications/${app.id}`}>
          <h3 className="text-lg font-bold text-[#F2F4F8] transition hover:text-[#FFB332]">{app.title}</h3>
        </Link>
        <p className="mt-2 flex-1 text-[13px] leading-relaxed text-[#8D98AA]">{app.desc}</p>
        <p className="mt-2 text-[11px] text-[#6B7280]">Mise en service : {app.deliveryLabel}</p>
        <div className="mt-4 space-y-1 border-t border-white/5 pt-4 text-sm">
          {sub && (
            <div>
              <p className="font-bold text-[#FFB332]">
                {formatFcfa(sub.price)}
                <span className="text-xs font-medium text-[#8D98AA]"> / mois</span>
              </p>
              <p className="text-[11px] text-[#6B7280]">SaaS — hébergé par Infinite Core</p>
            </div>
          )}
          {license && sub && (
            <p className="text-xs text-[#8D98AA]">
              ou licence à vie sur devis — auto-hébergée
            </p>
          )}
          {license && !sub && (
            <div>
              <p className="font-bold text-[#FFB332]">Sur devis</p>
              <p className="text-[11px] text-[#6B7280]">Licence à vie — auto-hébergée</p>
            </div>
          )}
          {!license && !sub && (
            <p className="font-bold text-[#FFB332]">Sur devis</p>
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <Link
            to={`/applications/${app.id}`}
            className="inline-flex items-center gap-2 text-[13px] font-bold text-[#6EA7EA] transition-all hover:gap-3"
          >
            En savoir plus
            <ArrowRight size={16} aria-hidden />
          </Link>
          <Link
            to={buyTo}
            className="inline-flex items-center gap-2 text-[13px] font-bold text-[#FFB332] transition-all hover:gap-3"
          >
            {buyLabel}
            <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
      </div>
    </article>
  );
}
