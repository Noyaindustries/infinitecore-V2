import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard,
  Users,
  CreditCard,
  Handshake,
  Settings,
  Activity,
  ShieldAlert,
  Code,
  LogOut,
  Menu,
  X,
  Box,
  Search,
  Bell,
  ChevronDown,
  ClipboardList,
  Sun,
  Moon,
  User,
  Mail,
  Copy
} from 'lucide-react';
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

export default function SuperAdminLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const { user, userData } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (user) {
      const unsubscribe = notificationService.subscribeToNotifications(user.uid, (data) => {
        setNotifications(data);
      });
      return () => unsubscribe();
    }
  }, [user]);

  const unreadCount = notifications.filter(n => !n.read).length;

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
    if (user) {
      await notificationService.markAllAsRead(user.uid);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      await notificationService.markAsRead(notification.id);
    }
    // Optional: navigate based on notification type
    if (notification.type === 'order') navigate('/superadmin/orders');
    if (notification.type === 'mission') navigate('/superadmin/missions');
    setShowNotifications(false);
  };

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

  const navItems = [
    { to: '/superadmin', icon: LayoutDashboard, label: 'Tableau de bord' },
    { to: '/superadmin/users', icon: Users, label: 'Utilisateurs' },
    { to: '/superadmin/orders', icon: CreditCard, label: 'Commandes & Paiements' },
    { to: '/superadmin/audits-padde', icon: ClipboardList, label: 'Audits PADDE-CI' },
    { to: '/superadmin/partners', icon: Handshake, label: 'Partenaires' },
    { to: '/superadmin/commando', icon: ShieldAlert, label: 'Equipe Commando — /admin' },
    { to: '/superadmin/developers', icon: Code, label: 'Equipe Développeurs — /developer' },
    { to: '/superadmin/missions', icon: Box, label: 'Missions Développeurs' },
    { to: '/superadmin/supervision', icon: Activity, label: 'Supervision' },
    { to: '/superadmin/settings', icon: Settings, label: 'Configuration' },
  ];

  const displayName = userData?.firstName
    ? `${userData.firstName} ${userData.lastName || ''}`.trim()
    : user?.email?.split('@')[0] || 'Super Admin';

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/superadmin': return 'Tableau de bord global';
      case '/superadmin/users': return 'Gestion des Utilisateurs';
      case '/superadmin/orders': return 'Commandes & Paiements';
      case '/superadmin/partners': return 'Gestion des Partenaires';
      case '/superadmin/commando': return 'Équipe Commando — /admin';
      case '/superadmin/developers': return 'Équipe Développeurs — /developer';
      case '/superadmin/supervision': return 'Supervision Système';
      case '/superadmin/settings': return 'Configuration Globale';
      case '/superadmin/audits-padde': return 'Audits PADDE-CI';
      case '/superadmin/missions': return 'Missions Développeurs';
      default: return 'Espace Super Admin — /superadmin';
    }
  };

  return (
    <div className="min-h-screen bg-surface-primary flex flex-col md:flex-row font-sans text-text-primary">
      {/* Mobile Header */}
      <div className="md:hidden bg-surface-secondary border-b border-border-subtle text-text-primary px-4 py-3 min-h-[60px] flex justify-between items-center z-50 relative shadow-lg">
        <Logo lightText={theme === 'dark'} className="h-14" />
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 transition-all hover:bg-white/10 rounded-lg">
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={cn(
        "bg-surface-secondary border-r border-border-subtle text-text-primary w-64 sidebar-responsive flex-shrink-0 flex-col transition-transform duration-300 ease-in-out fixed z-50 md:relative md:h-full",
        "top-[60px] h-[calc(100dvh-60px)] md:top-auto",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="p-6 hidden md:block">
          <div className="mb-2">
            <Logo lightText={theme === 'dark'} className="h-14 md:h-16" />
          </div>
          <div className="text-xs text-text-secondary font-mono tracking-widest flex items-center gap-2 mt-2">
            <span className="w-2 h-2 rounded-full bg-noya-red shadow-[0_0_8px_rgba(225,91,100,0.8)] animate-pulse"></span>
            Super Admin
          </div>
        </div>

        <nav className="custom-scrollbar flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/superadmin'}
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300",
                isActive 
                  ? "bg-noya-orange/10 text-noya-orange border border-noya-orange/20 shadow-[0_0_15px_rgba(255,179,50,0.1)]" 
                  : "text-text-secondary hover:bg-surface-tertiary hover:text-text-primary"
              )}
            >
              <item.icon size={20} />
              <span className="font-medium text-sm">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="px-4 pb-1 shrink-0">
          <WorkspaceSpaceSwitcher variant="surface" onNavigate={() => setIsMobileMenuOpen(false)} />
        </div>

        <div className="p-4 mt-auto border-t border-border-subtle">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-text-secondary hover:bg-surface-tertiary hover:text-noya-red transition-colors"
          >
            <LogOut size={20} />
            <span className="font-medium text-sm">Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-surface-primary">
        {/* Desktop Header */}
        <header className="bg-surface-secondary shadow-sm sticky top-0 z-40 hidden md:block border-b border-border-subtle">
          <div className="px-6 py-4 flex items-center justify-between">
            <h1 className="text-xl font-semibold text-text-primary">{getPageTitle()}</h1>
            <div className="flex items-center space-x-4">
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
                <input 
                  type="text" 
                  placeholder="Rechercher..." 
                  className="pl-10 pr-4 py-2 bg-surface-primary border border-border-subtle rounded-lg text-text-primary text-sm focus:outline-none focus:border-noya-orange focus:ring-1 focus:ring-noya-orange w-64 placeholder-text-dim transition-all font-medium"
                />
              </div>
              
              {/* Notifications */}
              <div className="relative">
                <button 
                  onClick={() => {
                    setShowProfileMenu(false);
                    setShowNotifications((open) => !open);
                  }}
                  className="text-text-secondary hover:text-text-primary relative p-2 rounded-full hover:bg-surface-tertiary transition-colors"
                >
                  <Bell size={20} />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 bg-[#E15B64] text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-surface-secondary rounded-2xl shadow-xl border border-border-medium py-2 z-50">
                    <div className="px-4 py-2 border-b border-border-subtle flex justify-between items-center">
                      <h3 className="font-bold text-text-primary text-sm">Notifications</h3>
                      <button 
                        onClick={handleMarkAllAsRead}
                        className="text-xs text-[#FFB332] font-medium cursor-pointer hover:underline"
                      >
                        Tout marquer comme lu
                      </button>
                    </div>
                    <div className="custom-scrollbar max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center text-[#8D98AA] text-sm">
                          Aucune notification
                        </div>
                      ) : (
                        notifications.map((notification) => (
                          <div 
                            key={notification.id}
                            onClick={() => handleNotificationClick(notification)}
                            className={cn(
                              "px-4 py-3 hover:bg-surface-tertiary cursor-pointer border-b border-border-subtle transition-colors",
                              !notification.read && "bg-noya-orange/5"
                            )}
                          >
                            <p className={cn("text-sm font-medium", !notification.read ? "text-text-primary" : "text-text-secondary")}>
                              {notification.title}
                            </p>
                            <p className="text-xs text-text-muted mt-1">{notification.message}</p>
                            <p className="text-[10px] text-text-dim mt-1">
                              {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: fr })}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                className="text-text-secondary hover:text-text-primary p-2 rounded-full hover:bg-surface-tertiary transition-colors"
              >
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
              </button>

              <div className="relative" ref={profileMenuRef}>
                <button
                  type="button"
                  onClick={() => {
                    setShowNotifications(false);
                    setShowProfileMenu((open) => !open);
                  }}
                  className={cn(
                    "flex items-center space-x-2 pl-4 pr-2 py-1.5 border-l border-border-subtle rounded-xl transition-colors",
                    showProfileMenu ? "bg-surface-tertiary" : "hover:bg-surface-tertiary"
                  )}
                  aria-haspopup="menu"
                  aria-label="Profil super admin"
                >
                  <div className="w-8 h-8 bg-noya-red/20 border border-noya-red/30 rounded-full flex items-center justify-center text-noya-red font-bold text-sm shadow-inner">
                    {userInitialLetter(userData, "A", user?.email)}
                  </div>
                  <span className="hidden md:block text-sm font-black text-text-primary uppercase tracking-tighter">{displayName}</span>
                  <ChevronDown size={14} className={cn("text-text-secondary/50 transition-transform", showProfileMenu && "rotate-180")} />
                </button>

                {showProfileMenu && (
                  <div
                    className="absolute right-0 top-full mt-3 w-80 bg-surface-secondary rounded-2xl shadow-xl border border-border-medium py-2 z-50 overflow-hidden"
                    role="menu"
                  >
                    <div className="px-4 py-3 border-b border-border-subtle bg-surface-primary/50">
                      <p className="text-sm font-semibold text-text-primary">{displayName}</p>
                      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.18em] text-noya-orange">Super Admin</p>
                    </div>

                    {user?.email ? (
                      <div className="px-4 py-3 border-b border-border-subtle">
                        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-text-dim">Compte</p>
                        <div className="mt-2 flex items-start gap-2 rounded-xl border border-border-subtle bg-surface-primary px-3 py-2">
                          <Mail size={14} className="mt-0.5 shrink-0 text-noya-orange" />
                          <span className="min-w-0 flex-1 break-all text-xs text-text-secondary">{user.email}</span>
                        </div>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => void copyEmail()}
                          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-border-subtle py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-text-secondary transition-colors hover:border-noya-orange/40 hover:bg-noya-orange/10 hover:text-text-primary"
                        >
                          <Copy size={13} />
                          {copiedEmail ? 'Copié' : 'Copier l’e-mail'}
                        </button>
                      </div>
                    ) : null}

                    <div className="border-b border-border-subtle px-2 py-2">
                      <WorkspaceSpaceSwitcher
                        variant="surface"
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
                          navigate('/superadmin/settings');
                        }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-text-secondary transition-colors hover:bg-surface-tertiary hover:text-text-primary"
                      >
                        <User size={16} />
                        Paramètres
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
          </div>
        </header>

        <div className="flex-1 overflow-y-scroll p-2 md:p-4 lg:p-8 custom-scrollbar">
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
