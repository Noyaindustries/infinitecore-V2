import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, MessageCircle, ShoppingCart, FolderCheck, LogOut, Menu, X, User, Bell, Sun, Moon } from 'lucide-react';
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

export default function ClientLayout() {
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
    if (notification.type === 'mission') navigate('/dashboard');
    if (notification.type === 'mission') navigate('/dashboard/suivi');
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
    <div className="min-h-screen bg-noya-black flex flex-col md:flex-row font-sans text-text-primary">
      {/* Mobile Header */}
      <div className="md:hidden bg-noya-sidebar border-b border-white/5 text-text-primary px-4 py-3 min-h-[60px] flex justify-between items-center z-50 relative">
        <Logo lightText={theme === 'dark'} className="h-14" />
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-text-primary">
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={cn(
        "bg-noya-sidebar border-r border-white/5 text-text-primary w-64 sidebar-responsive flex-shrink-0 flex-col transition-transform duration-300 ease-in-out fixed md:relative z-50 h-full",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="p-6 hidden md:block">
          <div className="mb-2">
            <Logo lightText className="h-14 md:h-16" />
          </div>
          <div className="text-xs text-text-secondary font-mono tracking-widest flex items-center gap-2 mt-2">
            <span className="w-2 h-2 rounded-full bg-noya-blue shadow-[0_0_8px_rgba(110,167,234,0.8)] animate-pulse"></span>
            Espace Client
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard'}
              onClick={() => setIsMobileMenuOpen(false)}
              className={({ isActive }) => cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300",
                isActive 
                  ? "bg-noya-blue/10 text-noya-blue border border-noya-blue/20 shadow-[0_0_15px_rgba(110,167,234,0.1)] font-medium" 
                  : "text-text-secondary hover:bg-white/5 hover:text-text-primary"
              )}
            >
              <div className="relative">
                <item.icon size={20} className="flex-shrink-0" />
                {item.id === 'messagerie' && unreadChats > 0 && (
                  <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-[#E15B64] border border-[#0A1020]"></span>
                )}
              </div>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 mt-auto">
          <button 
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-[#8D98AA] hover:bg-white/5 hover:text-[#E15B64] transition-colors"
          >
            <LogOut size={20} />
            <span className="font-medium">Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden bg-noya-black">
        {/* Desktop Header */}
        <header className="bg-noya-sidebar shadow-sm sticky top-0 z-40 hidden md:block border-b border-white/5">
          <div className="px-6 py-4 flex items-center justify-between">
            <h1 className="text-xl font-semibold text-text-primary">Espace Client</h1>
            <div className="flex items-center space-x-4">
              {/* Notifications */}
              <div className="relative">
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="text-text-secondary hover:text-text-primary relative p-2 rounded-full hover:bg-white/5 transition-colors"
                >
                  <Bell size={20} />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 bg-[#E15B64] text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                      {unreadCount}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-[#0D1320] rounded-2xl shadow-xl border border-white/10 py-2 z-50">
                    <div className="px-4 py-2 border-b border-white/5 flex justify-between items-center">
                      <h3 className="font-bold text-[#F2F4F8]">Notifications</h3>
                      <button 
                        onClick={handleMarkAllAsRead}
                        className="text-xs text-[#6EA7EA] font-medium cursor-pointer hover:underline"
                      >
                        Tout marquer comme lu
                      </button>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
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
                              "px-4 py-3 hover:bg-white/5 cursor-pointer border-b border-white/5 transition-colors",
                              !notification.read && "bg-[#6EA7EA]/5"
                            )}
                          >
                            <p className={cn("text-sm font-medium", !notification.read ? "text-[#F2F4F8]" : "text-[#8D98AA]")}>
                              {notification.title}
                            </p>
                            <p className="text-xs text-[#8D98AA]/80 mt-1">{notification.message}</p>
                            <p className="text-[10px] text-[#8D98AA]/50 mt-1">
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
                onClick={toggleTheme}
                className="p-2 text-text-secondary hover:text-text-primary hover:bg-white/5 rounded-full transition-colors flex items-center justify-center"
                title={theme === 'dark' ? 'Passer au mode clair' : 'Passer au mode sombre'}
              >
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
              </button>

              <div className="flex items-center space-x-2 pl-4 border-l border-white/10">
                <div className="w-8 h-8 bg-[#6EA7EA]/20 border border-[#6EA7EA]/30 rounded-full flex items-center justify-center text-[#6EA7EA] font-bold text-sm uppercase">
                  {user?.email?.substring(0, 2) || 'CL'}
                </div>
                <span className="hidden md:block text-sm font-medium text-[#F2F4F8]">{user?.email}</span>
              </div>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
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
