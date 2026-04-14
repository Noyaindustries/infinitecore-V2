import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Code2, Wallet, LogOut, Menu, X, Bell, User, Upload, BookOpen, Sun, Moon, ChevronDown, Mail, Copy } from 'lucide-react';
import { auth } from '../../firebase';
import { signOut } from 'firebase/auth';
import Logo from '../Logo';
import { notificationService, Notification } from '../../services/notificationService';
import { useAuth } from '../FirebaseProvider';
import WorkspaceSpaceSwitcher from '../WorkspaceSpaceSwitcher';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '../../lib/utils';
import { userInitialLetter } from '../../lib/userProfile';
import { useRef } from 'react';

export default function DeveloperLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => (localStorage.getItem('theme') as 'dark' | 'light') || 'dark');
  const location = useLocation();
  const navigate = useNavigate();
  const { user, userData } = useAuth();

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
    if (notification.type === 'mission') navigate('/developer/missions');
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

  const navigation = [
    { name: 'Tableau de bord', href: '/developer', icon: LayoutDashboard },
    { name: 'Missions', href: '/developer/missions', icon: Code2 },
    { name: 'Soumettre un livrable', href: '/developer/livrables', icon: Upload },
    { name: 'Commissions', href: '/developer/commissions', icon: Wallet },
    { name: 'Ressources Dev', href: '/developer/ressources', icon: BookOpen },
    { name: 'Mon profil', href: '/developer/profil', icon: User },
  ];

  const displayName = userData?.firstName
    ? `${userData.firstName} ${userData.lastName || ''}`.trim()
    : 'Développeur';

  return (
    <div className="min-h-screen bg-surface-primary flex font-sans text-text-primary">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 sidebar-responsive bg-surface-secondary border-r border-border-subtle text-text-primary transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:block transition-transform duration-300 ease-in-out shadow-2xl lg:shadow-none`}>
        <div className="h-full flex flex-col">
          <div className="h-[4.75rem] md:h-20 flex items-center px-6 border-b border-border-subtle bg-surface-secondary">
            <Logo lightText={theme === 'dark'} className="h-13 md:h-14" />
            <button
              onClick={() => setSidebarOpen(false)}
              className="ml-auto lg:hidden text-text-secondary hover:text-text-primary p-2"
              aria-label="Fermer le menu"
            >
              <X size={20} />
            </button>
          </div>
          <nav className="flex-1 py-6 px-4 space-y-2">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href || (item.href !== '/developer' && location.pathname.startsWith(item.href));
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center px-4 py-3 rounded-xl transition-all duration-300 ${isActive ? 'bg-noya-blue/10 text-noya-blue border border-noya-blue/20 shadow-[0_0_15px_rgba(110,167,234,0.1)] font-black uppercase tracking-widest text-[10px]' : 'text-text-muted hover:bg-surface-tertiary hover:text-text-primary text-sm font-medium'}`}
                >
                  <Icon size={18} className={`mr-3 flex-shrink-0 ${isActive ? 'text-noya-blue' : 'text-text-dim'}`} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
          <div className="px-2 pb-2 shrink-0">
            <WorkspaceSpaceSwitcher variant="surface" className="border-t-0 pt-3 mt-0" onNavigate={() => setSidebarOpen(false)} />
          </div>
          <div className="p-4 border-t border-border-subtle bg-surface-primary/30">
            <button onClick={handleLogout} className="w-full flex items-center px-4 py-3 text-text-muted hover:text-noya-red hover:bg-noya-red/5 rounded-xl transition-all group font-bold text-sm">
              <LogOut size={18} className="mr-3 group-hover:-translate-x-1 transition-transform" />
              Déconnexion
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-surface-primary">
        <header className="h-16 bg-surface-secondary border-b border-border-subtle flex items-center justify-between px-6 lg:px-10 z-40 relative shadow-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-text-secondary hover:text-text-primary p-2"
            aria-label="Ouvrir le menu"
          >
            <Menu size={24} />
          </button>
          
          <div className="flex items-center gap-6 ml-auto">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2.5 text-text-muted hover:text-text-primary hover:bg-surface-tertiary rounded-xl transition-all shadow-sm border border-border-subtle bg-surface-primary"
              title={theme === 'light' ? 'Nox Mode' : 'Lux Mode'}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} /> }
            </button>
            {/* Notification bell */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowProfileMenu(false);
                  setShowNotifications((open) => !open);
                }}
                className="text-text-muted hover:text-text-primary relative p-2.5 rounded-xl hover:bg-surface-tertiary transition-all shadow-sm border border-border-subtle bg-surface-primary"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-noya-orange text-white text-[10px] font-black flex items-center justify-center border-2 border-surface-secondary shadow-lg">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-3 w-80 bg-surface-secondary rounded-2xl shadow-2xl border border-border-medium py-3 z-50 overflow-hidden">
                  <div className="px-5 py-3 border-b border-border-subtle flex justify-between items-center bg-surface-primary/50">
                    <h3 className="font-black text-text-primary text-[10px] uppercase tracking-widest">Registre</h3>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllAsRead}
                        className="text-[10px] text-noya-blue font-black uppercase tracking-widest hover:underline"
                      >
                        Clean logs
                      </button>
                    )}
                  </div>
                  <div className="custom-scrollbar max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-6 py-12 text-center text-text-dim text-xs font-medium italic">
                        Aucun signal entrant indexé.
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          onClick={() => handleNotificationClick(n)}
                          className={cn(
                            'px-5 py-4 hover:bg-surface-tertiary cursor-pointer border-b border-border-subtle transition-all group/notif',
                            !n.read && 'bg-noya-blue/5'
                          )}
                        >
                          <p className={cn('text-xs font-black uppercase tracking-tight', !n.read ? 'text-text-primary' : 'text-text-muted')}>
                            {n.title}
                          </p>
                          <p className="text-xs text-text-muted/80 mt-1 leading-relaxed font-medium">{n.message}</p>
                          <p className="text-[10px] text-text-dim mt-2 font-mono uppercase">
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
                  "flex items-center gap-4 rounded-xl py-1.5 pl-6 pr-2 border-l border-border-subtle transition-colors",
                  showProfileMenu ? "bg-surface-tertiary" : "hover:bg-surface-tertiary/70"
                )}
                aria-haspopup="menu"
                aria-label="Profil développeur"
              >
                <div className="w-10 h-10 rounded-xl bg-noya-blue/10 border border-noya-blue/20 flex items-center justify-center text-noya-blue font-black text-xs shadow-inner">
                  {userInitialLetter(userData, "D", user?.email)}
                </div>
                <div className="hidden sm:block text-left">
                  <span className="text-xs font-black text-text-primary uppercase tracking-tight block leading-none">{displayName}</span>
                  <span className="text-[8px] font-black text-noya-blue uppercase tracking-widest mt-1 block opacity-70">Core Dev</span>
                </div>
                <ChevronDown size={14} className={cn("text-text-dim transition-transform", showProfileMenu && "rotate-180")} />
              </button>

              {showProfileMenu && (
                <div
                  className="absolute right-0 top-full mt-3 w-80 bg-surface-secondary rounded-2xl shadow-2xl border border-border-medium py-2 z-50 overflow-hidden"
                  role="menu"
                >
                  <div className="px-4 py-3 border-b border-border-subtle bg-surface-primary/60">
                    <p className="text-sm font-semibold text-text-primary">{displayName}</p>
                    <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-noya-blue">Développeur</p>
                  </div>

                  {user?.email ? (
                    <div className="px-4 py-3 border-b border-border-subtle">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-dim">Compte</p>
                      <div className="mt-2 flex items-start gap-2 rounded-xl border border-border-subtle bg-surface-primary px-3 py-2">
                        <Mail size={14} className="mt-0.5 shrink-0 text-noya-blue" />
                        <span className="min-w-0 flex-1 break-all text-xs text-text-secondary">{user.email}</span>
                      </div>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => void copyEmail()}
                        className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-border-subtle py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-text-secondary transition-colors hover:border-noya-blue/40 hover:bg-noya-blue/10 hover:text-text-primary"
                      >
                        <Copy size={13} />
                        {copiedEmail ? 'Copié' : 'Copier l’e-mail'}
                      </button>
                    </div>
                  ) : null}

                  <div className="border-b border-border-subtle px-2 py-2">
                    <WorkspaceSpaceSwitcher
                      variant="surface"
                      className="border-t-0 pt-0 mt-0"
                      onNavigate={() => {
                        setShowProfileMenu(false);
                        setSidebarOpen(false);
                      }}
                    />
                  </div>

                  <div className="p-2">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setShowProfileMenu(false);
                        navigate('/developer/profil');
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-text-secondary transition-colors hover:bg-surface-tertiary hover:text-text-primary"
                    >
                      <User size={16} />
                      Mon profil
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setShowProfileMenu(false);
                        void handleLogout();
                      }}
                      className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-noya-red transition-colors hover:bg-noya-red/10"
                    >
                      <LogOut size={16} />
                      Déconnexion
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-scroll p-4 lg:p-10 custom-scrollbar">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
