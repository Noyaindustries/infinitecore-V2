import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  CreditCard, 
  TrendingUp, 
  MessageSquare, 
  Activity,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { motion } from 'framer-motion';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import toast from 'react-hot-toast';

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState([
    { label: 'Chiffre d\'affaires', value: '0 FCFA', icon: TrendingUp, color: 'text-[#2BC673]', bg: 'bg-[#2BC673]/10' },
    { label: 'Clients Actifs', value: '0', icon: Users, color: 'text-[#6EA7EA]', bg: 'bg-[#6EA7EA]/10' },
    { label: 'Commandes', value: '0', icon: CreditCard, color: 'text-[#FFB332]', bg: 'bg-[#FFB332]/10' },
    { label: 'Tickets Ouverts', value: '0', icon: MessageSquare, color: 'text-[#E15B64]', bg: 'bg-[#E15B64]/10' },
  ]);

  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);

  useEffect(() => {
    // Real-time stats listeners
    const unsubPayments = onSnapshot(collection(db, 'payments'), (snapshot) => {
      const total = snapshot.docs.reduce((acc, doc) => acc + (doc.data().amount || 0), 0);
      setStats(prev => prev.map(s => s.label === 'Chiffre d\'affaires' ? { ...s, value: `${total.toLocaleString()} FCFA` } : s));
    });

    const unsubUsers = onSnapshot(query(collection(db, 'users'), where('role', '==', 'client')), (snapshot) => {
      setStats(prev => prev.map(s => s.label === 'Clients Actifs' ? { ...s, value: snapshot.size.toString() } : s));
    });

    const unsubOrders = onSnapshot(collection(db, 'orders'), (snapshot) => {
      setStats(prev => prev.map(s => s.label === 'Commandes' ? { ...s, value: snapshot.size.toString() } : s));
      const orders = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5);
      setRecentOrders(orders);
    });

    const unsubTickets = onSnapshot(query(collection(db, 'tickets'), where('status', '!=', 'Fermé')), (snapshot) => {
      setStats(prev => prev.map(s => s.label === 'Tickets Ouverts' ? { ...s, value: snapshot.size.toString() } : s));
    });

    const unsubLogs = onSnapshot(query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(5)), (snapshot) => {
      setRecentLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubPayments();
      unsubUsers();
      unsubOrders();
      unsubTickets();
      unsubLogs();
    };
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-surface-primary">
      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-surface-secondary p-6 rounded-2xl shadow-sm border border-border-subtle flex items-center justify-between hover:border-border-medium transition-shadow group"
            >
              <div>
                <p className="text-sm text-text-secondary font-medium mb-1">{stat.label}</p>
                <p className="text-2xl font-bold text-text-primary">{stat.value}</p>
              </div>
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${stat.bg}`}>
                <stat.icon className={`w-6 h-6 ${stat.color}`} />
              </div>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart Placeholder */}
          {/* Revenue Chart - Premium SVG Representation */}
          <div className="lg:col-span-2 bg-surface-secondary rounded-3xl shadow-sm border border-border-subtle p-8 flex flex-col relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-noya-blue/5 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 group-hover:bg-noya-blue/10 transition-colors duration-1000"></div>
            
            <div className="flex justify-between items-center mb-10 relative z-10">
              <div>
                <h2 className="text-xl font-black text-text-primary uppercase tracking-tight">Performance des revenus (ARR)</h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="w-2 h-2 bg-noya-green rounded-full animate-pulse"></span>
                  <span className="text-[10px] font-black text-noya-green uppercase tracking-widest">Temps Réel</span>
                </div>
              </div>
              <select className="px-4 py-2 bg-surface-primary border border-border-subtle rounded-xl text-xs font-black uppercase tracking-widest text-text-secondary focus:ring-2 focus:ring-noya-blue outline-none cursor-pointer">
                <option>Analyses 12 Mois</option>
                <option>Fiscalité 2026</option>
              </select>
            </div>
            
            <div className="flex-1 min-h-[250px] relative z-10 mt-6 mt-10">
              <svg viewBox="0 0 800 250" className="w-full h-full drop-shadow-[0_10px_30px_rgba(110,167,234,0.15)]">
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6EA7EA" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#6EA7EA" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* Grid Lines */}
                {[0, 1, 2, 3, 4].map((i) => (
                  <line 
                    key={i} 
                    x1="0" y1={i * 50 + 10} x2="800" y2={i * 50 + 10} 
                    stroke="currentColor" 
                    className="text-text-primary/5"
                    strokeWidth="1" 
                  />
                ))}
                {/* Area */}
                <path
                  d="M 0 200 Q 100 180 200 190 T 400 120 T 600 140 T 800 40 L 800 250 L 0 250 Z"
                  fill="url(#chartGradient)"
                />
                {/* Line */}
                <motion.path
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 2, ease: "easeInOut" }}
                  d="M 0 200 Q 100 180 200 190 T 400 120 T 600 140 T 800 40"
                  fill="none"
                  stroke="#6EA7EA"
                  strokeWidth="4"
                  strokeLinecap="round"
                />
                {/* Data Nodes */}
                <circle cx="200" cy="190" r="5" fill="#6EA7EA" className="animate-pulse" />
                <circle cx="400" cy="120" r="5" fill="#6EA7EA" className="animate-pulse" />
                <circle cx="600" cy="140" r="5" fill="#6EA7EA" className="animate-pulse" />
                <circle cx="800" cy="40" r="6" fill="#6EA7EA" />
              </svg>
              
              {/* Values */}
              <div className="absolute -top-4 right-0 bg-surface-secondary border border-noya-blue/30 px-3 py-1.5 rounded-lg shadow-xl">
                <p className="text-[10px] font-black text-noya-blue uppercase tracking-widest whitespace-nowrap">Peak Performance: 14.2M</p>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-surface-secondary rounded-3xl shadow-sm border border-border-subtle p-8">
            <h2 className="text-xl font-black text-text-primary uppercase tracking-tight mb-8">Activités Système</h2>
            <div className="space-y-8">
              {recentLogs.length > 0 ? recentLogs.map((log, i) => (
                <div key={log.id} className="flex gap-4 group/log relative">
                  {i < recentLogs.length - 1 && (
                    <div className="absolute left-[7px] top-6 bottom-[-16px] w-px bg-white/5 group-hover/log:bg-noya-blue/20 transition-colors" />
                  )}
                  <div className={`w-3.5 h-3.5 mt-1 relative z-10 rounded-full border-2 border-surface-secondary ${
                    log.severity === 'error' ? 'bg-noya-red' : 
                    log.severity === 'warning' ? 'bg-noya-orange' : 'bg-noya-blue'
                  }`} />
                  <div className="flex-1">
                    <p className="text-sm font-bold text-text-primary group-hover:text-noya-blue transition-colors leading-tight">{log.action}</p>
                    <p className="text-[10px] text-text-secondary mt-1 font-medium line-clamp-2 opacity-70 italic">{log.details}</p>
                    <div className="flex items-center gap-2 mt-2">
                       <Clock size={10} className="text-text-secondary/50" />
                       <p className="text-[10px] font-black text-text-secondary/40 uppercase tracking-widest">
                        {log.timestamp ? format(new Date(log.timestamp), 'HH:mm:ss', { locale: fr }) : '--:--:--'}
                      </p>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="flex flex-col items-center justify-center py-10 opacity-20">
                  <Activity size={48} />
                  <p className="text-[10px] font-black uppercase tracking-widest mt-4">Aucune transmission</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recent Orders */}
        <div className="bg-surface-secondary rounded-3xl shadow-sm border border-border-subtle overflow-hidden">
          <div className="p-8 border-b border-border-subtle bg-surface-primary/50 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-black text-text-primary uppercase tracking-tight">Flux Commandes Récentes</h2>
              <p className="text-[10px] text-text-secondary font-black uppercase tracking-[0.2em] mt-1 opacity-50">Transactions en temps réel</p>
            </div>
            <button 
              onClick={() => navigate('/superadmin/orders')} 
              className="px-6 py-2 bg-noya-blue/10 border border-noya-blue/20 text-noya-blue text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-noya-blue hover:text-noya-black transition-all"
            >
              Indexer le registre
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-primary text-text-secondary/70 text-[10px] uppercase font-black tracking-widest border-b border-border-subtle">
                  <th className="p-6 font-black tracking-widest">Compte Client</th>
                  <th className="p-6 font-black tracking-widest">Architecture Service</th>
                  <th className="p-6 font-black tracking-widest">Badge Statut</th>
                  <th className="p-6 font-black tracking-widest text-right">Datation</th>
                </tr>
              </thead>
              <tbody className="text-sm text-text-primary font-medium">
                {recentOrders.length > 0 ? recentOrders.map((order, i) => (
                  <tr key={order.id} className="border-b border-border-subtle hover:bg-surface-primary transition-all group">
                    <td className="p-6">
                      <div className="font-bold group-hover:text-noya-blue transition-colors">{order.clientName}</div>
                      <div className="text-[9px] font-mono text-text-secondary/40 uppercase tracking-tighter mt-1 italic">ID: {order.id.substring(0, 8)}</div>
                    </td>
                    <td className="p-6">
                      <div className="flex items-center gap-2">
                        <CreditCard size={14} className="text-noya-blue/50" />
                        <span className="text-xs">{order.serviceName}</span>
                      </div>
                    </td>
                    <td className="p-6">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-inner
                        ${order.status === 'Terminé' ? 'bg-noya-green/10 text-noya-green' : 
                          order.status === 'En cours' ? 'bg-noya-blue/10 text-noya-blue' : 
                          order.status === 'Validé' ? 'bg-noya-purple/10 text-noya-purple' :
                          'bg-noya-orange/10 text-noya-orange animate-pulse'}`}
                      >
                        <div className={`w-1.5 h-1.5 rounded-full ${order.status === 'Terminé' || order.status === 'Validé' ? 'bg-current' : 'bg-current animate-ping'}`} />
                        {order.status}
                      </span>
                    </td>
                    <td className="p-6 text-right font-mono text-[10px] text-text-secondary opacity-60">
                      {order.createdAt ? format(new Date(order.createdAt), 'dd MMMM yyyy HH:mm', { locale: fr }) : '--'}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={4} className="p-20 text-center text-text-secondary/20">
                      <div className="flex flex-col items-center gap-4">
                        <CreditCard size={48} className="opacity-20" />
                        <p className="text-[10px] font-black uppercase tracking-widest italic">Aucun flux transactionnel détecté</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
