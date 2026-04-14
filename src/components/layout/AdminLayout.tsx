import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  KanbanSquare,
  Briefcase,
  Users,
  Handshake,
  UserPlus,
  Wallet,
  Copy,
  FolderOpen,
  LogOut,
  Menu,
  X,
  Bell,
  MessageCircle,
  ChevronDown,
  Sun,
  Moon,
  ClipboardList,
  Mail,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';
import { db, auth } from '../../firebase';
import { signOut } from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';
import Logo from '../Logo';
import { notificationService, Notification } from '../../services/notificationService';
import { useAuth } from '../FirebaseProvider';
import WorkspaceSpaceSwitcher from '../WorkspaceSpaceSwitcher';
import { getAccessibleWorkspaces } from '../../lib/workspaceSpaces';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function AdminLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user, userData } = useAuth();

  const [unreadChats, setUnreadChats] = useState(0);

  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('theme') as 'dark' | 'light') || 'dark');

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  useEffect(() => {
    if (!user) return;
    const unsub = notificationService.subscribeToNotifications(user.uid, (data) => {
      setNotifications(data);
    });
    
    const unsubChats = onSnapshot(collection(db, 'chats'), (snap) => {
      const count = snap.docs.filter(doc => doc.data().unreadCommando === true).length;
      setUnreadChats(count);
    });

    return () => {
      unsub();
      unsubChats();
    };
  }, [user]);

  useEffect(() => {
    if (!showProfileMenu) return;
    const onPointerDown = (e: PointerEvent) => {
      const el = profileMenuRef.current;
      if (el && !el.contains(e.target as Node)) setShowProfileMenu(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [showProfileMenu]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleLogout = async () => {
    try {
      localStorage.removeItem('demoRole');
      await signOut(auth);
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (user) await notificationService.markAllAsRead(user.uid);
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) await notificationService.markAsRead(notification.id);
    if (notification.type === 'order') navigate('/admin/pipeline');
    if (notification.type === 'message') navigate('/admin/messagerie');
    if (notification.type === 'ticket') navigate('/admin/tickets');
    setShowNotifications(false);
  };

  const navItems = [
    { id: 'admin', to: '/admin', icon: LayoutDashboard, label: 'Tableau de bord' },
    { id: 'pipeline', to: '/admin/pipeline', icon: KanbanSquare, label: 'Pipeline Noya' },
    { id: 'audits-padde', to: '/admin/audits-padde', icon: ClipboardList, label: 'Audits PADDE-CI' },
    { id: 'clients', to: '/admin/clients', icon: Users, label: 'CRM Clients' },
    { id: 'partners', to: '/admin/partners', icon: Handshake, label: 'Partenaires' },
    { id: 'leads', to: '/admin/leads', icon: UserPlus, label: 'Leads partenaires' },
    { id: 'operations', to: '/admin/operations', icon: Briefcase, label: 'Opérations' },
    { id: 'finance', to: '/admin/finance', icon: Wallet, label: 'Finance' },
    { id: 'messagerie', to: '/admin/messagerie', icon: MessageCircle, label: 'Messagerie Clients' },
    { id: 'dossiers', to: '/admin/dossiers', icon: FolderOpen, label: 'Dossiers Clients' },
    { id: 'instances', to: '/admin/instances', icon: Copy, label: 'Clonage Instances' },
  ];

  const displayName = userData?.firstName
    ? `${userData.firstName} ${userData.lastName || ''}`.trim()
    : user?.displayName?.trim() || user?.email?.split('@')[0] || 'Commando';

  const staffRoleLabel =
    userData?.role === 'admin'
      ? 'Admin — accès Commando + autres espaces'
      : 'Commando — opérations & dossiers clients';

  const roleBadge =
    userData?.role === 'admin' ? 'Admin général' : userData?.role === 'commando' ? 'Commando' : 'Équipe';

  const workspaceLinksCount = getAccessibleWorkspaces(userData?.role).length;

  const initials =
    userData?.firstName && userData?.lastName
      ? `${userData.firstName[0]}${userData.lastName[0]}`.toUpperCase()
      : (userData?.firstName?.[0] || user?.email?.[0] || 'C').toUpperCase();

  const copyStaffEmail = async () => {
    if (!user?.email) return;
    try {
      await navigator.clipboard.writeText(user.email);
      setCopiedEmail(true);
      window.setTimeout(() => setCopiedEmail(false), 2000);
    } catch {
      /* navigateur sans accès presse-papiers */
    }
  };

  return (
    <div className="commando-space flex h-[100dvh] max-h-[100dvh] min-h-0 flex-col overflow-hidden md:flex-row font-sans text-text-primary antialiased">
      {/* Mobile Header */}
      <div className="commando-header-bar md:hidden text-text-primary px-3 py-2.5 min-h-[56px] flex items-center gap-3 justify-between z-50 relative">
        <Logo className="h-12 shrink-0" />
        <div className="flex min-w-0 flex-1 items-center justify-center gap-2.5 border-x border-white/[0.06] px-2">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-luxe-champagne/35 bg-gradient-to-br from-luxe-champagne/25 to-noya-blue/15 font-display text-[11px] font-semibold uppercase tracking-wider text-luxe-champagne-bright shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
            aria-hidden
          >
            {initials}
          </div>
          <div className="min-w-0 text-left">
            <p className="truncate font-display text-[13px] font-medium leading-tight tracking-tight text-text-primary">
              {displayName}
            </p>
            <p className="truncate text-[9px] font-semibold uppercase tracking-[0.16em] text-luxe-champagne/90">
              {roleBadge}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="shrink-0 p-2 rounded-xl transition-all text-luxe-champagne-bright/90 hover:bg-white/[0.06] hover:text-luxe-champagne-bright border border-white/[0.08]"
          aria-expanded={isMobileMenuOpen ? 'true' : 'false'}
          aria-label={isMobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={cn(
        "commando-sidebar-panel border-r border-luxe-champagne/15 text-text-primary w-64 sidebar-responsive shrink-0 flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] fixed md:relative z-50 h-full max-h-[100dvh] md:h-full md:max-h-none md:shadow-none",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="hidden border-b border-white/[0.05] px-2.5 py-2 md:block">
          <div className="flex items-center gap-2">
            <div className="shrink-0 border-r border-luxe-champagne/20 pr-2">
              <Logo className="h-7 w-auto" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-display text-[9px] font-medium uppercase leading-none tracking-[0.18em] text-luxe-champagne-bright/95">
                Infinite Commando
              </p>
              <p
                className="mt-0.5 truncate text-[8px] font-semibold uppercase leading-tight tracking-[0.12em] text-text-muted"
                title={staffRoleLabel}
              >
                {staffRoleLabel}
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/admin'}
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all duration-300 group border",
                isActive
                  ? "commando-nav-active text-luxe-champagne-bright"
                  : "border-transparent text-text-secondary hover:bg-white/[0.04] hover:text-text-primary hover:border-white/[0.06]"
              )}
            >
              <div className="relative shrink-0 opacity-90 group-hover:opacity-100">
                <item.icon size={20} strokeWidth={1.75} />
                {item.id === 'messagerie' && unreadChats > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-noya-red border-2 border-noya-sidebar shadow-[0_0_8px_rgba(225,91,100,0.6)]" />
                )}
              </div>
              <span className="font-medium text-[13px] leading-snug tracking-tight">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* « Tous les espaces » : menu profil sur desktop ; ici uniquement mobile (header profil masqué) */}
        <div className="mt-auto shrink-0 border-t border-white/[0.06] px-3 pb-4 pt-3 md:hidden">
          <WorkspaceSpaceSwitcher variant="surface" onNavigate={() => setIsMobileMenuOpen(false)} />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent">
        <header className="commando-header-bar px-6 md:px-8 py-3 hidden md:flex items-center justify-end gap-5 z-40 relative">
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowProfileMenu(false);
                setShowNotifications(!showNotifications);
              }}
              className={cn(
                "p-3 rounded-xl transition-all relative border",
                showNotifications
                  ? "text-luxe-champagne-bright bg-luxe-champagne/10 border-luxe-champagne/35 shadow-[0_0_24px_-8px_rgba(201,169,98,0.35)]"
                  : "text-text-muted hover:text-luxe-champagne-bright hover:bg-white/[0.05] border-white/[0.06] hover:border-luxe-champagne/25"
              )}
              aria-expanded={showNotifications ? 'true' : 'false'}
              aria-label="Notifications"
            >
              <Bell size={20} strokeWidth={1.75} />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-h-5 min-w-5 px-1 rounded-full bg-noya-red text-white text-[10px] font-bold flex items-center justify-center border-2 border-noya-sidebar shadow-lg">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-3 w-[min(100vw-2rem,24rem)] rounded-2xl z-50 animate-in fade-in zoom-in duration-200 border border-luxe-champagne/20 bg-noya-sidebar/95 backdrop-blur-xl shadow-[0_24px_64px_-24px_rgba(0,0,0,0.75),0_0_0_1px_rgba(228,212,165,0.08)_inset] overflow-hidden">
                <div className="px-5 py-4 border-b border-white/[0.06] flex justify-between items-center bg-gradient-to-r from-luxe-champagne/[0.06] to-transparent">
                  <h3 className="font-semibold text-[10px] uppercase tracking-[0.22em] text-luxe-champagne-bright/90">Fil d&apos;actualité</h3>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkAllAsRead}
                      className="text-[10px] text-luxe-champagne font-semibold uppercase tracking-widest hover:text-luxe-champagne-bright transition-colors"
                    >
                      Marquer tout lu
                    </button>
                  )}
                </div>
                <div className="max-h-96 overflow-y-auto custom-scrollbar">
                  {notifications.length === 0 ? (
                    <div className="px-5 py-14 text-center text-text-dim text-[10px] font-semibold uppercase tracking-[0.2em]">
                      Silence radio. Aucune alerte.
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleNotificationClick(n)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            void handleNotificationClick(n);
                          }
                        }}
                        className={cn(
                          'px-5 py-4 hover:bg-white/[0.04] cursor-pointer border-b border-white/[0.05] transition-all group/notif',
                          !n.read && 'bg-luxe-champagne/[0.06]'
                        )}
                      >
                        <p className={cn('text-xs font-semibold uppercase tracking-tight', !n.read ? 'text-text-primary' : 'text-text-muted')}>
                          {n.title}
                        </p>
                        <p className="text-xs text-text-secondary mt-1 font-medium leading-relaxed">{n.message}</p>
                        <p className="text-[9px] text-text-dim mt-2 font-semibold uppercase tracking-widest">
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: fr })}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              setShowProfileMenu(false);
              toggleTheme();
            }}
            className="p-3 text-text-muted hover:text-luxe-champagne-bright hover:bg-white/[0.05] rounded-xl border border-white/[0.06] hover:border-luxe-champagne/25 transition-all"
            aria-label={theme === 'dark' ? 'Passer en thème clair' : 'Passer en thème sombre'}
          >
            {theme === 'dark' ? <Sun size={20} strokeWidth={1.75} /> : <Moon size={20} strokeWidth={1.75} />}
          </button>

          <div className="relative pl-5 md:pl-6 border-l border-white/[0.08]" ref={profileMenuRef}>
            <button
              type="button"
              onClick={() => {
                setShowNotifications(false);
                setShowProfileMenu((open) => !open);
              }}
              className={cn(
                'group flex max-w-[min(100vw-12rem,18rem)] items-center gap-3 rounded-2xl border px-2.5 py-2 text-left transition-all duration-300 md:max-w-[20rem]',
                showProfileMenu
                  ? 'border-luxe-champagne/45 bg-luxe-champagne/[0.1] shadow-[0_0_28px_-10px_rgba(201,169,98,0.35)]'
                  : 'border-white/[0.08] bg-black/[0.14] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:border-luxe-champagne/32 hover:bg-luxe-champagne/[0.06]'
              )}
              aria-expanded={showProfileMenu ? 'true' : 'false'}
              aria-haspopup="menu"
              aria-label="Profil et compte"
            >
              <div className="relative shrink-0">
                <div
                  className="absolute -inset-0.5 rounded-xl bg-gradient-to-br from-luxe-champagne/50 via-noya-blue/25 to-transparent opacity-80 blur-[1px] transition-opacity group-hover:opacity-100"
                  aria-hidden
                />
                <div className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-luxe-champagne/40 bg-gradient-to-br from-luxe-champagne/28 via-noya-sidebar to-noya-blue/15 font-display text-[12px] font-semibold uppercase tracking-[0.12em] text-luxe-champagne-bright shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
                  {initials}
                </div>
              </div>
              <div className="min-w-0 flex-1 py-0.5">
                <span className="block font-display text-[0.8125rem] font-medium leading-snug tracking-tight text-text-primary md:text-[0.9375rem]">
                  {displayName}
                </span>
                <span className="mt-1 block text-[9px] font-semibold uppercase tracking-[0.2em] text-luxe-champagne/95">
                  {roleBadge}
                  <span className="mx-1.5 text-text-dim/80">·</span>
                  <span className="text-text-muted normal-case tracking-normal">Infinite Commando</span>
                </span>
              </div>
              <ChevronDown
                size={16}
                strokeWidth={2}
                className={cn(
                  'shrink-0 text-text-muted transition-transform duration-300 group-hover:text-luxe-champagne-bright/90',
                  showProfileMenu && 'rotate-180 text-luxe-champagne-bright'
                )}
                aria-hidden
              />
            </button>

            {showProfileMenu && (
              <div
                className="absolute right-0 top-full z-50 mt-3 w-[min(calc(100vw-2rem),18.5rem)] overflow-hidden rounded-2xl border border-luxe-champagne/22 bg-noya-sidebar/95 shadow-[0_28px_64px_-28px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(228,212,165,0.1)] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200"
                role="menu"
              >
                <div className="border-b border-white/[0.06] bg-gradient-to-r from-luxe-champagne/[0.08] via-transparent to-noya-blue/[0.06] px-4 py-3.5">
                  <p className="font-display text-lg font-normal tracking-tight text-text-primary">{displayName}</p>
                  <p className="mt-1 text-[10px] font-medium leading-relaxed text-text-secondary">{staffRoleLabel}</p>
                </div>

                {user?.email ? (
                  <div className="border-b border-white/[0.05] px-4 py-3">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-text-dim">Compte</p>
                    <div className="mt-2 flex items-start gap-2 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5">
                      <Mail size={14} className="mt-0.5 shrink-0 text-luxe-champagne/80" aria-hidden />
                      <span className="min-w-0 flex-1 break-all text-xs text-text-secondary">{user.email}</span>
                    </div>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => void copyStaffEmail()}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-white/[0.08] py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-secondary transition-colors hover:border-luxe-champagne/30 hover:bg-luxe-champagne/[0.06] hover:text-luxe-champagne-bright"
                    >
                      <Copy size={13} strokeWidth={2} aria-hidden />
                      {copiedEmail ? 'Copié' : 'Copier l’e-mail'}
                    </button>
                  </div>
                ) : null}

                {workspaceLinksCount > 0 ? (
                  <div className="border-t border-white/[0.06]">
                    <div className="max-h-48 overflow-y-auto custom-scrollbar">
                      <WorkspaceSpaceSwitcher
                        variant="profile"
                        onNavigate={() => {
                          setShowProfileMenu(false);
                          setIsMobileMenuOpen(false);
                        }}
                      />
                    </div>
                  </div>
                ) : null}

                <div className="p-2">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setShowProfileMenu(false);
                      navigate('/admin');
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-text-secondary transition-colors hover:bg-white/[0.05] hover:text-text-primary"
                  >
                    <LayoutDashboard size={18} strokeWidth={1.75} className="text-luxe-champagne/80" aria-hidden />
                    Tableau de bord
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setShowProfileMenu(false);
                      void handleLogout();
                    }}
                    className="mt-0.5 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-noya-red/90 transition-colors hover:bg-noya-red/10 hover:text-noya-red"
                  >
                    <LogOut size={18} strokeWidth={1.75} aria-hidden />
                    Déconnexion
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        <div className="commando-main-well min-h-0 flex-1 overflow-y-scroll custom-scrollbar">
          <Outlet />
        </div>
      </main>

      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
          onKeyDown={(e) => e.key === 'Escape' && setIsMobileMenuOpen(false)}
          role="presentation"
          aria-hidden
        />
      )}
    </div>
  );
}
