import React, { useState, useEffect, useRef } from 'react';
import { Send, Paperclip, FileText, Download, ShoppingBag, FileSignature, Receipt, Search, Users, Zap, X } from 'lucide-react';
import { db, auth } from '../../firebase';
import { collection, doc, setDoc, onSnapshot, query, orderBy, updateDoc, where } from 'firebase/firestore';
import { uploadFile } from '../../services/uploadService';
import { useAuth } from '../../components/FirebaseProvider';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { cn } from '../../lib/utils';

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
  const [chats, setChats] = useState<ChatMeta[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatMeta | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [search, setSearch] = useState('');
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [allClients, setAllClients] = useState<any[]>([]);
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
        .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
      setChats(data);
    });
    
    // Fetch all clients for initiating new chats
    const unsubClients = onSnapshot(query(collection(db, 'users'), where('role', '==', 'client')), (snap) => {
      setAllClients(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => {
      unsub();
      unsubClients();
    };
  }, []);

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
    }, { merge: true });

    // Notification pour le client
    const notifRef = doc(collection(db, 'notifications'));
    await setDoc(notifRef, {
      id: notifRef.id,
      userId: selectedChat.clientId,
      title: 'Nouveau message',
      message: msg.text ? msg.text.substring(0, 80) : `Fichier : ${msg.fileName}`,
      type: 'ticket',
      read: false,
      createdAt: new Date().toISOString(),
    });
  };

  const handleCreateNewChat = async (client: any) => {
    try {
      const chatId = `CHAT-${client.id.substring(0,8)}`;
      // Always select or create
      await setDoc(doc(db, 'chats', chatId), {
        id: chatId,
        clientId: client.id,
        clientName: `${client.firstName || ''} ${client.lastName || ''}`.trim() || client.email,
        clientEmail: client.email,
        lastMessage: 'Chat initié par le commando.',
        lastMessageAt: new Date().toISOString(),
        unreadCommando: false,
        unreadClient: true,
      }, { merge: true }); // merge ensures we don't overwrite if it exists

      setShowNewChatModal(false);
      // Let the onSnapshot handle switching or switch manually based on clientId
      const newChatMeta = {
        clientId: client.id,
        clientName: `${client.firstName || ''} ${client.lastName || ''}`.trim() || client.email,
        clientEmail: client.email,
        lastMessage: '',
        lastMessageAt: new Date().toISOString(),
        unreadCommando: false
      };
      setSelectedChat(newChatMeta);
    } catch (error) {
      toast.error('Erreur de création de chat');
    }
  };

  const handleSendText = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    const t = text.trim();
    setText('');
    try {
      await sendMessage({ text: t, type: 'text' });
    } catch (err: any) {
      console.error('[Messagerie] Erreur envoi message:', err?.code, err?.message);
      toast.error('Erreur lors de l\'envoi.');
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

  const filteredChats = chats.filter(c =>
    c.clientName?.toLowerCase().includes(search.toLowerCase()) ||
    c.clientEmail?.toLowerCase().includes(search.toLowerCase())
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
    const bubbleBase = 'max-w-[75%] rounded-3xl px-5 py-4 text-sm shadow-md transition-all hover:shadow-lg';
    const bubbleColor = isMe
      ? 'bg-noya-blue text-white rounded-br-sm'
      : 'bg-surface-secondary text-text-primary border border-border-subtle rounded-bl-sm';

    const content = () => {
      if (msg.type === 'file' && msg.fileUrl) {
        return (
          <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer"
            className={`flex items-center gap-3 ${isMe ? 'text-white' : 'text-text-primary'}`}>
            <div className={`p-2 rounded-lg ${isMe ? 'bg-white/20' : 'bg-surface-tertiary border border-border-subtle'}`}>
              <FileText size={20} className={isMe ? 'text-white' : 'text-noya-blue'} />
            </div>
            <div className="min-w-0">
              <p className="font-black uppercase tracking-tight truncate max-w-[180px] text-[11px]">{msg.fileName}</p>
              {msg.fileSize && <p className={`text-[10px] font-bold uppercase tracking-widest ${isMe ? 'text-blue-100 opacity-70' : 'text-text-muted'}`}>{formatSize(msg.fileSize)}</p>}
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
              <div className={`flex items-center gap-2 mb-3 font-black uppercase text-[10px] tracking-widest ${isMe ? 'text-yellow-200' : 'text-noya-orange'}`}>
                <Zap size={14} className="fill-current" />
                <span>Audit PADDE-CI Institutionnel</span>
                <span className={`px-2 py-0.5 rounded-md font-black border shadow-inner ${isMe ? 'bg-yellow-500/30 text-yellow-100 border-yellow-500/20' : 'bg-noya-orange/10 text-noya-orange border-noya-orange/20'}`}>OFFERT</span>
              </div>
            ) : (
              <div className={`flex items-center gap-2 mb-3 font-black uppercase text-[10px] tracking-widest ${isMe ? 'text-blue-100' : 'text-noya-blue'}`}>
                <ShoppingBag size={14} /> Demande de service
              </div>
            )}
            <p className="font-black uppercase tracking-tight text-base mb-1">{msg.orderDetails.serviceName}</p>
            <p className={`text-[10px] font-black font-mono uppercase tracking-widest ${isMe ? 'text-blue-200 opacity-60' : 'text-text-dim'}`}>{msg.orderDetails.orderId}</p>
            {isPadde && (
              <p className={`text-[10px] mt-3 font-bold italic leading-relaxed ${isMe ? 'text-yellow-200/80' : 'text-noya-orange/80'}`}>
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
          <div className="w-8 h-8 rounded-full bg-surface-tertiary border border-border-subtle text-text-muted text-[10px] font-black uppercase flex items-center justify-center mr-2 flex-shrink-0 mt-1">
            {msg.senderName?.charAt(0)?.toUpperCase() || 'C'}
          </div>
        )}
        <div className={`${bubbleBase} ${bubbleColor}`}>
          {!isMe && <p className="text-[10px] font-black text-noya-blue uppercase tracking-widest mb-1.5">{msg.senderName}</p>}
          {content()}
          <p className={`text-[9px] mt-2 font-black uppercase tracking-widest text-right ${isMe ? 'text-blue-200 opacity-60' : 'text-text-dim opacity-50'}`}>
            {formatTime(msg.createdAt)}
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-surface-primary rounded-3xl shadow-xl border border-border-subtle overflow-hidden relative">
      {/* Colonne gauche — liste des chats */}
      <div className={cn(
        "w-full md:w-80 lg:w-96 flex-shrink-0 border-r border-border-subtle flex flex-col bg-surface-secondary bg-opacity-50 transition-all duration-300",
        selectedChat ? "hidden md:flex" : "flex"
      )}>
        <div className="p-8 border-b border-border-subtle flex flex-col gap-6">
          <div className="flex justify-between items-center">
            <h2 className="font-black text-text-primary text-2xl uppercase tracking-tighter">Messagerie</h2>
            <button 
              onClick={() => setShowNewChatModal(true)}
              className="w-10 h-10 bg-noya-blue text-white rounded-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-lg shadow-noya-blue/20"
              title="Nouvelle Communication"
            >
              <Zap size={20} className="fill-current" />
            </button>
          </div>
          <div className="relative group">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-noya-blue transition-colors" />
            <input
              type="text"
              placeholder="Scanner les contacts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-surface-primary border border-border-subtle rounded-2xl text-[11px] font-bold uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-noya-blue transition-all shadow-inner placeholder:opacity-30"
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
          {filteredChats.map((chat) => (
            <button
              key={chat.clientId}
              onClick={() => setSelectedChat(chat)}
              className={`w-full text-left p-4 rounded-3xl transition-all group/item ${selectedChat?.clientId === chat.clientId ? 'bg-noya-blue text-white shadow-xl shadow-noya-blue/20 scale-[1.02]' : 'hover:bg-surface-tertiary border border-transparent hover:border-border-subtle'}`}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl font-black text-sm flex items-center justify-center flex-shrink-0 shadow-inner border transition-colors ${selectedChat?.clientId === chat.clientId ? 'bg-white/20 border-white/20 text-white' : 'bg-surface-tertiary border-border-subtle text-text-muted group-hover/item:bg-surface-elevated'}`}>
                  {chat.clientName?.charAt(0)?.toUpperCase() || 'C'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-1">
                    <p className={`font-black uppercase tracking-tight text-xs truncate ${selectedChat?.clientId === chat.clientId ? 'text-white' : 'text-text-primary'}`}>{chat.clientName}</p>
                    <span className={`text-[9px] font-black uppercase tracking-widest flex-shrink-0 ml-2 opacity-60 ${selectedChat?.clientId === chat.clientId ? 'text-white' : 'text-text-dim'}`}>{timeAgo(chat.lastMessageAt)}</span>
                  </div>
                  <p className={`text-[10px] font-semibold truncate ${selectedChat?.clientId === chat.clientId ? 'text-white/80' : 'text-text-secondary'}`}>{chat.lastMessage}</p>
                </div>
                {chat.unreadCommando && (
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-[0_0_10px_currentColor] ${selectedChat?.clientId === chat.clientId ? 'bg-white' : 'bg-noya-blue'}`}></div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Zone de chat */}
      {selectedChat ? (
        <div className="flex-1 flex flex-col bg-surface-primary">
          {/* Header */}
          <div className="px-5 py-4 sm:px-8 sm:py-6 border-b border-border-subtle flex items-center justify-between bg-surface-secondary flex-shrink-0">
            <div className="flex items-center gap-3 sm:gap-5">
              <button 
                onClick={() => setSelectedChat(null)}
                className="md:hidden p-2 -ml-2 text-text-muted hover:text-text-primary transition-all"
              >
                <X size={20} />
              </button>
              <div className="w-14 h-14 rounded-2xl bg-surface-tertiary border border-border-subtle text-text-muted font-black text-xl flex items-center justify-center shadow-inner">
                {selectedChat.clientName?.charAt(0)?.toUpperCase() || 'C'}
              </div>
              <div>
                <p className="font-black text-text-primary uppercase tracking-tight text-lg">{selectedChat.clientName}</p>
                <div className="flex items-center gap-3 mt-1">
                  <p className="text-[10px] text-text-muted font-black uppercase tracking-widest">{selectedChat.clientEmail}</p>
                  <span className="w-1 h-1 rounded-full bg-noya-green shadow-[0_0_5px_currentColor]"></span>
                  <span className="text-[9px] text-noya-green font-black uppercase tracking-widest">Opérationnel</span>
                </div>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-8 py-10 space-y-6">
            {grouped.map(({ date, messages: dayMsgs }) => (
              <div key={date} className="space-y-6">
                <div className="flex items-center gap-6 my-12 opacity-40">
                  <div className="flex-1 h-px bg-border-subtle"></div>
                  <span className="text-[10px] text-text-muted font-black uppercase tracking-[0.4em] px-4 whitespace-nowrap">{date}</span>
                  <div className="flex-1 h-px bg-border-subtle"></div>
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
          <div className="bg-surface-secondary border-t border-border-subtle p-6 flex-shrink-0">
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
              />
              <div className="flex-1 relative">
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
                  placeholder="Injecter un signal..."
                  className="w-full px-6 py-4 bg-surface-primary border border-border-subtle text-text-primary rounded-2xl focus:ring-2 focus:ring-noya-blue outline-none resize-none text-[13px] font-bold uppercase tracking-tight max-h-32 shadow-inner placeholder:italic placeholder:opacity-20 transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={!text.trim()}
                className="w-14 h-14 bg-noya-blue text-white rounded-2xl flex items-center justify-center hover:scale-[1.05] active:scale-95 transition-all shadow-lg shadow-noya-blue/20 disabled:opacity-30 disabled:grayscale disabled:scale-100"
              >
                <Send size={24} className="translate-x-0.5 -translate-y-0.5" />
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
                <button onClick={() => setShowNewChatModal(false)} className="w-10 h-10 flex items-center justify-center hover:bg-surface-tertiary rounded-2xl transition-all text-text-secondary">
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
                      onClick={() => handleCreateNewChat(client)}
                      className="w-full text-left p-4 hover:bg-surface-tertiary rounded-3xl flex gap-4 items-center transition-all group/cli border border-transparent hover:border-border-subtle"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-surface-tertiary border border-border-subtle text-text-muted font-black flex items-center justify-center shadow-inner group-hover/cli:bg-noya-blue group-hover/cli:text-white transition-colors">
                        {(client.firstName?.charAt(0) || client.email?.charAt(0) || 'C').toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-text-primary uppercase tracking-tight text-sm truncate group-hover/cli:text-noya-blue transition-colors">
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
  );
}
