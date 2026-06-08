import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type Props = {
  images: string[];
  title: string;
};

export default function AppDetailGallery({ images, title }: Props) {
  const [active, setActive] = useState(0);
  if (!images.length) return null;

  const safeActive = Math.min(active, images.length - 1);
  const current = images[safeActive];

  const prev = () => setActive((i) => (i <= 0 ? images.length - 1 : i - 1));
  const next = () => setActive((i) => (i >= images.length - 1 ? 0 : i + 1));

  return (
    <section className="border-b border-white/5 py-10 md:py-12">
      <div className="container mx-auto max-w-[1100px] px-6">
        <h2 className="mb-6 text-2xl font-bold text-[#F2F4F8]">Aperçus &amp; captures</h2>

        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0D1320]">
          <div className="relative aspect-[16/9] w-full">
            <img
              src={current}
              alt={`${title} — visuel ${safeActive + 1}`}
              className="absolute inset-0 h-full w-full object-cover"
            />
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={prev}
                  className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur hover:bg-black/70"
                  aria-label="Image précédente"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={next}
                  className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/50 text-white backdrop-blur hover:bg-black/70"
                  aria-label="Image suivante"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white">
                  {safeActive + 1} / {images.length}
                </span>
              </>
            )}
          </div>
        </div>

        {images.length > 1 && (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
            {images.map((src, idx) => (
              <button
                key={`${src}-${idx}`}
                type="button"
                onClick={() => setActive(idx)}
                className={`relative h-16 w-28 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                  idx === safeActive ? 'border-[#FFB332]' : 'border-white/10 opacity-75 hover:opacity-100'
                }`}
              >
                <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        )}

        {images.length > 1 && (
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {images.map((src, idx) => (
              <button
                key={`grid-${src}-${idx}`}
                type="button"
                onClick={() => setActive(idx)}
                className="overflow-hidden rounded-xl border border-white/10 bg-[#0D1320] transition hover:border-[#FFB332]/40"
              >
                <img
                  src={src}
                  alt={`${title} — miniature ${idx + 1}`}
                  className="aspect-video w-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
