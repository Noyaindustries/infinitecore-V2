import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Upload, Download, FileText, FileImage, CreditCard, CheckCircle, PenTool, Folder, Trash2 } from 'lucide-react';
import { db, auth } from '../../firebase';
import { collection, onSnapshot, query, where, orderBy, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { uploadFile } from '../../services/uploadService';
import { handleFirestoreError, OperationType } from '../../utils/firestoreErrorHandler';
import toast from 'react-hot-toast';

export default function ClientDocuments() {
  const [activeTab, setActiveTab] = useState<'livrables' | 'pieces' | 'paiements' | 'contrats'>('livrables');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'documents'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDocuments(docsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'documents');
    });

    return () => unsubscribe();
  }, [auth.currentUser]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!auth.currentUser) {
      toast.error('Vous devez être connecté.');
      return;
    }

    setIsUploading(true);
    const toastId = toast.loading(`Chargement de ${file.name}...`);
    try {
      const documentId = `DOC-${Math.floor(1000 + Math.random() * 9000)}`;
      const result = await uploadFile(file, `documents/${auth.currentUser.uid}`);
      await setDoc(doc(db, 'documents', documentId), {
        id: documentId,
        userId: auth.currentUser!.uid,
        name: file.name,
        url: result.url,
        storagePath: result.publicId,
        type: activeTab,
        size: file.size,
        createdAt: new Date().toISOString(),
      });
      toast.success(`${file.name} a été chargé avec succès !`, { id: toastId });
    } catch (error) {
      console.error('Error uploading file:', error);
      toast.error('Erreur lors du chargement.', { id: toastId });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (documentId: string, fileName: string) => {
    if (!auth.currentUser) return;
    
    if (!window.confirm('Voulez-vous vraiment supprimer ce document ?')) return;

    try {
      await deleteDoc(doc(db, 'documents', documentId));
      toast.success('Document supprimé.');
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Erreur lors de la suppression.');
    }
  };

  const getFilteredDocuments = (type: string) => {
    return documents.filter(doc => doc.type === type);
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-noya-blue tracking-tight">Documents & Preuves</h1>
          <p className="text-text-secondary mt-1">Gérez vos fichiers, dossiers et signatures électroniques</p>
        </div>
        <div>
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            onChange={handleFileUpload}
            disabled={isUploading}
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-2 bg-noya-blue text-white px-5 py-2.5 rounded-xl shadow-sm hover:bg-blue-900 transition-colors font-medium disabled:opacity-50"
          >
            {isUploading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <Upload size={18} />
            )}
            Uploader un fichier
          </button>
        </div>
      </div>

      <div className="bg-noya-sidebar rounded-3xl shadow-sm border border-white/5 overflow-hidden">
        <div className="border-b border-white/5 p-4">
          <div className="flex gap-6 overflow-x-auto pb-2">
            <button
              onClick={() => setActiveTab('livrables')}
              className={`pb-4 px-2 font-medium text-sm transition-colors relative whitespace-nowrap ${
                activeTab === 'livrables' ? 'text-noya-blue' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Livrables Infinite
              {activeTab === 'livrables' && (
                <motion.div layoutId="clientDocTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-noya-blue" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('pieces')}
              className={`pb-4 px-2 font-medium text-sm transition-colors relative whitespace-nowrap ${
                activeTab === 'pieces' ? 'text-noya-blue' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Pièces Justificatives
              {activeTab === 'pieces' && (
                <motion.div layoutId="clientDocTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-noya-blue" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('paiements')}
              className={`pb-4 px-2 font-medium text-sm transition-colors relative whitespace-nowrap ${
                activeTab === 'paiements' ? 'text-noya-blue' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Preuves de Paiement
              {activeTab === 'paiements' && (
                <motion.div layoutId="clientDocTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-noya-blue" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('contrats')}
              className={`pb-4 px-2 font-medium text-sm transition-colors relative whitespace-nowrap ${
                activeTab === 'contrats' ? 'text-noya-blue' : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Contrats & Signatures
              {activeTab === 'contrats' && (
                <motion.div layoutId="clientDocTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-noya-blue" />
              )}
            </button>
          </div>
        </div>

        <div className="p-4 md:p-6">
          {activeTab === 'livrables' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {getFilteredDocuments('livrables').length === 0 && (
                <div className="col-span-2 text-center py-8 text-text-muted">
                  Aucun livrable disponible.
                </div>
              )}
              {getFilteredDocuments('livrables').map((doc) => (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="border border-white/5 rounded-2xl p-5 hover:shadow-md transition-shadow bg-noya-black/20 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-100 text-blue-600 rounded-xl">
                      <FileText size={24} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-text-primary truncate max-w-[200px]">{doc.name}</h4>
                      <p className="text-xs text-text-muted">
                        {new Date(doc.createdAt).toLocaleDateString('fr-FR')} • {formatSize(doc.size)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a href={doc.url} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-noya-blue hover:bg-blue-50 rounded-lg transition-colors">
                      <Download size={20} />
                    </a>
                    <button onClick={() => handleDelete(doc.id, doc.name)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={20} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {activeTab === 'pieces' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {getFilteredDocuments('pieces').map((doc) => (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="border border-white/5 rounded-2xl p-5 hover:shadow-md transition-shadow bg-noya-black/20 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-orange-100 text-orange-600 rounded-xl">
                      <FileImage size={24} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-text-primary truncate max-w-[200px]">{doc.name}</h4>
                      <p className="text-xs text-text-muted">Uploadé le {new Date(doc.createdAt).toLocaleDateString('fr-FR')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a href={doc.url} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-noya-blue hover:bg-blue-50 rounded-lg transition-colors">
                      <Download size={20} />
                    </a>
                    <button onClick={() => handleDelete(doc.id, doc.name)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={20} />
                    </button>
                  </div>
                </motion.div>
              ))}
              
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-white/10 rounded-2xl p-5 flex flex-col items-center justify-center text-text-muted hover:bg-white/5 hover:border-noya-blue/50 transition-colors cursor-pointer min-h-[100px]"
              >
                <Upload size={24} className="mb-2 text-text-muted" />
                <span className="text-sm font-medium">Glissez un fichier ou cliquez</span>
              </div>
            </div>
          )}

          {activeTab === 'paiements' && (
            <div className="space-y-6">
              <div className="bg-noya-blue/10 border border-noya-blue/20 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-noya-sidebar rounded-full shadow-sm text-noya-blue border border-white/5">
                    <CreditCard size={32} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-noya-blue">Preuves de paiement</h3>
                    <p className="text-sm text-text-secondary">Uploadez vos reçus, bordereaux ou captures Mobile Money.</p>
                  </div>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="bg-noya-blue text-white px-6 py-3 rounded-xl shadow-sm hover:bg-blue-900 transition-colors font-medium w-full md:w-auto disabled:opacity-50"
                >
                  Uploader Bordereau / Reçu Mobile Money
                </button>
              </div>

              <h4 className="font-bold text-text-primary mt-8 mb-4">Historique des paiements</h4>
              <div className="space-y-3">
                {getFilteredDocuments('paiements').map(doc => (
                  <div key={doc.id} className="flex justify-between items-center p-4 border border-white/5 rounded-xl bg-noya-black/20">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="text-noya-green" size={20} />
                      <div>
                        <p className="font-medium text-text-primary">{doc.name}</p>
                        <p className="text-xs text-text-muted">Uploadé le {new Date(doc.createdAt).toLocaleDateString('fr-FR')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a href={doc.url} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-noya-blue hover:bg-blue-50 rounded-lg transition-colors">
                        <Download size={20} />
                      </a>
                      <button onClick={() => handleDelete(doc.id, doc.name)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                ))}
                {getFilteredDocuments('paiements').length === 0 && (
                  <div className="text-text-muted text-sm">Aucun reçu uploadé.</div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'contrats' && (
            <div className="space-y-6">
              <div className="bg-noya-blue/10 border border-noya-blue/20 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                  <h3 className="text-xl font-bold text-noya-blue mb-2">Signature Électronique</h3>
                  <p className="text-text-secondary text-sm">
                    Signez vos contrats et devis en ligne en toute sécurité (Certificat SHA-256).
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {getFilteredDocuments('contrats').map((doc) => (
                  <motion.div
                    key={doc.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="border border-white/5 rounded-2xl p-5 hover:shadow-md transition-shadow bg-noya-black/20 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-xl bg-green-100 text-green-600">
                        <PenTool size={24} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-text-primary truncate max-w-[200px]">{doc.name}</h4>
                        <p className="text-xs text-text-muted">Généré le {new Date(doc.createdAt).toLocaleDateString('fr-FR')}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <a href={doc.url} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-noya-blue hover:bg-blue-50 rounded-lg transition-colors">
                        <Download size={20} />
                      </a>
                      <button onClick={() => handleDelete(doc.id, doc.name)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </motion.div>
                ))}
                {getFilteredDocuments('contrats').length === 0 && (
                  <div className="col-span-2 text-text-muted text-sm">Aucun contrat disponible.</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
