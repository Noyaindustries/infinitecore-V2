import { useState, useEffect } from 'react';
import { Activity, Server, Database, ShieldAlert, CheckCircle, AlertTriangle, Cpu, Globe, Zap, Search, Terminal } from 'lucide-react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { handleFirestoreError, OperationType } from '../../utils/firestoreErrorHandler';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

export default function SuperAdminSupervision() {
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [services, setServices] = useState([
    { id: 1, name: 'Main Infrastructure', status: 'Opérationnel', uptime: '99.99%', load: '42%', icon: Server, color: 'text-noya-blue', bg: 'bg-noya-blue/10' },
    { id: 2, name: 'Cloud Database (Firestore)', status: 'Opérationnel', uptime: '100%', load: '18%', icon: Database, color: 'text-noya-green', bg: 'bg-noya-green/10' },
    { id: 3, name: 'Edge Authentication', status: 'Opérationnel', uptime: '99.98%', load: '7%', icon: ShieldAlert, color: 'text-noya-orange', bg: 'bg-noya-orange/10' },
    { id: 4, name: 'Stripe API Gateway', status: 'Opérationnel', uptime: '99.90%', load: 'N/A', icon: Activity, color: 'text-noya-red', bg: 'bg-noya-red/10' },
  ]);

  useEffect(() => {
    const q = query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLogs(logsData);
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'logs');
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="p-6 space-y-8 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-text-primary tracking-tight">Supervision Système</h1>
          <p className="text-text-secondary mt-1 font-medium italic opacity-70">Moniteur de santé global et monitoring temps réel</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-noya-green/10 border border-noya-green/20 px-4 py-2 rounded-xl shadow-inner">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-noya-green opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-noya-green"></span>
            </span>
            <span className="text-xs font-black text-noya-green uppercase tracking-widest">Opérationnel</span>
          </div>
          <button className="p-2 transition-all text-text-muted hover:text-text-primary hover:bg-surface-tertiary rounded-xl border border-border-subtle">
            <Zap size={20} />
          </button>
        </div>
      </div>

      {/* Grid Services */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {services.map((service, index) => (
          <motion.div 
            key={service.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-surface-secondary p-6 rounded-2xl shadow-sm border border-border-subtle flex flex-col hover:border-border-medium transition-all group"
          >
            <div className="flex justify-between items-start mb-6">
              <div className={cn("p-4 rounded-2xl group-hover:scale-110 transition-transform", service.bg, service.color)}>
                <service.icon size={24} />
              </div>
              <div className="flex flex-col items-end">
                <span className={cn("inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest shadow-inner", 
                  service.status === 'Opérationnel' ? 'bg-noya-green/10 text-noya-green' : 'bg-noya-orange/10 text-noya-orange'
                )}>
                  {service.status === 'Opérationnel' ? <CheckCircle size={10} /> : <AlertTriangle size={10} />}
                  {service.status}
                </span>
              </div>
            </div>
            <h3 className="text-lg font-bold text-text-primary mb-1 tracking-tight">{service.name}</h3>
            <div className="mt-6 pt-6 border-t border-border-subtle flex justify-between">
              <div className="space-y-1">
                <span className="block text-[10px] text-text-muted font-black uppercase tracking-widest">Uptime</span>
                <span className="font-bold text-text-primary text-sm">{service.uptime}</span>
              </div>
              <div className="space-y-1 text-right">
                <span className="block text-[10px] text-text-muted font-black uppercase tracking-widest">Charge</span>
                <span className="font-bold text-text-primary text-sm">{service.load}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Real-time Logs Terminal */}
        <div className="lg:col-span-2 bg-surface-tertiary rounded-3xl shadow-lg border border-border-subtle overflow-hidden flex flex-col">
          <div className="p-6 border-b border-border-subtle bg-surface-primary/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-surface-primary/50 text-text-secondary rounded-lg">
                <Terminal size={18} />
              </div>
              <h2 className="text-sm font-black text-text-primary uppercase tracking-widest">Terminal de Logs Système</h2>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-noya-red animate-pulse"></div>
              <span className="text-[10px] font-bold text-text-muted uppercase tracking-tighter">Live Monitor</span>
            </div>
          </div>
          <div className="flex-1 min-h-[500px] overflow-y-auto p-4 font-mono text-xs custom-scrollbar bg-surface-primary">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-text-secondary">
                <div className="w-10 h-10 border-b-2 border-noya-blue rounded-full animate-spin" />
                <p className="font-bold uppercase tracking-widest text-[10px]">Initialisation du flux...</p>
              </div>
            ) : logs.length > 0 ? (
              <div className="space-y-2">
                {logs.map((log, i) => (
                  <motion.div 
                    key={log.id || i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex gap-4 p-2.5 rounded-lg hover:bg-surface-secondary transition-colors border-l-2 border-transparent hover:border-noya-blue group"
                  >
                    <div className="text-text-dim shrink-0 select-none w-14">
                      {log.timestamp ? new Date(log.timestamp).toLocaleTimeString('fr-FR') : '00:00:00'}
                    </div>
                    <div className={cn("shrink-0 font-black w-16 uppercase tracking-widest text-[10px]", 
                      log.level === 'INFO' ? 'text-noya-blue' : 
                      log.level === 'WARN' ? 'text-noya-orange' : 
                      'text-noya-red'
                    )}>
                      [{log.level}]
                    </div>
                    <div className="text-text-primary/70 flex-1 break-all leading-relaxed">
                      <span className="text-text-dim mr-2">{log.source.replace('/superadmin/', '')} λ</span>
                      {log.message}
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-text-dim">
                <p className="font-black uppercase tracking-widest text-[10px]">Flux de données vide</p>
              </div>
            )}
          </div>
        </div>

         {/* Sidebar Health Cards */}
        <div className="space-y-6">
          <div className="bg-surface-secondary p-6 rounded-3xl border border-border-subtle shadow-sm">
            <h3 className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-6">Utilisation CPU</h3>
            <div className="flex items-end gap-1 h-32 mb-4">
              {[40, 65, 45, 80, 55, 90, 70, 85, 40, 60, 50, 45].map((h, i) => (
                <div key={i} className="flex-1 bg-surface-tertiary rounded-t-sm relative group">
                  <motion.div 
                    initial={{ height: 0 }}
                    animate={{ height: `${h}%` }}
                    transition={{ delay: i * 0.05, duration: 1 }}
                    className={cn("absolute bottom-0 left-0 right-0 rounded-t-sm", h > 80 ? 'bg-noya-red' : h > 60 ? 'bg-noya-orange' : 'bg-noya-blue')}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between items-center bg-surface-primary p-4 rounded-2xl border border-border-subtle">
              <div className="flex items-center gap-3">
                <Cpu size={20} className="text-noya-blue" />
                <span className="text-sm font-bold text-text-primary">Global Load</span>
              </div>
              <span className="text-xl font-black text-text-primary">48.2%</span>
            </div>
          </div>

           <div className="bg-surface-secondary p-6 rounded-3xl border border-border-subtle shadow-sm">
            <h3 className="text-[10px] font-black text-text-secondary uppercase tracking-widest mb-6">Traffic Global</h3>
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <Globe size={20} className="text-noya-green" />
                <span className="text-sm font-bold text-text-primary">Requêtes/sec</span>
              </div>
              <span className="text-2xl font-black text-noya-green">1,248</span>
            </div>
            <div className="space-y-4">
              {[
                { label: 'Europe (Paris)', val: '85ms', status: 'optimal' },
                { label: 'Americas (US-East)', val: '142ms', status: 'optimal' },
                { label: 'Asia (Singapore)', val: '210ms', status: 'warning' },
              ].map((loc) => (
                <div key={loc.label} className="flex justify-between items-center text-xs">
                  <span className="text-text-muted italic">{loc.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-text-primary">{loc.val}</span>
                    <div className={cn("w-1.5 h-1.5 rounded-full", loc.status === 'optimal' ? 'bg-noya-green' : 'bg-noya-orange')} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
