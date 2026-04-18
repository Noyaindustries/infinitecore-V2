import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, MessageCircle, ShoppingCart, FolderCheck, LogOut, Menu, X, User, Bell, Sun, Moon } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { db, auth } from '@/lib/clientSdk';
import { signOut } from '@/lib/mongoAuth';
import { collection, onSnapshot, query, where } from '@/lib/mongoFirestore';
import Logo from '../Logo';
import { notificationService, Notification } from '../../services/notificationService';
import { useAuth } from '../AuthProvider';
import WorkspaceSpaceSwitcher from '../WorkspaceSpaceSwitcher';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const CLIENT_PAGE_TITLES: { match: (path: string) => boolean; title: string }[] = [
  { match: (p) => p === '/dashboard' || p === '/dashboard/', title: 'Mon espace' },
  { match: (p) => p.startsWith('/dashboard/suivi'), title: 'Mon dossier' },
  { match: (p) => p.startsWith('/dashboard/messagerie'), title: 'Messagerie' },
  { match: (p) => p.startsWith('/dashboard/boutique'), title: 'Boutique & services' },
  { match: (p) => p.startsWith('/dashboard/profil'), title: 'Mon profil' },
];

export default function ClientLayout() {
  const location = useLocation();
  const pageTitle =
    CLIENT_PAGE_TITLES.find((e) => e.match(location.pathname))?.title ?? 'Espace client';
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { user } = useAuth();
  const navigate = useNavigate();
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

  const [unreadChats, setUnreadChats] = useState(0);

  useEffect(() => {
    if (user) {
      const unsubscribe = notificationService.subscribeToNotifications(user.uid, (data) => {
        setNotifications(data);
      });
      
      const unsubChats = onSnapshot(query(collection(db, 'chats'), where('clientId', '==', user.uid)), (snap) => {
        const count = snap.docs.filter(doc => doc.data().unreadClient === true).length;
        setUnreadChats(count);
      });

      return () => {
        unsubscribe();
        unsubChats();
      };
    }
  }, [user]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleLogout = async () => {
    try {
      localStorage.removeItem('demoRole');
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (user) {
      await notificationService.markAllAsRead(user.uid);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      await notificationService.markAsRead(notification.id);
    }
    if (notification.type === 'mission') {
      navigate('/dashboard/suivi');
    }
    setShowNotifications(false);
  };

  const navItems = [
    { id: 'dashboard', to: '/dashboard', icon: LayoutDashboard, label: 'Mon Espace' },
    { id: 'dossier', to: '/dashboard/suivi', icon: FolderCheck, label: 'Mon Dossier' },
    { id: 'messagerie', to: '/dashboard/messagerie', icon: MessageCircle, label: 'Messagerie' },
    { id: 'boutique', to: '/dashboard/boutique', icon: ShoppingCart, label: 'Boutique & Services' },
    { id: 'profil', to: '/dashboard/profil', icon: User, label: 'Mon Profil' },
  ];

  return (
    <div className="client-portal flex min-h-screen flex-col font-sans text-text-primary antialiased md:flex-row">
      {/* Mobile Header */}
      <div className="relative z-50 flex min-h-[92px] items-center justify-between border-b border-white/[0.06] bg-black px-4 py-3 text-text-primary sm:min-h-[108px] md:hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-luxe-champagne/35 to-transparent" aria-hidden />
        <Logo lightText={theme === 'dark'} className="h-20 sm:h-24 md:h-[6rem]" />
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="rounded-xl p-2 text-text-secondary transition-colors hover:bg-white/5 hover:text-text-primary"
          aria-label={isMobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
        >
          {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={cn(
          'sidebar-responsive fixed z-50 flex w-64 shrink-0 flex-col border-r border-white/[0.06] bg-black text-text-primary transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]',
          'top-[92px] h-[calc(100dvh-92px)] sm:top-[108px] sm:h-[calc(100dvh-108px)] md:relative md:top-auto md:h-full md:translate-x-0',
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-linear-to-b from-luxe-champagne/25 via-luxe-champagne/10 to-transparent" aria-hidden />
        <div className="hidden p-6 md:block">
          <div className="mb-3">
            <Logo lightText className="h-20 md:h-[6rem]" />
          </div>
          <div className="h-px w-full bg-linear-to-r from-transparent via-luxe-champagne/30 to-transparent" aria-hidden />
          <div className="mt-4 flex items-center gap-2.5 font-mono text-[10px] font-medium uppercase tracking-[0.24em] text-luxe-champagne/90">
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-luxe-champagne shadow-[0_0_12px_rgba(201,169,98,0.65)]"
              aria-hidden
            />
            Espace client
          </div>
        </div>

        <nav className="flex-1 space-y-1.5 px-3 py-4 md:px-4 md:py-6">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) =>
                cn(
                  'group relative flex items-center gap-3 rounded-xl px-4 py-3 text-[13px] transition-all duration-300',
                  isActive
                    ? 'border-y border-r border-transparent border-l-2 border-l-luxe-champagne bg-linear-to-r from-luxe-champagne/[0.14] to-transparent pl-[14px] font-semibold text-luxe-champagne-bright shadow-[0_0_32px_-10px_rgba(201,169,98,0.4),inset_0_1px_0_0_rgba(255,255,255,0.05)]'
                    : 'border border-transparent text-text-secondary hover:border-white/5 hover:bg-white/[0.04] hover:text-text-primary',
                )
              }
            >
              <div className="relative">
                <item.icon size={20} className="shrink-0 opacity-90 group-hover:opacity-100" strokeWidth={1.75} />
                {item.id === 'messagerie' && unreadChats > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-black bg-noya-red shadow-[0_0_8px_rgba(225,91,100,0.6)]" />
                )}
              </div>
              <span className="tracking-wide">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="shrink-0 px-3 pb-1 md:px-4">
          <WorkspaceSpaceSwitcher variant="noya-dark" onNavigate={() => setIsMobileMenuOpen(false)} />
        </div>

        <div className="mt-auto p-3 md:p-4">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-text-muted transition-colors hover:bg-white/[0.04] hover:text-noya-red"
          >
            <LogOut size={20} strokeWidth={1.5} />
            <span className="font-medium tracking-wide">Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex h-screen flex-1 flex-col overflow-hidden bg-black/5 md:bg-black/10">
        {/* Desktop Header */}
        <header className="sticky top-0 z-40 hidden border-b border-white/[0.06] bg-black shadow-[0_12px_40px_-24px_rgba(0,0,0,0.8)] md:block">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-luxe-champagne/25 to-transparent" aria-hidden />
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-luxe-champagne/80">
                Portail privé
              </p>
              <h1 className="font-display text-2xl font-medium tracking-[0.01em] text-text-primary md:text-[1.75rem]">
                {pageTitle}
              </h1>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              {/* Notifications */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative rounded-full p-2.5 text-text-secondary transition-colors hover:bg-white/[0.06] hover:text-text-primary"
                  aria-haspopup="true"
                  aria-label="Notifications"
                >
                  <Bell size={20} strokeWidth={1.5} />
                  {unreadCount > 0 && (
                    <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-noya-red text-[10px] font-bold text-white shadow-[0_0_10px_rgba(225,91,100,0.5)]">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute right-0 z-50 mt-3 w-80 overflow-hidden rounded-2xl border border-white/10 bg-black py-2 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.65),0_0_0_1px_rgba(201,169,98,0.12)]">
                    <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
                      <h3 className="font-display text-lg font-medium text-text-primary">Notifications</h3>
                      <button
                        type="button"
                        onClick={handleMarkAllAsRead}
                        className="cursor-pointer text-xs font-medium text-noya-blue hover:underline"
                      >
                        Tout marquer comme lu
                      </button>
                    </div>
                    <div className="custom-scrollbar max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-10 text-center text-sm text-text-muted">Aucune notification</div>
                      ) : (
                        notifications.map((notification) => (
                          <div
                            key={notification.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => handleNotificationClick(notification)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                void handleNotificationClick(notification);
                              }
                            }}
                            className={cn(
                              'cursor-pointer border-b border-white/[0.05] px-4 py-3 transition-colors last:border-0 hover:bg-white/[0.04]',
                              !notification.read && 'bg-noya-blue/[0.06]',
                            )}
                          >
                            <p
                              className={cn(
                                'text-sm font-medium',
                                !notification.read ? 'text-text-primary' : 'text-text-secondary',
                              )}
                            >
                              {notification.title}
                            </p>
                            <p className="mt-1 text-xs text-text-muted">{notification.message}</p>
                            <p className="mt-1.5 text-[10px] text-text-dim">
                              {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: fr })}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Theme Toggle */}
              <button
                type="button"
                onClick={toggleTheme}
                className="flex items-center justify-center rounded-full p-2.5 text-text-secondary transition-colors hover:bg-white/[0.06] hover:text-text-primary"
                title={theme === 'dark' ? 'Passer au mode clair' : 'Passer au mode sombre'}
                aria-label={theme === 'dark' ? 'Passer au mode clair' : 'Passer au mode sombre'}
              >
                {theme === 'dark' ? <Sun size={20} strokeWidth={1.5} /> : <Moon size={20} strokeWidth={1.5} />}
              </button>

              <div className="flex items-center gap-3 border-l border-white/10 pl-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-luxe-champagne/30 bg-linear-to-br from-luxe-champagne/20 to-noya-blue/10 text-xs font-bold uppercase tracking-wide text-luxe-champagne-bright shadow-[0_0_20px_-6px_rgba(201,169,98,0.4)]">
                  {user?.email?.substring(0, 2) || 'CL'}
                </div>
                <span className="hidden max-w-[200px] truncate text-sm font-medium text-text-primary lg:max-w-xs lg:inline">
                  {user?.email}
                </span>
              </div>
            </div>
          </div>
        </header>

        <div className="custom-scrollbar flex h-full flex-1 flex-col overflow-y-scroll p-4 md:p-8 lg:p-10">
          <Outlet />
        </div>
      </main>
      
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}
