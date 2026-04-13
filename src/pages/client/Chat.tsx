import React, { useState, useEffect, useRef } from 'react';
import { Send, Paperclip, FileText, Download, ShoppingBag, FileSignature, Receipt, X, Zap } from 'lucide-react';
import { db, auth } from '../../firebase';
import { collection, doc, setDoc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { uploadFile } from '../../services/uploadService';
import { useAuth } from '../../components/FirebaseProvider';
import toast from 'react-hot-toast';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: 'client' | 'commando';
  text?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  type: 'text' | 'file' | 'order' | 'invoice' | 'contract';
  orderDetails?: { serviceName: string; orderId?: string; isPaddeAudit?: boolean };
  createdAt: string;
  readByCommando: boolean;
}

function formatSize(bytes: number) {
  if (!bytes) return '';
  const k = 1024;
  const sizes = ['o', 'Ko', 'Mo', 'Go'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

const MAX_INLINE_FILE_SIZE = 500 * 1024;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Lecture fichier impossible'));
    reader.readAsDataURL(file);
  });
}

export default function ClientChat() {
  const { user, userData } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const clientName = `${userData?.firstName || ''} ${userData?.lastName || ''}`.trim() || user?.email || 'Client';

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'chats', user.uid, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as Message)));
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (msg: Partial<Message>) => {
    if (!user) return;
    const msgRef = doc(collection(db, 'chats', user.uid, 'messages'));
    await setDoc(msgRef, {
      id: msgRef.id,
      senderId: user.uid,
      senderName: clientName,
      senderRole: 'client',
      createdAt: new Date().toISOString(),
      readByCommando: false,
      ...msg,
    });
    // Mettre à jour les métadonnées du chat
    await setDoc(doc(db, 'chats', user.uid), {
      clientId: user.uid,
      clientName,
      clientEmail: user.email,
      lastMessage: msg.text || msg.fileName || 'Fichier',
      lastMessageAt: new Date().toISOString(),
      unreadCommando: true,
    }, { merge: true });
  };

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    const t = text.trim();
    setText('');
    try {
      await sendMessage({ text: t, type: 'text' });
    } catch (err: any) {
      console.error('[Chat] Erreur envoi message:', err?.code, err?.message);
      toast.error('Erreur lors de l\'envoi.');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    e.target.value = '';

    setIsUploading(true);
    const toastId = toast.loading(`Envoi de ${file.name}...`);
    try {
      const result = await uploadFile(file, `chats/${user.uid}`);
      await sendMessage({ type: 'file', fileUrl: result.url, fileName: file.name, fileSize: file.size });
      toast.success('Fichier envoyé !', { id: toastId });
    } catch {
      try {
        if (file.size > MAX_INLINE_FILE_SIZE) {
          throw new Error('Fichier trop volumineux pour le mode secours');
        }
        const dataUrl = await fileToDataUrl(file);
        await sendMessage({ type: 'file', fileUrl: dataUrl, fileName: file.name, fileSize: file.size });
        toast.success('Fichier envoyé (mode secours) !', { id: toastId });
      } catch {
        toast.error('Erreur lors de l\'upload.', { id: toastId });
      }
    } finally {
      setIsUploading(false);
    }
  };

  // Regrouper les messages par date
  const grouped: { date: string; messages: Message[] }[] = [];
  messages.forEach((msg) => {
    const date = formatDate(msg.createdAt);
    const last = grouped[grouped.length - 1];
    if (last && last.date === date) {
      last.messages.push(msg);
    } else {
      grouped.push({ date, messages: [msg] });
    }
  });

  const renderMessage = (msg: Message) => {
    const isMe = msg.senderRole === 'client';
    const bubbleBase = `max-w-[75%] rounded-2xl px-4 py-3 text-sm shadow-sm`;
    const bubbleColor = isMe
      ? 'bg-noya-blue text-white rounded-br-sm shadow-[0_2px_10px_rgba(110,167,234,0.3)]'
      : 'bg-noya-sidebar text-text-primary border border-white/5 rounded-bl-sm';

    const content = () => {
      if (msg.type === 'file' && msg.fileUrl) {
        return (
          <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer"
            className={`flex items-center gap-3 ${isMe ? 'text-white' : 'text-gray-700'}`}>
            <div className={`p-2 rounded-lg ${isMe ? 'bg-white/20' : 'bg-noya-blue/10'}`}>
              <FileText size={20} className={isMe ? 'text-white' : 'text-noya-blue'} />
            </div>
            <div className="min-w-0">
              <p className="font-medium truncate max-w-[180px]">{msg.fileName}</p>
              {msg.fileSize && <p className={`text-xs ${isMe ? 'text-blue-100' : 'text-gray-400'}`}>{formatSize(msg.fileSize)}</p>}
            </div>
            <Download size={16} className="flex-shrink-0 opacity-70" />
          </a>
        );
      }
      if (msg.type === 'order' && msg.orderDetails) {
        const isPadde = msg.orderDetails.isPaddeAudit;
        return (
          <div>
            {isPadde ? (
              <div className={`flex items-center gap-2 mb-2 font-semibold ${isMe ? 'text-yellow-200' : 'text-yellow-700'}`}>
                <Zap size={16} />
                <span>Audit PADDE-CI</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${isMe ? 'bg-yellow-500/30 text-yellow-100' : 'bg-yellow-100 text-yellow-700'}`}>Gratuit</span>
              </div>
            ) : (
              <div className={`flex items-center gap-2 mb-2 font-semibold ${isMe ? 'text-blue-100' : 'text-blue-600'}`}>
                <ShoppingBag size={16} /> Demande de service
              </div>
            )}
            <p className="font-bold">{msg.orderDetails.serviceName}</p>
            <p className={`text-xs font-mono mt-1 ${isMe ? 'text-blue-200' : 'text-gray-400'}`}>{msg.orderDetails.orderId}</p>
            {isPadde && (
              <p className={`text-xs mt-2 ${isMe ? 'text-yellow-200' : 'text-yellow-600'}`}>
                Votre demande est en cours de traitement — notre équipe vous contacte bientôt.
              </p>
            )}
          </div>
        );
      }
      if (msg.type === 'invoice') {
        return (
          <div className="flex items-center gap-2">
            <Receipt size={16} /> <span className="font-medium">{msg.text}</span>
          </div>
        );
      }
      if (msg.type === 'contract') {
        return (
          <div className="flex items-center gap-2">
            <FileSignature size={16} /> <span className="font-medium">{msg.text}</span>
          </div>
        );
      }
      return <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>;
    };

    return (
      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-2`}>
        {!isMe && (
          <div className="w-8 h-8 rounded-full bg-noya-blue/20 text-noya-blue text-xs font-bold flex items-center justify-center mr-2 flex-shrink-0 mt-1 border border-noya-blue/20">
            IC
          </div>
        )}
        <div className={`${bubbleColor} ${bubbleBase}`}>
          {!isMe && <p className="text-xs font-semibold text-noya-blue mb-1">{msg.senderName}</p>}
          {content()}
          <p className={`text-[10px] mt-1.5 text-right ${isMe ? 'text-blue-200' : 'text-text-muted'}`}>
            {formatTime(msg.createdAt)}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] md:h-[calc(100vh-8rem)] max-w-4xl mx-auto shadow-2xl rounded-2xl overflow-hidden border border-white/5">
      {/* En-tête */}
      <div className="bg-noya-sidebar px-6 py-4 flex items-center gap-4 shadow-sm flex-shrink-0 border-b border-white/5">
        <div className="w-10 h-10 rounded-full bg-noya-blue text-white font-bold flex items-center justify-center text-sm shadow-[0_0_15px_rgba(110,167,234,0.3)]">
          IC
        </div>
        <div>
          <p className="font-bold text-text-primary">Équipe Infinite Core</p>
          <p className="text-xs text-noya-green font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-noya-green inline-block animate-pulse"></span>
            En ligne — répond généralement sous 24h
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-noya-black px-4 py-6 border-x border-white/5 scrollbar-hide">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-text-muted gap-3">
            <div className="w-16 h-16 bg-noya-sidebar rounded-full flex items-center justify-center border border-white/5">
              <Send size={28} className="text-text-dim" />
            </div>
            <p className="font-medium text-text-secondary">Aucun message pour le moment</p>
            <p className="text-sm max-w-xs text-text-muted">Envoyez un message à notre équipe — documents, commandes, questions, tout passe par ici.</p>
          </div>
        )}

        {grouped.map(({ date, messages: dayMsgs }) => (
          <div key={date}>
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-white/5"></div>
              <span className="text-xs text-text-muted font-medium px-2">{date}</span>
              <div className="flex-1 h-px bg-white/5"></div>
            </div>
            {dayMsgs.map(renderMessage)}
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* Zone de saisie */}
      <div className="bg-noya-sidebar p-4 shadow-sm flex-shrink-0 border-t border-white/5">
        <form onSubmit={handleSendText} className="flex items-end gap-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            title="Envoyer un fichier, document, facture..."
            className="p-3 text-text-secondary hover:text-noya-blue hover:bg-white/5 rounded-xl transition-colors flex-shrink-0 disabled:opacity-50"
          >
            {isUploading
              ? <div className="w-5 h-5 border-2 border-noya-blue/30 border-t-noya-blue rounded-full animate-spin" />
              : <Paperclip size={20} />
            }
          </button>

          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            onChange={handleFileChange}
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar"
          />

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendText(e as any);
              }
            }}
            rows={1}
            placeholder="Écrivez un message..."
            className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl focus:ring-2 focus:ring-noya-blue/50 focus:border-noya-blue outline-none resize-none text-sm max-h-32 text-text-primary"
          />

          <button
            type="submit"
            disabled={!text.trim()}
            className="p-3 bg-noya-blue text-white rounded-xl hover:bg-blue-900 transition-colors flex-shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send size={20} />
          </button>
        </form>
        <p className="text-xs text-gray-400 mt-2 text-center">
          Vous pouvez envoyer des documents, images, PDF, factures via le bouton <Paperclip size={11} className="inline" />
        </p>
      </div>
    </div>
  );
}
