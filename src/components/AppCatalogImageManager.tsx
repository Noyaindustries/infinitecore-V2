import { useRef, useState } from 'react';
import { ImagePlus, Link2, Star, Trash2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';
import { uploadFile } from '../services/uploadService';

type Props = {
  appId: string;
  imageUrl?: string;
  galleryImages?: string[];
  onChange: (patch: { imageUrl?: string; galleryImages?: string[] }) => void;
};

export default function AppCatalogImageManager({ appId, imageUrl = '', galleryImages = [], onChange }: Props) {
  const [urlInput, setUrlInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const gallery = galleryImages ?? [];

  const allImages = (() => {
    const main = imageUrl.trim();
    const seen = new Set<string>();
    const list: string[] = [];
    if (main) {
      seen.add(main);
      list.push(main);
    }
    for (const u of gallery) {
      const t = u.trim();
      if (t && !seen.has(t)) {
        seen.add(t);
        list.push(t);
      }
    }
    return list;
  })();

  const handleUpload = async (file: File, asMain: boolean) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Choisissez une image (JPG, PNG, WebP, SVG).');
      return;
    }
    setUploading(true);
    const toastId = toast.loading('Upload en cours…');
    try {
      const result = await uploadFile(file, `app-catalog/${appId}`);
      if (asMain) {
        onChange({ imageUrl: result.url, galleryImages: gallery.filter((g) => g !== result.url) });
      } else {
        const next = gallery.includes(result.url) ? gallery : [...gallery, result.url];
        onChange({ imageUrl: imageUrl || result.url, galleryImages: next });
      }
      toast.success('Image ajoutée.', { id: toastId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload impossible.', { id: toastId });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const addUrl = () => {
    const url = urlInput.trim();
    if (!url) return;
    const next = gallery.includes(url) ? gallery : [...gallery, url];
    onChange({ imageUrl: imageUrl || url, galleryImages: next });
    setUrlInput('');
    toast.success('URL ajoutée à la galerie.');
  };

  const removeImage = (url: string) => {
    const nextGallery = gallery.filter((g) => g !== url);
    const nextMain = imageUrl === url ? nextGallery[0] || '' : imageUrl;
    onChange({ imageUrl: nextMain, galleryImages: nextGallery.filter((g) => g !== nextMain) });
  };

  const setAsMain = (url: string) => {
    const rest = [...gallery.filter((g) => g !== url)];
    if (imageUrl && imageUrl !== url) rest.push(imageUrl);
    onChange({ imageUrl: url, galleryImages: rest });
    toast.success('Image principale mise à jour.');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleUpload(f, false);
          }}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-noya-black px-3 py-2 text-xs font-semibold text-text-primary hover:bg-text-primary/5 disabled:opacity-50"
        >
          <Upload className="h-4 w-4" />
          {uploading ? 'Upload…' : 'Importer une image'}
        </button>
        <button
          type="button"
          disabled={uploading}
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = () => {
              const f = input.files?.[0];
              if (f) void handleUpload(f, true);
            };
            input.click();
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-noya-orange/30 bg-noya-orange/10 px-3 py-2 text-xs font-semibold text-noya-orange hover:bg-noya-orange/20 disabled:opacity-50"
        >
          <Star className="h-4 w-4" />
          Image principale (upload)
        </button>
      </div>

      <div className="flex gap-2">
        <input
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="https://… ou /apps/mon-app.svg"
          className="min-w-0 flex-1 rounded-xl border border-border bg-noya-black px-3 py-2 text-sm text-text-primary"
        />
        <button
          type="button"
          onClick={addUrl}
          className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-border px-3 py-2 text-xs font-semibold text-noya-blue hover:bg-text-primary/5"
        >
          <Link2 className="h-4 w-4" />
          Ajouter URL
        </button>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold uppercase text-text-muted">Image principale (carte &amp; hero)</label>
        <input
          value={imageUrl}
          onChange={(e) => onChange({ imageUrl: e.target.value })}
          placeholder="/apps/erp-multi-ecole.svg"
          className="w-full rounded-xl border border-border bg-noya-black px-3 py-2 text-sm text-text-primary"
        />
      </div>

      {allImages.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {allImages.map((url) => {
            const isMain = url === imageUrl;
            return (
              <div key={url} className="group relative overflow-hidden rounded-xl border border-border bg-noya-black">
                <img src={url} alt="" className="aspect-video w-full object-cover" />
                {isMain && (
                  <span className="absolute left-2 top-2 rounded bg-noya-orange px-2 py-0.5 text-[10px] font-bold text-noya-black">
                    Principale
                  </span>
                )}
                <div className="absolute inset-0 flex items-end justify-center gap-1 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 transition group-hover:opacity-100">
                  {!isMain && (
                    <button
                      type="button"
                      onClick={() => setAsMain(url)}
                      className="rounded-lg bg-noya-orange/90 px-2 py-1 text-[10px] font-bold text-noya-black"
                    >
                      Principale
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removeImage(url)}
                    className="rounded-lg bg-noya-red/90 p-1 text-white"
                    aria-label="Supprimer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-10 text-text-muted">
          <ImagePlus className="mb-2 h-8 w-8 opacity-50" />
          <p className="text-sm">Aucune image — importez ou ajoutez une URL</p>
        </div>
      )}
    </div>
  );
}
