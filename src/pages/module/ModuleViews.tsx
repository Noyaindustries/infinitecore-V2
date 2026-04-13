import { motion } from 'framer-motion';
import { 
  Users, Calendar, FileText, DollarSign, 
  TrendingUp, TrendingDown, Target, Briefcase, CheckCircle, 
  Clock, AlertCircle, GraduationCap, BookOpen, 
  MessageSquare, Radio, ShoppingCart, Package 
} from 'lucide-react';

// --- RH DASHBOARD ---
export function RHDashboard() {
  const employees = [
    { id: 1, name: 'Alice Dubois', role: 'Développeuse Frontend', status: 'Actif', department: 'Tech' },
    { id: 2, name: 'Marc Lambert', role: 'Designer UI/UX', status: 'En congé', department: 'Design' },
    { id: 3, name: 'Sophie Martin', role: 'Chef de Projet', status: 'Actif', department: 'Management' },
  ];

  const leaves = [
    { id: 1, employee: 'Marc Lambert', type: 'Congé payé', dates: '12 Mars - 20 Mars', status: 'Approuvé' },
    { id: 2, employee: 'Lucie Bernard', type: 'Maladie', dates: '18 Mars - 19 Mars', status: 'En attente' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { title: 'Employés Actifs', value: '42', icon: Users, color: 'text-blue-500', bg: 'bg-blue-50' },
          { title: 'Congés en attente', value: '3', icon: Calendar, color: 'text-orange-500', bg: 'bg-orange-50' },
          { title: 'Masse Salariale', value: '125k FCFA', icon: DollarSign, color: 'text-green-500', bg: 'bg-green-50' },
          { title: 'Contrats à revoir', value: '2', icon: FileText, color: 'text-purple-500', bg: 'bg-purple-50' },
        ].map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className={`p-4 rounded-xl ${stat.bg}`}><stat.icon className={`w-6 h-6 ${stat.color}`} /></div>
            <div>
              <p className="text-sm text-gray-500 font-medium">{stat.title}</p>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Annuaire des Employés</h3>
          <div className="space-y-4">
            {employees.map(emp => (
              <div key={emp.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
                <div>
                  <p className="font-bold text-gray-900">{emp.name}</p>
                  <p className="text-sm text-gray-500">{emp.role} • {emp.department}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${emp.status === 'Actif' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                  {emp.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Demandes de Congés</h3>
          <div className="space-y-4">
            {leaves.map(leave => (
              <div key={leave.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
                <div>
                  <p className="font-bold text-gray-900">{leave.employee}</p>
                  <p className="text-sm text-gray-500">{leave.type} • {leave.dates}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${leave.status === 'Approuvé' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {leave.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- CRM DASHBOARD ---
export function CRMDashboard() {
  const clients = [
    { id: 1, name: 'TechCorp SA', contact: 'Jean Dupont', status: 'Client', value: '15 000 FCFA' },
    { id: 2, name: 'Design Studio', contact: 'Marie Curie', status: 'Lead Chaud', value: '4 500 FCFA' },
    { id: 3, name: 'Global Logistics', contact: 'Paul Martin', status: 'Négociation', value: '28 000 FCFA' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { title: 'Total Clients', value: '156', icon: Users, color: 'text-blue-500', bg: 'bg-blue-50' },
          { title: 'Nouveaux Leads', value: '24', icon: Target, color: 'text-orange-500', bg: 'bg-orange-50' },
          { title: 'Devis en attente', value: '12', icon: FileText, color: 'text-purple-500', bg: 'bg-purple-50' },
          { title: 'Taux de conversion', value: '68%', icon: TrendingUp, color: 'text-green-500', bg: 'bg-green-50' },
        ].map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className={`p-4 rounded-xl ${stat.bg}`}><stat.icon className={`w-6 h-6 ${stat.color}`} /></div>
            <div>
              <p className="text-sm text-gray-500 font-medium">{stat.title}</p>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Pipeline Récent</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="p-4 text-sm font-semibold text-gray-600">Entreprise</th>
                <th className="p-4 text-sm font-semibold text-gray-600">Contact</th>
                <th className="p-4 text-sm font-semibold text-gray-600">Valeur estimée</th>
                <th className="p-4 text-sm font-semibold text-gray-600">Statut</th>
              </tr>
            </thead>
            <tbody>
              {clients.map(client => (
                <tr key={client.id} className="border-b border-gray-50">
                  <td className="p-4 font-bold text-gray-900">{client.name}</td>
                  <td className="p-4 text-gray-600">{client.contact}</td>
                  <td className="p-4 text-gray-900 font-medium">{client.value}</td>
                  <td className="p-4">
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                      {client.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// --- FINANCE DASHBOARD ---
export function FinanceDashboard() {
  const transactions = [
    { id: 'FAC-001', desc: 'Paiement TechCorp', type: 'Entrée', amount: '+15 000 FCFA', date: '18 Mars 2026' },
    { id: 'DEP-042', desc: 'Abonnement Logiciels', type: 'Sortie', amount: '-450 FCFA', date: '17 Mars 2026' },
    { id: 'FAC-002', desc: 'Acompte Design Studio', type: 'Entrée', amount: '+2 250 FCFA', date: '15 Mars 2026' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { title: 'Trésorerie', value: '84 500 FCFA', icon: DollarSign, color: 'text-green-500', bg: 'bg-green-50' },
          { title: 'CA Mensuel', value: '32 000 FCFA', icon: TrendingUp, color: 'text-blue-500', bg: 'bg-blue-50' },
          { title: 'Dépenses', value: '8 400 FCFA', icon: TrendingDown, color: 'text-red-500', bg: 'bg-red-50' },
          { title: 'Factures en attente', value: '5', icon: FileText, color: 'text-orange-500', bg: 'bg-orange-50' },
        ].map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className={`p-4 rounded-xl ${stat.bg}`}><stat.icon className={`w-6 h-6 ${stat.color}`} /></div>
            <div>
              <p className="text-sm text-gray-500 font-medium">{stat.title}</p>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Dernières Transactions</h3>
        <div className="space-y-4">
          {transactions.map(tx => (
            <div key={tx.id} className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-full ${tx.type === 'Entrée' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                  {tx.type === 'Entrée' ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                </div>
                <div>
                  <p className="font-bold text-gray-900">{tx.desc}</p>
                  <p className="text-sm text-gray-500">{tx.id} • {tx.date}</p>
                </div>
              </div>
              <span className={`font-bold ${tx.type === 'Entrée' ? 'text-green-600' : 'text-red-600'}`}>
                {tx.amount}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- PROJECTS DASHBOARD ---
export function ProjectsDashboard() {
  const projects = [
    { id: 1, name: 'Refonte Site Web', client: 'TechCorp', progress: 75, status: 'En cours', deadline: '25 Mars' },
    { id: 2, name: 'Application Mobile', client: 'Design Studio', progress: 30, status: 'En retard', deadline: '20 Mars' },
    { id: 3, name: 'Audit Sécurité', client: 'Global Log', progress: 100, status: 'Terminé', deadline: '15 Mars' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { title: 'Projets Actifs', value: '12', icon: Briefcase, color: 'text-blue-500', bg: 'bg-blue-50' },
          { title: 'Tâches Terminées', value: '148', icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50' },
          { title: 'Heures Facturables', value: '320h', icon: Clock, color: 'text-purple-500', bg: 'bg-purple-50' },
          { title: 'Deadlines Proches', value: '3', icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-50' },
        ].map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className={`p-4 rounded-xl ${stat.bg}`}><stat.icon className={`w-6 h-6 ${stat.color}`} /></div>
            <div>
              <p className="text-sm text-gray-500 font-medium">{stat.title}</p>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Suivi des Projets</h3>
        <div className="space-y-6">
          {projects.map(project => (
            <div key={project.id} className="p-4 bg-gray-50 rounded-xl">
              <div className="flex justify-between items-center mb-2">
                <div>
                  <h4 className="font-bold text-gray-900">{project.name}</h4>
                  <p className="text-sm text-gray-500">{project.client} • Deadline: {project.deadline}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  project.status === 'Terminé' ? 'bg-green-100 text-green-700' :
                  project.status === 'En retard' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                }`}>
                  {project.status}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5 mt-4">
                <div className={`h-2.5 rounded-full ${project.progress === 100 ? 'bg-green-500' : project.progress < 50 ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${project.progress}%` }}></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// --- ACADEMY DASHBOARD ---
export function AcademyDashboard() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { title: 'Apprenants', value: '84', icon: Users, color: 'text-blue-500', bg: 'bg-blue-50' },
          { title: 'Cours Complétés', value: '312', icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-50' },
          { title: 'Heures de formation', value: '850h', icon: Clock, color: 'text-purple-500', bg: 'bg-purple-50' },
          { title: 'Taux de réussite', value: '94%', icon: GraduationCap, color: 'text-orange-500', bg: 'bg-orange-50' },
        ].map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className={`p-4 rounded-xl ${stat.bg}`}><stat.icon className={`w-6 h-6 ${stat.color}`} /></div>
            <div>
              <p className="text-sm text-gray-500 font-medium">{stat.title}</p>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col items-center justify-center min-h-[300px]">
        <BookOpen className="w-16 h-16 text-gray-300 mb-4" />
        <h3 className="text-xl font-bold text-gray-900 mb-2">Catalogue de Formations</h3>
        <p className="text-gray-500 text-center max-w-md">Gérez vos cours, suivez la progression de vos collaborateurs et créez de nouveaux parcours d'intégration.</p>
      </div>
    </div>
  );
}

// --- COMMS DASHBOARD ---
export function CommsDashboard() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { title: 'Messages Envoyés', value: '12.4k', icon: MessageSquare, color: 'text-blue-500', bg: 'bg-blue-50' },
          { title: 'Canaux Actifs', value: '18', icon: Radio, color: 'text-green-500', bg: 'bg-green-50' },
          { title: 'Utilisateurs en ligne', value: '42', icon: Users, color: 'text-purple-500', bg: 'bg-purple-50' },
          { title: 'Fichiers Partagés', value: '856', icon: FileText, color: 'text-orange-500', bg: 'bg-orange-50' },
        ].map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className={`p-4 rounded-xl ${stat.bg}`}><stat.icon className={`w-6 h-6 ${stat.color}`} /></div>
            <div>
              <p className="text-sm text-gray-500 font-medium">{stat.title}</p>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col items-center justify-center min-h-[300px]">
        <MessageSquare className="w-16 h-16 text-gray-300 mb-4" />
        <h3 className="text-xl font-bold text-gray-900 mb-2">Messagerie Sécurisée</h3>
        <p className="text-gray-500 text-center max-w-md">Accédez aux canaux de discussion de votre entreprise, gérez les annonces globales et les permissions.</p>
      </div>
    </div>
  );
}

// --- STORE DASHBOARD ---
export function StoreDashboard() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { title: 'Ventes du Jour', value: '1 250 FCFA', icon: DollarSign, color: 'text-green-500', bg: 'bg-green-50' },
          { title: 'Commandes', value: '14', icon: ShoppingCart, color: 'text-blue-500', bg: 'bg-blue-50' },
          { title: 'Produits Actifs', value: '156', icon: Package, color: 'text-purple-500', bg: 'bg-purple-50' },
          { title: 'Visiteurs', value: '842', icon: Users, color: 'text-orange-500', bg: 'bg-orange-50' },
        ].map((stat, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
            <div className={`p-4 rounded-xl ${stat.bg}`}><stat.icon className={`w-6 h-6 ${stat.color}`} /></div>
            <div>
              <p className="text-sm text-gray-500 font-medium">{stat.title}</p>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col items-center justify-center min-h-[300px]">
        <ShoppingCart className="w-16 h-16 text-gray-300 mb-4" />
        <h3 className="text-xl font-bold text-gray-900 mb-2">Gestion Boutique</h3>
        <p className="text-gray-500 text-center max-w-md">Gérez votre catalogue de produits, suivez les expéditions et analysez vos ventes en temps réel.</p>
      </div>
    </div>
  );
}
