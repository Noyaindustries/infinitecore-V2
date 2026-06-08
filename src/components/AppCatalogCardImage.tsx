import { useState } from 'react';
import { Package } from 'lucide-react';
import { getAppImageUrl, type AppCatalogEntry } from '../data/appCatalog';

type Props = {
  app: Pick<AppCatalogEntry, 'id' | 'title' | 'imageUrl'>;
  className?: string;
  /** Affiche le nom de l'app en overlay sur l'image. */
  showTitle?: boolean;
};

export default function AppCatalogCardImage({ app, className = '', showTitle = true }: Props) {
  const [failed, setFailed] = useState(false);
  const src = getAppImageUrl(app);

  return (
    <div
      className={`relative w-full overflow-hidden bg-[#111827] ${className}`}
      style={{ aspectRatio: '16 / 9' }}
    >
      {!failed ? (
        <img
          src={src}
          alt={`${app.title} — application Infinite Core`}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#1e3a5f] to-[#0D1320] text-[#8D98AA]">
          <Package className="h-10 w-10 text-[#FFB332]" aria-hidden />
          <span className="px-4 text-center text-xs font-semibold text-[#F2F4F8]">{app.title}</span>
        </div>
      )}
      {showTitle && !failed && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-4 pb-3 pt-10">
          <p className="text-base font-bold leading-tight text-white drop-shadow-sm">{app.title}</p>
        </div>
      )}
    </div>
  );
}
