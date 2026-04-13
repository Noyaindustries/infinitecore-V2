import React, { useState, useEffect } from 'react';
import { Download, FileText, FileArchive, PlayCircle, Image as ImageIcon, Folder } from 'lucide-react';
import { motion } from 'framer-motion';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';

const TYPE_ICONS: Record<string, React.ElementType> = {
  PDF: FileText,
  ZIP: FileArchive,
  MP4: PlayCircle,
  DOCX: FileText,
  IMG: ImageIcon,
};

const TYPE_COLORS: Record<string, { color: string; bg: string }> = {
  PDF: { color: 'text-red-500', bg: 'bg-red-500/10' },
  ZIP: { color: 'text-noya-orange', bg: 'bg-noya-orange/10' },
  MP4: { color: 'text-purple-500', bg: 'bg-purple-500/10' },
  DOCX: { color: 'text-noya-blue', bg: 'bg-noya-blue/10' },
  IMG: { color: 'text-noya-green', bg: 'bg-noya-green/10' },
};

export default function PartnerResources() {
  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'resources'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setResources(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-b-2 border-noya-blue rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-text-primary">Kit de Vente & Ressources</h1>
        <p className="text-text-secondary mt-1">Téléchargez les documents officiels pour vous aider à vendre Infinite Core.</p>
      </div>

      {resources.length === 0 ? (
        <div className="bg-noya-sidebar rounded-2xl border border-white/5 flex flex-col items-center justify-center py-20 gap-4 text-text-secondary/30">
          <Folder size={48} className="opacity-20" />
          <p className="font-medium text-text-secondary">Aucune ressource disponible pour le moment.</p>
          <p className="text-sm text-center max-w-xs">Les documents de vente seront mis à disposition par l'administrateur.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {resources.map((resource, index) => {
            const Icon = TYPE_ICONS[resource.fileType] || FileText;
            const colors = TYPE_COLORS[resource.fileType] || { color: 'text-gray-500', bg: 'bg-gray-50' };
            return (
              <motion.div
                key={resource.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-noya-sidebar p-6 rounded-2xl border border-white/5 flex flex-col justify-between hover:border-white/10 hover:shadow-xl transition-all"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className={`p-3 rounded-xl ${colors.bg}`}>
                    <Icon className={`w-6 h-6 ${colors.color}`} />
                  </div>
                  <div>
                    <h3 className="font-bold text-text-primary line-clamp-2">{resource.title}</h3>
                    <p className="text-xs text-text-secondary mt-1 font-medium">
                      {resource.fileType}{resource.size ? ` • ${resource.size}` : ''}
                    </p>
                  </div>
                </div>

                <a
                  href={resource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-3 bg-noya-blue/5 border border-noya-blue/10 rounded-xl text-sm font-bold text-noya-blue hover:bg-noya-blue/10 transition-all"
                >
                  <Download size={16} /> Télécharger
                </a>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
