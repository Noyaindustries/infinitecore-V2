import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Send,
  Paperclip,
  FileText,
  Download,
  ShoppingBag,
  FileSignature,
  Receipt,
  Search,
  Users,
  Zap,
  X,
  FolderOpen,
  Inbox,
} from 'lucide-react';
import { db } from '@/lib/clientSdk';
import { collection, doc, setDoc, onSnapshot, query, orderBy, updateDoc } from '@/lib/mongoFirestore';
import { uploadFile } from '../../services/uploadService';
import { useAuth } from '../../components/AuthProvider';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { cn } from '../../lib/utils';
import { formatFileSize } from '../../lib/formatFileSize';
import { formatTimeShort } from '../../lib/formatTimeShort';
import { notificationService } from '../../services/notificationService';

interface ChatMeta {
  clientId: string;
  clientName: string;
  clientEmail: string;
  lastMessage: string;
  lastMessageAt: string;
  unreadCommando: boolean;
}

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

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'À l\'instant';
  if (m < 60) return `Il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Il y a ${h}h`;
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export default function AdminMessagerie() {
  const { user, userData } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const clientFromQuery = searchParams.get('client');
  const [chats, setChats] = useState<ChatMeta[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatMeta | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [listFilter, setListFilter] = useState<'all' | 'unread'>('all');
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [allClients, setAllClients] = useState<any[]>([]);
  const [clientsCatalogReady, setClientsCatalogReady] = useState(false);
  const [clientSearch, setClientSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const commandoName = `${userData?.firstName || ''} ${userData?.lastName || ''}`.trim() || 'Équipe Commando';

  // Écoute tous les chats
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'chats'), (snap) => {
      const data = snap.docs
        .filter(d => d.data().clientId)
        .map(d => ({ ...d.data() } as ChatMeta))
        .sort((a, b) => {
          const ta = new Date(a.lastMessageAt || 0).getTime();
          const tb = new Date(b.lastMessageAt || 0).getTime();
          return tb - ta;
        });
      setChats(data);
    });
    
    // Même périmètre que le CRM / Dossiers : rôle « client » insensible à la casse (évite les écarts avec /admin/clients).
    const unsubClients = onSnapshot(collection(db, 'users'), (snap) => {
      setAllClients(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((u) => String((u as { role?: string }).role || '').toLowerCase() === 'client')
      );
      setClientsCatalogReady(true);
    });

    return () => {
      unsub();
      unsubClients();
    };
  }, []);

  useEffect(() => {
    const state = location.state as { selectClientId?: string } | null;
    const id = state?.selectClientId || clientFromQuery || undefined;
    if (!id) return;

    const fromChats = chats.find((c) => c.clientId === id);
    if (fromChats) {
      setSelectedChat(fromChats);
      if (state?.selectClientId) {
        navigate('.', { replace: true, state: null });
      }
      return;
    }

    const client = allClients.find((c: { id: string }) => c.id === id);
    if (client) {
      const clientName =
        `${client.firstName || ''} ${client.lastName || ''}`.trim() || client.email || 'Client';
      const clientEmail = client.email || '';

      void setDoc(
        doc(db, 'chats', id),
        {
          clientId: id,
          clientName,
          clientEmail,
          lastMessage: 'Conversation ouverte.',
          lastMessageAt: new Date().toISOString(),
          unreadCommando: false,
          unreadClient: false,
        },
        { merge: true }
      )
        .then(() => {
          setSelectedChat({
            clientId: id,
            clientName,
            clientEmail,
            lastMessage: '',
            lastMessageAt: new Date().toISOString(),
            unreadCommando: false,
          });
          if (state?.selectClientId) {
            navigate('.', { replace: true, state: null });
          }
        })
        .catch(() => {
          toast.error('Impossible d’ouvrir la conversation.');
          if (state?.selectClientId) {
            navigate('.', { replace: true, state: null });
          }
        });
      return;
    }

    if (clientsCatalogReady && allClients.length > 0 && !allClients.some((c: { id: string }) => c.id === id)) {
      toast.error('Client introuvable ou sans accès portail.');
      if (state?.selectClientId) {
        navigate('.', { replace: true, state: null });
      }
    }
  }, [location.state, clientFromQuery, chats, allClients, clientsCatalogReady, navigate]);

  // Écoute les messages du chat sélectionné
  useEffect(() => {
    if (!selectedChat) return;
    const q = query(
      collection(db, 'chats', selectedChat.clientId, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as Message)));
      // Marquer comme lu
      updateDoc(doc(db, 'chats', selectedChat.clientId), { unreadCommando: false }).catch(() => {});
    });
    return () => unsub();
  }, [selectedChat]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (msg: Partial<Message>) => {
    if (!selectedChat || !user) return;
    const msgRef = doc(collection(db, 'chats', selectedChat.clientId, 'messages'));
    await setDoc(msgRef, {
      id: msgRef.id,
      senderId: user.uid,
      senderName: commandoName,
      senderRole: 'commando',
      createdAt: new Date().toISOString(),
      readByCommando: true,
      ...msg,
    });
    await setDoc(doc(db, 'chats', selectedChat.clientId), {
      lastMessage: msg.text || msg.fileName || 'Fichier',
      lastMessageAt: new Date().toISOString(),
      unreadCommando: false,
      unreadClient: true,
    }, { merge: true });

    await notificationService.createNotification(
      selectedChat.clientId,
      'Nouveau message',
      msg.text ? msg.text.substring(0, 120) : `Fichier : ${msg.fileName || 'pièce jointe'}`,
      'message',
      { chatClientId: selectedChat.clientId },
    );
  };

  const handleCreateNewChat = async (client: any) => {
    try {
      const clientName =
        `${client.firstName || ''} ${client.lastName || ''}`.trim() || client.email || 'Client';
      const clientEmail = client.email || '';
      // Document `chats/{uid}` = même convention que le portail client (`chats/${user.uid}/messages`).
      await setDoc(
        doc(db, 'chats', client.id),
        {
          clientId: client.id,
          clientName,
          clientEmail,
          lastMessage: 'Chat initié par le commando.',
          lastMessageAt: new Date().toISOString(),
          unreadCommando: false,
          unreadClient: true,
        },
        { merge: true }
      );

      setShowNewChatModal(false);
      setSelectedChat({
        clientId: client.id,
        clientName,
        clientEmail,
        lastMessage: '',
        lastMessageAt: new Date().toISOString(),
        unreadCommando: false,
      });
    } catch (error) {
      toast.error('Erreur de création de chat');
    }
  };

  const handleSendText = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!text.trim() || sending) return;
    const t = text.trim();
    setText('');
    setSending(true);
    try {
      await sendMessage({ text: t, type: 'text' });
    } catch (err: unknown) {
      console.error('[Messagerie] Erreur envoi message:', err);
      toast.error('Erreur lors de l\'envoi.');
      setText(t);
    } finally {
      setSending(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedChat) return;
    e.target.value = '';

    setIsUploading(true);
    const toastId = toast.loading(`Envoi de ${file.name}...`);
    try {
      const result = await uploadFile(file, `chats/${selectedChat.clientId}`);
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

  const unreadCommandoCount = chats.filter((c) => c.unreadCommando).length;
  const filteredChats = chats
    .filter((c) => (listFilter === 'all' ? true : c.unreadCommando))
    .filter(
      (c) =>
        c.clientName?.toLowerCase().includes(search.toLowerCase()) ||
        c.clientEmail?.toLowerCase().includes(search.toLowerCase()),
    );

  // Regrouper messages par date
  const grouped: { date: string; messages: Message[] }[] = [];
  messages.forEach((msg) => {
    const date = formatDate(msg.createdAt);
    const last = grouped[grouped.length - 1];
    if (last && last.date === date) last.messages.push(msg);
    else grouped.push({ date, messages: [msg] });
  });

  const renderMessage = (msg: Message) => {
    const isMe = msg.senderRole === 'commando';
    const bubbleBase =
      'max-w-[75%] rounded-3xl px-5 py-4 text-sm shadow-md transition-all duration-200 hover:shadow-lg';
    const bubbleColor = isMe
      ? 'rounded-br-md bg-linear-to-br from-[#2a4365] via-[#355a85] to-[#243552] text-white border border-luxe-champagne/25 shadow-[0_14px_44px_-18px_rgba(15,24,40,0.75)]'
      : 'rounded-bl-md border border-white/[0.08] border-l-[3px] border-l-luxe-champagne/50 bg-[#0c1018]/95 text-text-primary shadow-[inset_0_1px_0_0_rgba(228,212,165,0.07)]';

    const content = () => {
      if (msg.type === 'file' && msg.fileUrl) {
        return (
          <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer"
            className={`flex items-center gap-3 ${isMe ? 'text-white' : 'text-text-primary'}`}>
            <div className={`p-2 rounded-lg ${isMe ? 'bg-luxe-champagne/15 ring-1 ring-white/10' : 'bg-surface-tertiary border border-border-subtle'}`}>
              <FileText size={20} className={isMe ? 'text-luxe-champagne-bright' : 'text-noya-blue'} />
            </div>
            <div className="min-w-0">
              <p className="font-black uppercase tracking-tight truncate max-w-[180px] text-[11px]">{msg.fileName}</p>
              {msg.fileSize && <p className={`text-[10px] font-bold uppercase tracking-widest ${isMe ? 'text-luxe-champagne-bright/65' : 'text-text-muted'}`}>{formatFileSize(msg.fileSize)}</p>}
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
              <div className={`flex items-center gap-2 mb-3 font-black uppercase text-[10px] tracking-widest ${isMe ? 'text-amber-100' : 'text-noya-orange'}`}>
                <Zap size={14} className="fill-current" />
                <span>Audit PADDE-CI Institutionnel</span>
                <span className={`px-2 py-0.5 rounded-md font-black border shadow-inner ${isMe ? 'bg-amber-400/25 text-amber-50 border-amber-200/25' : 'bg-noya-orange/10 text-noya-orange border-noya-orange/20'}`}>OFFERT</span>
              </div>
            ) : (
              <div className={`flex items-center gap-2 mb-3 font-black uppercase text-[10px] tracking-widest ${isMe ? 'text-luxe-champagne-bright/95' : 'text-noya-blue'}`}>
                <ShoppingBag size={14} /> Demande de service
              </div>
            )}
            <p className="font-black uppercase tracking-tight text-base mb-1">{msg.orderDetails.serviceName}</p>
            <p className={`text-[10px] font-black font-mono uppercase tracking-widest ${isMe ? 'text-luxe-champagne-bright/55' : 'text-text-dim'}`}>{msg.orderDetails.orderId}</p>
            {isPadde && (
              <p className={`text-[10px] mt-3 font-bold italic leading-relaxed ${isMe ? 'text-amber-100/85' : 'text-noya-orange/80'}`}>
                Flux de données sécurisé via padde-ci.com — Protocolisation en cours.
              </p>
            )}
          </div>
        );
      }
      if (msg.type === 'invoice') {
        return <div className="flex items-center gap-2"><Receipt size={16} /><span className="font-medium">{msg.text}</span></div>;
      }
      if (msg.type === 'contract') {
        return <div className="flex items-center gap-2"><FileSignature size={16} /><span className="font-medium">{msg.text}</span></div>;
      }
      return <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>;
    };

    return (
      <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} mb-2`}>
        {!isMe && (
          <div className="w-8 h-8 rounded-full border border-luxe-champagne/35 bg-linear-to-br from-luxe-champagne/25 to-noya-blue/15 text-luxe-champagne-bright text-[10px] font-black uppercase flex items-center justify-center mr-2 flex-shrink-0 mt-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            {msg.senderName?.charAt(0)?.toUpperCase() || 'C'}
          </div>
        )}
        <div className={`${bubbleBase} ${bubbleColor}`}>
          {!isMe && <p className="text-[10px] font-black text-luxe-champagne-bright uppercase tracking-widest mb-1.5">{msg.senderName}</p>}
          {content()}
          <p className={`text-[9px] mt-2 font-black uppercase tracking-widest text-right ${isMe ? 'text-luxe-champagne-bright/50' : 'text-text-muted'}`}>
            {formatTimeShort(msg.createdAt)}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-6 md:px-6 md:py-8">
      <div className="mb-6 flex flex-col gap-4 border-b border-white/6 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="commando-luxe-ornament-diamond mt-1.5 shrink-0" aria-hidden />
          <div>
            <p className="font-display text-[11px] uppercase tracking-[0.18em] text-luxe-champagne-bright/85">
              Infinite Commando
            </p>
            <h1 className="mt-1 font-display text-2xl font-normal tracking-tight text-text-primary md:text-3xl">
              Messagerie clients
            </h1>
            <p className="mt-2 max-w-xl text-sm text-text-secondary">
              Conversations portail : réponses, pièces jointes et demandes — le client est notifié sur son espace.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="commando-luxe-stat-slab px-4 py-3 text-center">
            <p className="font-display text-[10px] uppercase tracking-widest text-text-muted">Conversations</p>
            <p className="mt-1 font-display text-xl text-text-primary">{chats.length}</p>
          </div>
          <div className="commando-luxe-stat-slab px-4 py-3 text-center">
            <p className="font-display text-[10px] uppercase tracking-widest text-text-muted">Non lues</p>
            <p className="mt-1 font-display text-xl text-noya-blue">{unreadCommandoCount}</p>
          </div>
        </div>
      </div>

    <div className="flex min-h-[520px] h-[calc(100dvh-12rem)] max-h-[900px] bg-surface-primary rounded-3xl shadow-xl border border-border-subtle overflow-hidden relative">
      {/* Colonne gauche — liste des chats */}
      <div className={cn(
        "w-full md:w-80 lg:w-96 flex-shrink-0 border-r border-border-subtle flex flex-col bg-surface-secondary bg-opacity-50 transition-all duration-300",
        selectedChat ? "hidden md:flex" : "flex"
      )}>
        <div className="p-6 md:p-8 border-b border-border-subtle flex flex-col gap-5">
          <div className="flex justify-between items-center gap-2">
            <h2 className="font-black text-text-primary text-lg uppercase tracking-tight">Boîte de réception</h2>
            <button 
              onClick={() => setShowNewChatModal(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-luxe-champagne/35 bg-linear-to-br from-luxe-champagne/20 to-noya-blue/20 text-luxe-champagne-bright shadow-[0_6px_20px_-8px_rgba(0,0,0,0.45)] transition-all hover:scale-105 hover:border-luxe-champagne/55 active:scale-95"
              title="Nouvelle conversation"
              type="button"
            >
              <Zap size={20} className="fill-current" />
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setListFilter('all')}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-[10px] font-semibold uppercase tracking-wide transition-all',
                listFilter === 'all'
                  ? 'border-luxe-champagne/45 bg-luxe-champagne/12 text-luxe-champagne-bright ring-1 ring-luxe-champagne/20'
                  : 'border-white/10 text-text-muted hover:border-white/20 hover:text-text-primary',
              )}
            >
              <Inbox size={14} aria-hidden />
              Toutes
            </button>
            <button
              type="button"
              onClick={() => setListFilter('unread')}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-2 py-2.5 text-[10px] font-semibold uppercase tracking-wide transition-all',
                listFilter === 'unread'
                  ? 'border-luxe-champagne/45 bg-luxe-champagne/12 text-luxe-champagne-bright ring-1 ring-luxe-champagne/20'
                  : 'border-white/10 text-text-muted hover:border-white/20 hover:text-text-primary',
              )}
            >
              Non lues
              {unreadCommandoCount > 0 && (
                <span
                  className={cn(
                    'min-w-[1.125rem] rounded-full px-1 text-[9px] font-bold',
                    listFilter === 'unread'
                      ? 'bg-noya-blue/90 text-white'
                      : 'bg-noya-blue/85 text-white',
                  )}
                >
                  {unreadCommandoCount > 9 ? '9+' : unreadCommandoCount}
                </span>
              )}
            </button>
          </div>
          <div className="relative group">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-luxe-champagne-bright transition-colors" />
            <input
              type="text"
              placeholder="Scanner les contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-surface-primary border border-border-subtle rounded-2xl text-[11px] font-bold uppercase tracking-widest focus:outline-none focus:border-luxe-champagne/35 focus:ring-2 focus:ring-luxe-champagne/20 transition-all shadow-inner placeholder:opacity-30"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-2">
          {filteredChats.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-text-muted gap-4 p-8 text-center opacity-30">
              <Users size={48} />
              <p className="text-[10px] font-black uppercase tracking-[0.3em]">Néant opérationnel</p>
            </div>
          )}
          {filteredChats.map((chat) => {
            const isSel = selectedChat?.clientId === chat.clientId;
            return (
            <button
              key={chat.clientId}
              type="button"
              onClick={() => setSelectedChat(chat)}
              aria-label={`Ouvrir la conversation avec ${chat.clientName || 'client'}`}
              aria-current={isSel ? 'true' : undefined}
              className={cn(
                'group/item w-full rounded-3xl border p-4 text-left transition-all duration-200',
                isSel
                  ? 'scale-[1.01] border-luxe-champagne/45 bg-linear-to-br from-luxe-champagne/[0.14] via-noya-sidebar/40 to-luxe-champagne/[0.08] shadow-[0_10px_36px_-14px_rgba(0,0,0,0.5)] ring-1 ring-luxe-champagne/25'
                  : 'border-transparent hover:border-luxe-champagne/15 hover:bg-surface-tertiary/90',
              )}
            >
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-sm font-black shadow-inner transition-colors',
                    isSel
                      ? 'border-luxe-champagne/40 bg-linear-to-br from-luxe-champagne/30 to-noya-blue/30 text-luxe-champagne-bright'
                      : 'border-border-subtle bg-surface-tertiary text-text-muted group-hover/item:border-luxe-champagne/25 group-hover/item:bg-surface-elevated',
                  )}
                >
                  {chat.clientName?.charAt(0)?.toUpperCase() || 'C'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between">
                    <p
                      className={cn(
                        'truncate text-xs font-black uppercase tracking-tight',
                        isSel ? 'text-luxe-champagne-bright' : 'text-text-primary',
                      )}
                    >
                      {chat.clientName}
                    </p>
                    <span
                      className={cn(
                        'ml-2 shrink-0 text-[9px] font-black uppercase tracking-widest',
                        isSel ? 'text-luxe-champagne-bright/75' : 'text-text-dim opacity-70',
                      )}
                    >
                      {timeAgo(chat.lastMessageAt)}
                    </span>
                  </div>
                  <p className="truncate text-[10px] font-semibold text-text-secondary">{chat.lastMessage}</p>
                </div>
                {chat.unreadCommando && (
                  <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-noya-blue shadow-[0_0_10px_rgba(42,67,101,0.65)]" />
                )}
              </div>
            </button>
            );
          })}
        </div>
      </div>

      {/* Zone de chat */}
      {selectedChat ? (
        <div className="flex-1 flex flex-col bg-surface-primary">
          {/* Header */}
          <div className="px-5 py-4 sm:px-8 sm:py-6 border-b border-luxe-champagne/10 flex flex-wrap items-center justify-between gap-3 bg-linear-to-r from-surface-secondary via-noya-sidebar/25 to-surface-secondary flex-shrink-0">
            <div className="flex items-center gap-3 sm:gap-5 min-w-0">
              <button 
                onClick={() => setSelectedChat(null)}
                className="md:hidden p-2 -ml-2 text-text-muted hover:text-text-primary transition-all"
                type="button"
                aria-label="Retour à la liste des conversations"
              >
                <X size={20} />
              </button>
              <div className="w-14 h-14 rounded-2xl border border-luxe-champagne/25 bg-linear-to-br from-luxe-champagne/15 to-noya-blue/20 text-luxe-champagne-bright font-black text-xl flex items-center justify-center shadow-inner shrink-0">
                {selectedChat.clientName?.charAt(0)?.toUpperCase() || 'C'}
              </div>
              <div className="min-w-0">
                <p className="font-black text-text-primary uppercase tracking-tight text-lg truncate">{selectedChat.clientName}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                  <p className="text-[10px] text-text-muted font-black uppercase tracking-widest truncate max-w-[220px] sm:max-w-md">{selectedChat.clientEmail}</p>
                  <span className="w-1 h-1 rounded-full bg-luxe-champagne-bright/90 shadow-[0_0_6px_rgba(228,212,165,0.55)] shrink-0" />
                  <span className="text-[9px] text-luxe-champagne-bright/90 font-black uppercase tracking-widest">Canal actif</span>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to={`/admin/dossiers`}
                state={{ selectClientId: selectedChat.clientId }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-luxe-champagne/25 bg-luxe-champagne/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-luxe-champagne-bright transition-all hover:border-luxe-champagne/45 hover:bg-luxe-champagne/15"
              >
                <FolderOpen size={14} aria-hidden />
                Dossier
              </Link>
              <Link
                to={`/admin/messagerie?client=${encodeURIComponent(selectedChat.clientId)}`}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-text-muted transition-all hover:border-noya-blue/30 hover:text-noya-blue"
                title="Lien direct (partage interne)"
              >
                Lien
              </Link>
            </div>
          </div>

          {/* Messages */}
          <div className="custom-scrollbar flex-1 overflow-y-auto bg-linear-to-b from-surface-primary/30 via-noya-sidebar/[0.14] to-[#060a10] px-8 py-10 space-y-6">
            {grouped.map(({ date, messages: dayMsgs }) => (
              <div key={date} className="space-y-6">
                <div className="flex items-center gap-6 my-12">
                  <div className="h-px flex-1 bg-linear-to-r from-transparent via-luxe-champagne/25 to-transparent" />
                  <span className="whitespace-nowrap px-4 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-luxe-champagne-bright/75">
                    {date}
                  </span>
                  <div className="h-px flex-1 bg-linear-to-l from-transparent via-luxe-champagne/25 to-transparent" />
                </div>
                {dayMsgs.map(renderMessage)}
              </div>
            ))}
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-text-muted gap-4 opacity-30">
                <Users size={64} />
                <p className="text-[11px] font-black uppercase tracking-[0.3em]">Communication vierge — Initialisez le flux</p>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-luxe-champagne/10 bg-linear-to-r from-surface-secondary via-noya-sidebar/20 to-surface-secondary p-6 flex-shrink-0">
            <form onSubmit={handleSendText} className="flex items-end gap-4 max-w-6xl mx-auto">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-14 h-14 bg-surface-tertiary border border-border-subtle text-text-muted hover:text-noya-blue hover:border-noya-blue/30 rounded-2xl flex items-center justify-center transition-all shadow-sm group/clip disabled:opacity-50"
              >
                {isUploading
                  ? <div className="w-5 h-5 border-2 border-noya-blue/30 border-t-noya-blue rounded-full animate-spin" />
                  : <Paperclip size={24} className="group-hover/clip:scale-110 transition-transform" />
                }
              </button>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileChange}
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar"
                aria-label="Joindre un fichier à la conversation"
              />
              <div className="flex-1 relative">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void handleSendText();
                    }
                  }}
                  rows={1}
                  placeholder="Injecter un signal..."
                  className="w-full px-6 py-4 bg-surface-primary/90 border border-white/[0.08] text-text-primary rounded-2xl outline-none resize-none text-[13px] font-bold uppercase tracking-tight max-h-32 shadow-inner placeholder:italic placeholder:opacity-20 transition-all focus:border-luxe-champagne/35 focus:ring-2 focus:ring-luxe-champagne/20"
                />
              </div>
              <button
                type="submit"
                disabled={!text.trim() || sending}
                className="w-14 h-14 rounded-2xl bg-linear-to-br from-[#2a4a7a] via-noya-blue to-[#243552] text-white ring-1 ring-luxe-champagne/25 shadow-[0_10px_28px_-10px_rgba(15,24,40,0.65)] flex items-center justify-center hover:scale-[1.05] active:scale-95 transition-all disabled:opacity-30 disabled:grayscale disabled:scale-100"
              >
                {sending ? (
                  <div className="h-6 w-6 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-hidden />
                ) : (
                  <Send size={24} className="translate-x-0.5 -translate-y-0.5" />
                )}
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-text-muted gap-6 opacity-40 bg-surface-primary">
          <div className="w-24 h-24 bg-surface-tertiary border border-border-subtle rounded-3xl flex items-center justify-center shadow-inner">
            <Users size={48} />
          </div>
          <p className="text-[11px] font-black uppercase tracking-[0.5em]">Synchronisation requise</p>
        </div>
      )}

      {/* Mode New Chat Search */}
      <AnimatePresence>
        {showNewChatModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-noya-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-surface-secondary rounded-[40px] shadow-2xl border border-border-medium w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-8 border-b border-border-subtle bg-surface-primary/50 flex justify-between items-center">
                <h3 className="font-black text-text-primary text-xl uppercase tracking-tight">Scanner Clients</h3>
                <button
                  type="button"
                  onClick={() => setShowNewChatModal(false)}
                  className="w-10 h-10 flex items-center justify-center hover:bg-surface-tertiary rounded-2xl transition-all text-text-secondary"
                  aria-label="Fermer"
                >
                  <X size={24} />
                </button>
              </div>
              <div className="p-6">
                <div className="relative group">
                  <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-noya-blue transition-colors" />
                  <input
                    type="text"
                    placeholder="Chercher par nom, email..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    className="w-full pl-12 pr-6 py-4 bg-surface-primary border border-border-subtle text-text-primary rounded-2xl focus:ring-2 focus:ring-noya-blue outline-none font-bold uppercase text-[11px] tracking-widest transition-all"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-2">
                {allClients
                  .filter(c => `${c.firstName} ${c.lastName} ${c.email}`.toLowerCase().includes(clientSearch.toLowerCase()))
                  .map(client => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => handleCreateNewChat(client)}
                      className="group/cli flex w-full items-center gap-4 rounded-3xl border border-transparent p-4 text-left transition-all hover:border-luxe-champagne/25 hover:bg-luxe-champagne/[0.07]"
                    >
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border-subtle bg-surface-tertiary font-black text-text-muted shadow-inner transition-colors group-hover/cli:border-luxe-champagne/35 group-hover/cli:bg-linear-to-br group-hover/cli:from-luxe-champagne/20 group-hover/cli:to-noya-blue/20 group-hover/cli:text-luxe-champagne-bright">
                        {(client.firstName?.charAt(0) || client.email?.charAt(0) || 'C').toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black uppercase tracking-tight text-text-primary transition-colors group-hover/cli:text-luxe-champagne-bright">
                          {client.firstName} {client.lastName}
                        </p>
                        <p className="text-[10px] text-text-muted font-black uppercase tracking-widest mt-0.5">{client.email}</p>
                      </div>
                    </button>
                  ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
    </div>
  );
}
