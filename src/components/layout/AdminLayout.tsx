import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, KanbanSquare, Briefcase, Users, Wallet, Copy, FolderOpen, LogOut, Menu, X, Bell, MessageCircle, ChevronDown, Sun, Moon } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { db, auth } from '../../firebase';
import { signOut } from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import Logo from '../Logo';
import { notificationService, Notification } from '../../services/notificationService';
import { useAuth } from '../FirebaseProvider';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function AdminLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
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

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleLogout = async () => {
    try {
      localStorage.removeItem('demoRole');
      await signOut(auth);
      window.location.href = 'https://infinitecore.netlify.app/staff/login';
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
    { id: 'pipeline', to: '/admin/pipeline', icon: KanbanSquare, label: 'Pipeline Noya — /admin/pipeline' },
    { id: 'clients', to: '/admin/clients', icon: Users, label: 'CRM Clients' },
    { id: 'operations', to: '/admin/operations', icon: Briefcase, label: 'Opérations' },
    { id: 'finance', to: '/admin/finance', icon: Wallet, label: 'Finance' },
    { id: 'messagerie', to: '/admin/messagerie', icon: MessageCircle, label: 'Messagerie Clients' },
    { id: 'dossiers', to: '/admin/dossiers', icon: FolderOpen, label: 'Dossiers Clients' },
    { id: 'instances', to: '/admin/instances', icon: Copy, label: 'Clonage Instances' },
  ];

  const displayName = userData?.firstName
    ? `${userData.firstName} ${userData.lastName || ''}`.trim()
    : 'Commando';

  return (
    <div className="min-h-screen bg-surface-primary flex flex-col md:flex-row font-sans text-text-primary">
      {/* Mobile Header */}
      <div className="md:hidden bg-surface-secondary border-b border-border-subtle text-text-primary px-4 py-3 min-h-[60px] flex justify-between items-center z-50 relative">
        <Logo className="h-14" />
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 hover:bg-surface-tertiary rounded-xl transition-all">
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={cn(
        "bg-surface-secondary border-r border-border-subtle text-text-primary w-64 sidebar-responsive flex-shrink-0 flex-col transition-transform duration-300 ease-in-out fixed md:relative z-50 h-full shadow-xl md:shadow-none",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="p-6 hidden md:block">
          <div className="mb-3">
            <Logo className="h-14 md:h-16" />
          </div>
          <div className="text-[10px] text-text-muted font-black uppercase tracking-[0.2em] flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-noya-orange shadow-[0_0_8px_rgba(255,179,50,0.5)] animate-pulse"></span>
            Commando System
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/admin'}
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group",
                isActive
                  ? "bg-noya-orange/10 text-noya-orange border border-noya-orange/20 shadow-inner"
                  : "text-text-secondary hover:bg-surface-tertiary hover:text-text-primary"
              )}
            >
              <div className="relative">
                <item.icon size={20} />
                {item.id === 'messagerie' && unreadChats > 0 && (
                  <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-[#E15B64] border border-[#0A1020]"></span>
                )}
              </div>
              <span className="font-medium text-sm">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 mt-auto border-t border-border-subtle">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-text-muted hover:bg-noya-red/10 hover:text-noya-red transition-all group"
          >
            <LogOut size={20} className="group-hover:translate-x-1 transition-transform" />
            <span className="font-black text-[10px] uppercase tracking-widest">Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden bg-surface-primary">
        {/* Top header bar with notification bell */}
        <header className="bg-surface-secondary border-b border-border-subtle px-8 py-3 hidden md:flex items-center justify-end gap-6 z-40 relative shadow-sm">
          {/* Notification bell */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-3 text-text-muted hover:text-noya-orange hover:bg-surface-tertiary rounded-xl transition-all relative border border-transparent hover:border-border-subtle shadow-sm"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 h-5 w-5 rounded-full bg-noya-red text-white text-[10px] font-black flex items-center justify-center border-2 border-surface-secondary">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-3 w-96 bg-surface-secondary rounded-2xl shadow-2xl border border-border-medium py-2 z-50 animate-in fade-in zoom-in duration-200">
                <div className="px-5 py-4 border-b border-border-subtle flex justify-between items-center bg-surface-primary/50">
                  <h3 className="font-black text-text-primary text-[10px] uppercase tracking-widest">Fil d'actualité</h3>
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllAsRead}
                      className="text-[10px] text-noya-orange font-black uppercase tracking-widest hover:underline"
                    >
                      Marquer tout lu
                    </button>
                  )}
                </div>
                <div className="max-h-96 overflow-y-auto custom-scrollbar">
                  {notifications.length === 0 ? (
                    <div className="px-5 py-12 text-center text-text-dim text-[10px] font-black uppercase tracking-[0.2em] italic">
                      Silence radio. Aucune alerte.
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={cn(
                          'px-5 py-4 hover:bg-surface-tertiary cursor-pointer border-b border-border-subtle transition-all group/notif',
                          !n.read && 'bg-noya-orange/5'
                        )}
                      >
                        <p className={cn('text-xs font-black uppercase tracking-tight', !n.read ? 'text-text-primary' : 'text-text-muted')}>
                          {n.title}
                        </p>
                        <p className="text-xs text-text-secondary mt-1 font-medium">{n.message}</p>
                        <p className="text-[9px] text-text-dim mt-2 font-black uppercase tracking-widest">
                          {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: fr })}
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
            className="p-3 text-text-muted hover:text-text-primary hover:bg-surface-tertiary rounded-xl border border-transparent hover:border-border-subtle transition-all shadow-sm"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          <div className="flex items-center gap-4 pl-6 border-l border-border-subtle">
            <div className="w-10 h-10 bg-noya-orange/10 border border-noya-orange/30 rounded-xl flex items-center justify-center text-noya-orange font-black text-sm shadow-inner uppercase">
              {userData?.firstName?.[0] || 'C'}
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-black text-text-primary tracking-tight leading-none uppercase">{displayName}</span>
              <span className="text-[9px] font-black text-noya-orange uppercase tracking-widest mt-1">Commando Infinite</span>
            </div>
            <ChevronDown size={14} className="text-text-muted ml-1" />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-5 md:p-8">
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
