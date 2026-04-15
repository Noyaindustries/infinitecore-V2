import React, { useState, useEffect, useRef } from 'react';
import { Upload, Link as LinkIcon, FileText, CheckCircle, AlertCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../components/AuthProvider';
import { db } from '@/lib/clientSdk';
import { collection, query, where, onSnapshot, addDoc } from '@/lib/mongoFirestore';
import { uploadFile } from '../../services/uploadService';

export default function DeveloperDeliverables() {
  const { user } = useAuth();
  const [missionId, setMissionId] = useState('');
  const [githubLink, setGithubLink] = useState('');
  const [notes, setNotes] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [missions, setMissions] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'missions'),
      where('assignedTo', '==', user.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      setMissions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [user]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!missionId) {
      toast.error('Veuillez sélectionner une mission.');
      return;
    }
    if (!user) return;

    setIsSubmitting(true);
    try {
      const uploadedFiles: { name: string; url: string; size: number }[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const result = await uploadFile(
          file,
          `livrables/${user.uid}`,
          (pct) => setUploadProgress(Math.round((i / files.length) * 100 + pct / files.length))
        );
        uploadedFiles.push({ name: file.name, url: result.url, size: file.size });
      }

      setUploadProgress(null);

      // Save livrable to Firestore
      await addDoc(collection(db, 'livrables'), {
        missionId,
        developerId: user.uid,
        githubLink: githubLink.trim() || null,
        notes: notes.trim() || null,
        files: uploadedFiles,
        status: 'En revue',
        createdAt: new Date().toISOString(),
      });

      toast.success('Livrable soumis avec succès !');
      setMissionId('');
      setGithubLink('');
      setNotes('');
      setFiles([]);
    } catch (error) {
      console.error(error);
      toast.error('Erreur lors de la soumission.');
      setUploadProgress(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-text-primary">Soumettre un livrable</h1>
      </div>

      <div className="bg-surface-secondary rounded-xl shadow-sm border border-border-subtle overflow-hidden">
        <form onSubmit={handleSubmit} className="p-8 space-y-8">
          <div className="bg-noya-blue/5 border border-noya-blue/20 rounded-2xl p-6 flex items-start gap-4 shadow-inner">
            <div className="p-3 bg-noya-blue/10 rounded-xl">
              <AlertCircle className="text-noya-blue" size={24} />
            </div>
            <div>
              <h3 className="text-sm font-black text-noya-blue uppercase tracking-tight">Protocole de livraison</h3>
              <p className="text-sm text-noya-blue/70 mt-1 leading-relaxed font-medium">
                Veuillez certifier l'intégrité du code avant soumission. Le dépôt GitHub doit être accessible et pointer vers la branche de production.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-3">
                Mission technique associée *
              </label>
              {missions.length === 0 ? (
                <div className="w-full px-4 py-3 bg-surface-primary border border-border-subtle rounded-xl text-xs text-text-dim italic font-medium">
                  Aucune mission active détectée dans votre registre.
                </div>
              ) : (
                <div className="space-y-4">
                  <select
                    value={missionId}
                    onChange={(e) => setMissionId(e.target.value)}
                    className="w-full px-4 py-3 bg-surface-primary border border-border-subtle rounded-xl focus:ring-2 focus:ring-noya-blue outline-none text-text-primary text-sm transition-all font-medium cursor-pointer"
                    required
                  >
                    <option value="" className="bg-surface-secondary">Sélectionner une mission</option>
                    {missions.map(m => (
                      <option key={m.id} value={m.id} className="bg-surface-secondary">{m.title}</option>
                    ))}
                  </select>

                  {missionId && (() => {
                    const m = missions.find(x => x.id === missionId);
                    if (!m) return null;
                    return (
                      <div className="p-4 bg-surface-primary/50 border border-border-subtle rounded-2xl flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                        {m.services && m.services.length > 0 ? (
                          m.services.map((s: any) => (
                            <span key={s.instanceId || s.id} className="text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded bg-noya-blue/5 text-noya-blue border border-noya-blue/10">
                              {s.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded bg-noya-blue/5 text-noya-blue border border-noya-blue/10">
                            {m.serviceName || 'Service Standard'}
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-3">
                Répertoire Source (GitHub/GitLab)
              </label>
              <div className="relative">
                <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
                <input
                  type="url"
                  value={githubLink}
                  onChange={(e) => setGithubLink(e.target.value)}
                  placeholder="https://github.com/votre-depot"
                  className="w-full pl-12 pr-4 py-3 bg-surface-primary border border-border-subtle rounded-xl focus:ring-2 focus:ring-noya-blue outline-none text-text-primary text-sm shadow-inner transition-all font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-3">
                Pièces Jointes & Preuves <span className="text-text-dim font-normal lowercase">(optionnel)</span>
              </label>
              <div
                className="mt-1 flex justify-center px-6 pt-10 pb-10 border-2 border-border-subtle border-dashed rounded-2xl hover:border-noya-blue/50 bg-surface-primary/30 transition-all cursor-pointer group"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="space-y-4 text-center">
                  <Upload className="mx-auto h-12 w-12 text-text-dim group-hover:text-noya-blue group-hover:scale-110 transition-all" />
                  <div className="flex text-sm text-text-secondary justify-center">
                    <span className="font-black text-noya-blue uppercase tracking-widest text-xs">Indexer de nouveaux fichiers</span>
                  </div>
                  <p className="text-[10px] text-text-dim uppercase tracking-widest font-black opacity-50">ZIP, PDF, images · max 50MB</p>
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                multiple
                onChange={handleFileChange}
              />
              {files.length > 0 && (
                <ul className="mt-6 space-y-3">
                  {files.map((file, index) => (
                    <li key={index} className="flex items-center gap-4 text-sm text-text-primary bg-surface-primary border border-border-subtle p-4 rounded-xl shadow-inner group/file">
                      <div className="p-2 bg-noya-blue/10 rounded-lg">
                        <FileText size={20} className="text-noya-blue" />
                      </div>
                      <span className="truncate flex-1 font-bold">{file.name}</span>
                      <span className="text-text-dim text-[10px] font-mono">({Math.round(file.size / 1024)} KB)</span>
                      <button type="button" onClick={() => removeFile(index)} className="text-noya-orange hover:text-noya-red hover:scale-110 transition-all p-2">
                        <X size={18} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {uploadProgress !== null && (
                <div className="mt-6">
                  <div className="w-full bg-surface-primary rounded-full h-2 overflow-hidden border border-border-subtle">
                    <div className="bg-noya-blue h-full rounded-full transition-all duration-300 shadow-[0_0_15px_rgba(110,167,234,0.4)]" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <p className="text-[10px] text-noya-blue mt-3 text-right font-black uppercase tracking-widest">{uploadProgress}% SYNC</p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-[10px] font-black text-text-secondary uppercase tracking-widest mb-3">
                Notes de déploiement & Instructions
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="Spécifications techniques, identifiants de test, remarques de mise en production..."
                className="w-full px-4 py-3 bg-surface-primary border border-border-subtle rounded-xl focus:ring-2 focus:ring-noya-blue outline-none text-text-primary text-sm resize-none shadow-inner transition-all font-medium"
              />
            </div>
          </div>

          <div className="pt-8 border-t border-border-subtle flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting || missions.length === 0}
              className="flex items-center gap-3 px-10 py-4 bg-noya-blue text-noya-black rounded-2xl font-black uppercase tracking-widest text-xs hover:scale-105 active:scale-95 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-noya-black/30 border-t-noya-black rounded-full animate-spin" />
                  INDEXATION...
                </>
              ) : (
                <>
                  <CheckCircle size={20} />
                  Soumettre au SuperAdmin
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
