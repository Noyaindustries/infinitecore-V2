import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { Link } from 'react-router-dom';
import {
  Download,
  FileSignature,
  FileText,
  LayoutDashboard,
  MessageCircle,
  Paperclip,
  Receipt,
  Send,
  ShoppingBag,
  Sparkles,
  User,
  Zap,
} from 'lucide-react';
import { collection, doc, onSnapshot, orderBy, query, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { uploadFile } from '../../services/uploadService';
import { useAuth } from '../../components/FirebaseProvider';
import toast from 'react-hot-toast';
import { formatFileSize } from '../../lib/formatFileSize';
import { formatTimeShort } from '../../lib/formatTimeShort';

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

interface ChatMeta {
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCommando?: boolean;
  unreadClient?: boolean;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

function formatShortDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
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
  const [chatMeta, setChatMeta] = useState<ChatMeta | null>(null);
  const [text, setText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const clientName = `${userData?.firstName || ''} ${userData?.lastName || ''}`.trim() || user?.email || 'Client';

  useEffect(() => {
    if (!user) return;
    const chatRef = doc(db, 'chats', user.uid);
    const unsubMeta = onSnapshot(chatRef, (snap) => {
      if (snap.exists()) {
        setChatMeta(snap.data() as ChatMeta);
      } else {
        setChatMeta(null);
      }
    });
    updateDoc(chatRef, { unreadClient: false }).catch(() => {});
    return () => unsubMeta();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'chats', user.uid, 'messages'), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Message)));
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(
    async (msg: Partial<Message>) => {
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
      await setDoc(
        doc(db, 'chats', user.uid),
        {
          clientId: user.uid,
          clientName,
          clientEmail: user.email,
          lastMessage: msg.text || msg.fileName || 'Fichier',
          lastMessageAt: new Date().toISOString(),
          unreadCommando: true,
          unreadClient: false,
        },
        { merge: true },
      );
    },
    [user, clientName],
  );

  const handleSendText = async (e?: FormEvent<HTMLFormElement>) => {
    e?.preventDefault();
    if (!text.trim() || !user) return;
    const t = text.trim();
    setText('');
    setSending(true);
    try {
      await sendMessage({ text: t, type: 'text' });
      textareaRef.current?.focus();
    } catch (err) {
      console.error('[Chat] envoi:', err);
      toast.error("Erreur lors de l'envoi.");
      setText(t);
    } finally {
      setSending(false);
    }
  };

  const onTextareaKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSendText();
    }
  };

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    e.target.value = '';

    setIsUploading(true);
    const toastId = toast.loading(`Envoi de ${file.name}…`);
    try {
      const result = await uploadFile(file, `chats/${user.uid}`);
      await sendMessage({ type: 'file', fileUrl: result.url, fileName: file.name, fileSize: file.size });
      toast.success('Fichier envoyé.', { id: toastId });
    } catch {
      try {
        if (file.size > MAX_INLINE_FILE_SIZE) {
          throw new Error('Fichier trop volumineux pour le mode secours');
        }
        const dataUrl = await fileToDataUrl(file);
        await sendMessage({ type: 'file', fileUrl: dataUrl, fileName: file.name, fileSize: file.size });
        toast.success('Fichier envoyé (secours).', { id: toastId });
      } catch {
        toast.error("Erreur lors de l'upload.", { id: toastId });
      }
    } finally {
      setIsUploading(false);
    }
  };

  const grouped = useMemo(() => {
    const out: { date: string; messages: Message[] }[] = [];
    messages.forEach((msg) => {
      const date = formatDate(msg.createdAt);
      const last = out[out.length - 1];
      if (last && last.date === date) {
        last.messages.push(msg);
      } else {
        out.push({ date, messages: [msg] });
      }
    });
    return out;
  }, [messages]);

  const lastActivityLabel = useMemo(() => {
    if (!chatMeta?.lastMessageAt) return null;
    return formatShortDate(chatMeta.lastMessageAt);
  }, [chatMeta]);

  const renderMessage = (msg: Message) => {
    const isMe = msg.senderRole === 'client';
    const bubbleBase = 'max-w-[min(85%,28rem)] rounded-2xl px-4 py-3 text-sm shadow-md';
    const bubbleColor = isMe
      ? 'rounded-br-md bg-linear-to-br from-noya-blue to-[#5a8fd4] text-white shadow-[0_8px_28px_-8px_rgba(110,167,234,0.45)]'
      : 'rounded-bl-md border border-white/[0.08] bg-[#0c1018]/95 text-text-primary shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]';

    const content = () => {
      if (msg.type === 'file' && msg.fileUrl) {
        return (
          <a
            href={msg.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center gap-3 ${isMe ? 'text-white' : 'text-text-primary'}`}
          >
            <div className={`rounded-xl p-2 ${isMe ? 'bg-white/15' : 'bg-noya-blue/12'}`}>
              <FileText size={20} className={isMe ? 'text-white' : 'text-noya-blue'} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{msg.fileName}</p>
              {msg.fileSize ? (
                <p className={`text-xs ${isMe ? 'text-white/75' : 'text-text-muted'}`}>{formatFileSize(msg.fileSize)}</p>
              ) : null}
            </div>
            <Download size={16} className="shrink-0 opacity-80" aria-hidden />
          </a>
        );
      }
      if (msg.type === 'order' && msg.orderDetails) {
        const isPadde = msg.orderDetails.isPaddeAudit;
        return (
          <div>
            {isPadde ? (
              <div className={`mb-2 flex items-center gap-2 font-semibold ${isMe ? 'text-amber-100' : 'text-noya-orange'}`}>
                <Zap size={16} aria-hidden />
                <span>Audit PADDE-CI</span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${isMe ? 'bg-amber-400/25 text-amber-50' : 'bg-noya-orange/15 text-noya-orange'}`}
                >
                  Gratuit
                </span>
              </div>
            ) : (
              <div className={`mb-2 flex items-center gap-2 font-semibold ${isMe ? 'text-blue-100' : 'text-noya-blue'}`}>
                <ShoppingBag size={16} aria-hidden /> Demande de service
              </div>
            )}
            <p className="font-bold">{msg.orderDetails.serviceName}</p>
            <p className={`mt-1 font-mono text-xs ${isMe ? 'text-blue-100/90' : 'text-text-muted'}`}>{msg.orderDetails.orderId}</p>
            {isPadde ? (
              <p className={`mt-2 text-xs ${isMe ? 'text-amber-100/90' : 'text-text-secondary'}`}>
                Votre demande est prise en charge — l&apos;équipe vous répond ici.
              </p>
            ) : null}
          </div>
        );
      }
      if (msg.type === 'invoice') {
        return (
          <div className="flex items-center gap-2">
            <Receipt size={16} aria-hidden /> <span className="font-medium">{msg.text}</span>
          </div>
        );
      }
      if (msg.type === 'contract') {
        return (
          <div className="flex items-center gap-2">
            <FileSignature size={16} aria-hidden /> <span className="font-medium">{msg.text}</span>
          </div>
        );
      }
      return <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>;
    };

    return (
      <div key={msg.id} className={`mb-3 flex ${isMe ? 'justify-end' : 'justify-start'}`}>
        {!isMe ? (
          <div className="mr-2 mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-luxe-champagne/30 bg-linear-to-br from-luxe-champagne/20 to-noya-blue/10 text-[10px] font-bold tracking-wide text-luxe-champagne-bright">
            IC
          </div>
        ) : null}
        <div className={`${bubbleColor} ${bubbleBase}`}>
          {!isMe ? <p className="mb-1.5 text-xs font-semibold text-luxe-champagne-bright">{msg.senderName}</p> : null}
          {content()}
          <p className={`mt-2 text-right text-[10px] ${isMe ? 'text-white/70' : 'text-text-muted'}`}>{formatTimeShort(msg.createdAt)}</p>
        </div>
      </div>
    );
  };

  if (!user) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-white/10 bg-[#0a0e18]/80 p-8 text-center text-text-secondary">
        Connectez-vous pour accéder à la messagerie.
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 pb-4">
      {/* Intro */}
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-linear-to-br from-[#0c101c] via-[#080c14] to-[#05080f] p-5 shadow-[0_32px_64px_-28px_rgba(0,0,0,0.65),0_0_0_1px_rgba(201,169,98,0.1)] sm:p-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-luxe-champagne/30 to-transparent" aria-hidden />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-luxe-champagne/25 bg-luxe-champagne/10 text-luxe-champagne-bright">
              <MessageCircle className="h-6 w-6" strokeWidth={1.5} aria-hidden />
            </div>
            <div>
              <div className="mb-1.5 inline-flex items-center gap-2 rounded-full border border-luxe-champagne/25 bg-luxe-champagne/[0.07] px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-luxe-champagne-bright">
                Messagerie privée
              </div>
              <h1 className="font-display text-2xl font-medium tracking-[0.02em] text-text-primary sm:text-3xl">Équipe Infinite Core</h1>
              <p className="mt-2 max-w-xl text-sm text-text-secondary">
                Canal direct avec votre interlocuteur : questions, pièces jointes, suivi de commandes et réponses centralisés ici.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:border-luxe-champagne/30 hover:text-text-primary sm:text-sm"
            >
              <LayoutDashboard className="h-4 w-4" aria-hidden />
              Mon espace
            </Link>
            <Link
              to="/dashboard/profil"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-text-secondary transition-colors hover:border-luxe-champagne/30 hover:text-text-primary sm:text-sm"
            >
              <User className="h-4 w-4" aria-hidden />
              Mon profil
            </Link>
          </div>
        </div>
      </div>

      {/* Fil de discussion */}
      <div className="flex min-h-[min(520px,calc(100dvh-14rem))] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#060910]/60 shadow-[0_24px_48px_-28px_rgba(0,0,0,0.55)]">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/[0.06] bg-[#080c14]/90 px-4 py-3 backdrop-blur-md sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-noya-blue/15 text-sm font-bold text-noya-blue ring-1 ring-noya-blue/25">
              IC
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-text-primary">Conversation avec Infinite</p>
              <p className="flex items-center gap-1.5 text-xs text-text-muted">
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-noya-green" aria-hidden />
                <span className="truncate">
                  {lastActivityLabel ? `Dernière activité ${lastActivityLabel}` : 'Nouvelle conversation'}
                </span>
              </p>
            </div>
          </div>
          {chatMeta?.lastMessage ? (
            <p className="hidden max-w-[40%] truncate text-right text-[11px] text-text-muted sm:block" title={chatMeta.lastMessage}>
              {chatMeta.lastMessage}
            </p>
          ) : null}
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto bg-linear-to-b from-noya-black/40 to-[#05080f] px-3 py-4 sm:px-5 sm:py-5">
          {messages.length === 0 ? (
            <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-4 px-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-[#0c1018] shadow-inner">
                <Send className="h-7 w-7 text-text-dim" aria-hidden />
              </div>
              <div>
                <p className="font-display text-lg text-text-primary">Aucun message pour le moment</p>
                <p className="mx-auto mt-2 max-w-sm text-sm text-text-secondary">
                  Écrivez ci-dessous pour lancer la discussion. Vous pouvez joindre des PDF, images ou documents professionnels.
                </p>
              </div>
            </div>
          ) : null}

          {grouped.map(({ date, messages: dayMsgs }) => (
            <div key={date}>
              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-linear-to-r from-transparent to-white/10" />
                <span className="px-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-luxe-champagne/80">{date}</span>
                <div className="h-px flex-1 bg-linear-to-l from-transparent to-white/10" />
              </div>
              {dayMsgs.map(renderMessage)}
            </div>
          ))}

          <div ref={bottomRef} className="h-2 shrink-0" />
        </div>

        <div className="shrink-0 border-t border-white/[0.06] bg-[#080c14]/95 p-3 backdrop-blur-md sm:p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSendText(e);
            }}
            className="flex items-end gap-2 sm:gap-3"
          >
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || sending}
              title="Joindre un fichier"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 text-text-secondary transition-colors hover:border-luxe-champagne/30 hover:bg-white/[0.04] hover:text-noya-blue disabled:opacity-40"
            >
              {isUploading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-noya-blue/30 border-t-noya-blue" aria-hidden />
              ) : (
                <Paperclip size={20} strokeWidth={1.5} aria-hidden />
              )}
            </button>

            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              aria-label="Joindre un fichier à la conversation"
              onChange={handleFileChange}
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar"
            />

            <label htmlFor="client-chat-message" className="sr-only">
              Message à envoyer à l&apos;équipe Infinite
            </label>
            <textarea
              id="client-chat-message"
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={onTextareaKeyDown}
              rows={1}
              placeholder="Votre message…"
              className="max-h-36 min-h-11 flex-1 resize-none rounded-xl border border-white/10 bg-[#060910]/90 px-4 py-3 text-sm text-text-primary shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] placeholder:text-text-muted focus:border-luxe-champagne/35 focus:outline-none focus:ring-2 focus:ring-luxe-champagne/15"
            />

            <button
              type="submit"
              disabled={!text.trim() || sending || isUploading}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-noya-blue to-[#5a8fd4] text-white shadow-[0_6px_20px_-4px_rgba(110,167,234,0.45)] transition-all hover:brightness-110 disabled:opacity-35"
              aria-label="Envoyer"
            >
              {sending ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" aria-hidden />
              ) : (
                <Send size={20} strokeWidth={1.75} aria-hidden />
              )}
            </button>
          </form>
          <p className="mt-2 text-center text-[11px] text-text-muted">
            <span className="inline-flex items-center gap-1">
              Fichiers : images, PDF, Office, archives — taille raisonnable recommandée.
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
