import { useState } from 'react';
import { Download, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { downloadAuthFile, isInternalDownloadUrl } from '../lib/downloadAuthFile';

type Props = {
  packageUrl: string;
  packageName?: string;
  appId?: string;
  className?: string;
};

export default function LicensePackageDownloadButton({
  packageUrl,
  packageName,
  appId,
  className = '',
}: Props) {
  const [loading, setLoading] = useState(false);
  const filename = packageName || (appId ? `${appId}.zip` : 'application.zip');
  const internal = isInternalDownloadUrl(packageUrl);

  const handleClick = async () => {
    setLoading(true);
    try {
      if (internal) {
        await downloadAuthFile(packageUrl, filename);
        toast.success('Téléchargement démarré.');
      } else {
        window.open(packageUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Téléchargement impossible.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      disabled={loading}
      onClick={() => void handleClick()}
      className={
        className ||
        'inline-flex items-center gap-1.5 rounded-lg border border-noya-blue/30 bg-noya-blue/10 px-3 py-2 text-xs font-semibold text-noya-blue transition hover:bg-noya-blue/20 disabled:opacity-50'
      }
    >
      {internal ? <Download className="h-3.5 w-3.5" aria-hidden /> : <ExternalLink className="h-3.5 w-3.5" aria-hidden />}
      {loading ? 'Téléchargement…' : 'Télécharger le package'}
    </button>
  );
}
