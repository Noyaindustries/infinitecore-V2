import { useRef, useState } from 'react';
import { Download, Trash2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { uploadFile, deleteUploadedFile } from '../services/uploadService';
import { downloadAuthFile, isInternalDownloadUrl } from '../lib/downloadAuthFile';

type Props = {
  appId: string;
  packageUrl?: string;
  packagePublicId?: string;
  packageName?: string;
  onChange: (patch: {
    licensePackageUrl?: string;
    licensePackagePublicId?: string;
    licensePackageName?: string;
  }) => void;
};

export default function AppCatalogPackageUpload({
  appId,
  packageUrl = '',
  packagePublicId = '',
  packageName = '',
  onChange,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const handleUpload = async (file: File) => {
    const ext = file.name.toLowerCase();
    if (!ext.endsWith('.zip')) {
      toast.error('Choisissez un fichier ZIP.');
      return;
    }
    setUploading(true);
    const toastId = toast.loading('Upload du package…');
    try {
      if (packagePublicId) {
        try {
          await deleteUploadedFile(packagePublicId);
        } catch {
          /* ancien fichier optionnel */
        }
      }
      const result = await uploadFile(file, `app-packages/${appId}`);
      onChange({
        licensePackageUrl: result.url,
        licensePackagePublicId: result.publicId,
        licensePackageName: result.name || file.name,
      });
      toast.success('Package ZIP enregistré.', { id: toastId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload impossible.', { id: toastId });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDownload = async () => {
    if (!packageUrl.trim()) return;
    setDownloading(true);
    try {
      if (isInternalDownloadUrl(packageUrl)) {
        await downloadAuthFile(packageUrl, packageName || `${appId}.zip`);
      } else {
        window.open(packageUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Téléchargement impossible.');
    } finally {
      setDownloading(false);
    }
  };

  const handleRemove = async () => {
    if (packagePublicId) {
      try {
        await deleteUploadedFile(packagePublicId);
      } catch {
        /* ignore */
      }
    }
    onChange({
      licensePackageUrl: '',
      licensePackagePublicId: '',
      licensePackageName: '',
    });
    toast.success('Package retiré.');
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileRef}
        type="file"
        accept=".zip,application/zip,application/x-zip-compressed"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleUpload(file);
        }}
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-xl border border-noya-blue/30 bg-noya-blue/10 px-3 py-2 text-xs font-semibold text-noya-blue hover:bg-noya-blue/20 disabled:opacity-50"
        >
          <Upload className="h-3.5 w-3.5" aria-hidden />
          {uploading ? 'Envoi…' : 'Choisir un ZIP local'}
        </button>
        {packageUrl ? (
          <>
            <button
              type="button"
              disabled={downloading}
              onClick={() => void handleDownload()}
              className="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-text-primary hover:bg-text-primary/5 disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" aria-hidden />
              {downloading ? 'Téléchargement…' : 'Télécharger'}
            </button>
            <button
              type="button"
              onClick={() => void handleRemove()}
              className="inline-flex items-center gap-2 rounded-xl border border-noya-red/30 px-3 py-2 text-xs font-semibold text-noya-red hover:bg-noya-red/10"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              Retirer
            </button>
          </>
        ) : null}
      </div>

      {packageName ? (
        <p className="text-xs text-text-muted">
          Fichier : <span className="font-mono text-text-secondary">{packageName}</span>
        </p>
      ) : (
        <p className="text-xs text-text-muted">Ou collez une URL externe ci-dessous (Drive, GitHub Release…).</p>
      )}
    </div>
  );
}
