import { useState } from 'react';
import { Copy, ExternalLink, PlayCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { demoUrlLabel } from '@/lib/appDemoUrl';

type Props = {
  demoUrl: string;
  appTitle: string;
};

export default function AppDetailDemoLink({ demoUrl, appTitle }: Props) {
  const [copied, setCopied] = useState(false);
  const label = demoUrlLabel(demoUrl);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(demoUrl);
      setCopied(true);
      toast.success('Lien de démo copié.');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Impossible de copier le lien.');
    }
  };

  return (
    <section className="border-b border-white/5 py-12" aria-labelledby="app-demo-heading">
      <div className="container mx-auto max-w-[900px] px-6">
        <div className="relative overflow-hidden rounded-2xl border border-[#6EA7EA]/25 bg-gradient-to-br from-[#0D1320] via-[#0D1320] to-[#1a365d]/40 p-6 md:p-8">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#6EA7EA]/10 blur-3xl" />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex items-center gap-2 text-[#6EA7EA]">
                <PlayCircle className="h-5 w-5 shrink-0" aria-hidden />
                <h2 id="app-demo-heading" className="text-lg font-bold text-[#F2F4F8]">
                  Démo en ligne
                </h2>
              </div>
              <p className="text-sm leading-relaxed text-[#8D98AA] md:text-[15px]">
                Explorez{' '}
                <a
                  href={demoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-[#6EA7EA] underline-offset-2 transition hover:text-[#9fc4f5] hover:underline"
                >
                  {appTitle}
                </a>{' '}
                dans un environnement de démonstration. Données fictives — accès libre sans engagement.
              </p>
              <a
                href={demoUrl}
                target="_blank"
                rel="noopener noreferrer"
                title={demoUrl}
                className="mt-4 inline-flex max-w-full items-center gap-1.5 break-all font-mono text-xs text-[#6EA7EA] underline-offset-2 transition hover:text-[#9fc4f5] hover:underline md:text-sm"
              >
                <span>{label}</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
              </a>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row md:flex-col lg:flex-row">
              <a
                href={demoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#6EA7EA] px-6 py-3.5 text-sm font-bold text-[#06080D] shadow-[0_0_24px_rgba(110,167,234,0.25)] transition hover:bg-[#7eb5f0]"
              >
                <PlayCircle className="h-4 w-4" />
                Ouvrir la démo
                <ExternalLink className="h-3.5 w-3.5 opacity-70" />
              </a>
              <button
                type="button"
                onClick={() => void copyUrl()}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-5 py-3.5 text-sm font-semibold text-[#F2F4F8] transition hover:border-[#6EA7EA]/40 hover:bg-white/5"
              >
                <Copy className="h-4 w-4" />
                {copied ? 'Copié' : 'Copier le lien'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
