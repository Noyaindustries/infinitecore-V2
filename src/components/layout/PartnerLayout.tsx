import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, DollarSign, FolderOpen, User, LogOut, Menu, X, Bell, ChevronDown, Sun, Moon, Mail, Copy, UserPlus } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { cn } from '../../lib/utils';
import { userInitialLetter } from '../../lib/userProfile';
import { auth } from '@/lib/clientSdk';
import { signOut } from '@/lib/mongoAuth';
import Logo from '../Logo';
import { notificationService, Notification } from '../../services/notificationService';
import { useAuth } from '../AuthProvider';
import WorkspaceSpaceSwitcher from '../WorkspaceSpaceSwitcher';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function PartnerLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user, userData } = useAuth();
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
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!showProfileMenu) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (profileMenuRef.current && !profileMenuRef.current.contains(target)) {
        setShowProfileMenu(false);
      }
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
    if (notification.type === 'order' || notification.type === 'mission') navigate('/partenaire/clients');
    setShowNotifications(false);
  };

  const copyEmail = async () => {
    if (!user?.email) return;
    try {
      await navigator.clipboard.writeText(user.email);
      setCopiedEmail(true);
      window.setTimeout(() => setCopiedEmail(false), 2000);
    } catch {
      // navigateur sans accès presse-papiers
    }
  };

  const displayName = userData?.firstName
    ? `${userData.firstName} ${userData.lastName || ''}`.trim()
    : 'Partenaire';

  const navItems = [
    { to: '/partenaire', icon: LayoutDashboard, label: 'Tableau de bord' },
    { to: '/partenaire/clients', icon: Users, label: 'Mes contacts' },
    { to: '/partenaire/filleuls', icon: UserPlus, label: 'Clients parrainés' },
    { to: '/partenaire/commissions', icon: DollarSign, label: 'Commissions' },
    { to: '/partenaire/ressources', icon: FolderOpen, label: 'Ressources' },
    { to: '/partenaire/profil', icon: User, label: 'Mon profil' },
  ];

  return (
    <div className="min-h-screen bg-noya-black flex flex-col md:flex-row font-sans text-text-primary">
      {/* Mobile Header */}
      <div className="md:hidden bg-black border-b border-white/5 text-[#F2F4F8] px-4 py-3 min-h-[60px] flex justify-between items-center z-50 relative">
        <Logo lightText className="h-12 md:h-[5rem]" />
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={cn(
        "bg-black border-r border-white/5 text-text-primary w-64 sidebar-responsive flex-shrink-0 flex-col transition-transform duration-300 ease-in-out fixed z-50 md:relative md:h-full",
        "top-[60px] h-[calc(100dvh-60px)] md:top-auto",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="p-6 hidden md:block">
          <div className="mb-2">
            <Logo lightText className="h-12 md:h-[5rem]" />
          </div>
          <div className="text-xs text-text-secondary font-mono tracking-widest flex items-center gap-2 mt-2">
            <span className="w-2 h-2 rounded-full bg-noya-green shadow-[0_0_8px_rgba(43,198,115,0.8)] animate-pulse"></span>
            Infinite Partenaire
          </div>
          <p className="mt-2 text-[11px] text-text-muted/80">
            Programme partenaire Infinite
          </p>
        </div>

        <nav className="custom-scrollbar flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/partenaire'}
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300",
                isActive
                  ? "bg-noya-green/10 text-noya-green border border-noya-green/20 shadow-[0_0_15px_rgba(43,198,115,0.1)] font-medium"
                  : "text-text-secondary hover:bg-white/5 hover:text-text-primary"
              )}
            >
              <item.icon size={20} />
              <span className="font-medium text-sm">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="px-4 pb-1 shrink-0">
          <WorkspaceSpaceSwitcher variant="noya-dark" onNavigate={() => setIsMobileMenuOpen(false)} />
        </div>

      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-0 md:min-h-screen overflow-hidden bg-noya-black text-text-primary">
        {/* Top bar */}
        <header className="bg-black border-b border-white/5 px-6 py-3 hidden md:flex items-center justify-end gap-4 z-40 relative">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 text-text-secondary hover:text-text-primary hover:bg-white/5 rounded-full transition-colors"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          {/* Notification bell */}
          <div className="relative">
            <button
              onClick={() => {
                setShowProfileMenu(false);
                setShowNotifications((open) => !open);
              }}
              className="p-2 text-text-secondary hover:text-text-primary hover:bg-white/5 rounded-full transition-colors relative"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-[#E15B64] text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-black rounded-2xl shadow-xl border border-white/10 py-2 z-50">
                <div className="px-4 py-2 border-b border-white/5 flex justify-between items-center">
                  <h3 className="font-bold text-[#F2F4F8] text-sm">Notifications</h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllAsRead}
                      className="text-xs text-[#2BC673] font-medium hover:underline"
                    >
                      Tout lire
                    </button>
                  )}
                </div>
                <div className="custom-scrollbar max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center text-[#8D98AA] text-sm">
                      Aucune notification
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={cn(
                          'px-4 py-3 hover:bg-white/5 cursor-pointer border-b border-white/5 transition-colors',
                          !n.read && 'bg-[#2BC673]/5'
                        )}
                      >
                        <p className={cn('text-sm font-medium', !n.read ? 'text-[#F2F4F8]' : 'text-[#8D98AA]')}>
                          {n.title}
                        </p>
                        <p className="text-xs text-[#8D98AA]/80 mt-0.5">{n.message}</p>
                        <p className="text-[10px] text-[#8D98AA]/50 mt-1">
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: fr })}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="relative" ref={profileMenuRef}>
            <button
              type="button"
              onClick={() => {
                setShowNotifications(false);
                setShowProfileMenu((open) => !open);
              }}
              className={cn(
                "flex items-center gap-2 pl-4 border-l border-white/10 rounded-xl py-1.5 pr-2 transition-colors",
                showProfileMenu ? "bg-white/10" : "hover:bg-white/5"
              )}
              aria-haspopup="menu"
              aria-label="Profil partenaire"
            >
              <div className="w-8 h-8 bg-[#2BC673]/20 border border-[#2BC673]/30 rounded-full overflow-hidden flex items-center justify-center text-[#2BC673] font-bold text-xs">
                {userData?.photoURL ? (
                  <img src={userData.photoURL as string} alt={displayName} className="h-full w-full object-cover" />
                ) : (
                  userInitialLetter(userData, "P", user?.email)
                )}
              </div>
              <span className="text-sm font-medium text-[#F2F4F8]">{displayName}</span>
              <ChevronDown
                size={14}
                className={cn("text-[#8D98AA] transition-transform", showProfileMenu && "rotate-180")}
              />
            </button>

            {showProfileMenu && (
              <div
                className="absolute right-0 top-full mt-2 w-72 bg-black rounded-2xl shadow-xl border border-white/10 py-2 z-50 overflow-hidden"
                role="menu"
              >
                <div className="px-4 py-3 border-b border-white/10">
                  <p className="text-sm font-semibold text-[#F2F4F8]">{displayName}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.18em] text-[#2BC673]">Partenaire</p>
                </div>

                {user?.email ? (
                  <div className="px-4 py-3 border-b border-white/10">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-[#8D98AA]">Compte</p>
                    <div className="mt-2 flex items-start gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2">
                      <Mail size={14} className="mt-0.5 shrink-0 text-[#2BC673]" />
                      <span className="min-w-0 flex-1 break-all text-xs text-[#C8D0E0]">{user.email}</span>
                    </div>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => void copyEmail()}
                      className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#C8D0E0] transition-colors hover:border-[#2BC673]/40 hover:bg-[#2BC673]/10 hover:text-[#F2F4F8]"
                    >
                      <Copy size={13} />
                      {copiedEmail ? 'Copié' : 'Copier l’e-mail'}
                    </button>
                  </div>
                ) : null}

                <div className="border-b border-white/10 px-2 py-2">
                  <WorkspaceSpaceSwitcher
                    variant="noya-dark"
                    onNavigate={() => {
                      setShowProfileMenu(false);
                      setIsMobileMenuOpen(false);
                    }}
                  />
                </div>

                <div className="p-2">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setShowProfileMenu(false);
                      void handleLogout();
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-[#E15B64] transition-colors hover:bg-[#E15B64]/10"
                  >
                    <LogOut size={16} />
                    Déconnexion
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setShowProfileMenu(false);
                      navigate('/partenaire/profil');
                    }}
                    className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-[#C8D0E0] transition-colors hover:bg-white/5 hover:text-[#F2F4F8]"
                  >
                    <User size={16} />
                    Mon profil
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-scroll p-4 md:p-8">
          <Outlet />
        </div>
      </main>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}
