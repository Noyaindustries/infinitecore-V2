import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Suspense, lazy } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FirebaseProvider } from './components/FirebaseProvider';
import CookieBanner from './components/CookieBanner';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './components/layout/AdminLayout';
import ClientLayout from './components/layout/ClientLayout';
import DeveloperLayout from './components/layout/DeveloperLayout';
import SuperAdminLayout from './components/layout/SuperAdminLayout';
import MarketingLayout from './components/layout/MarketingLayout';
import PartnerLayout from './components/layout/PartnerLayout';

// Lazy load pages
const Home = lazy(() => import('./pages/Home'));
const About = lazy(() => import('./pages/marketing/About'));
const Pricing = lazy(() => import('./pages/marketing/Pricing'));
const Solutions = lazy(() => import('./pages/marketing/Solutions'));
const Cookies = lazy(() => import('./pages/marketing/Cookies'));
const MentionsLegales = lazy(() => import('./pages/marketing/MentionsLegales'));
const CGU = lazy(() => import('./pages/marketing/CGU'));
const CGV = lazy(() => import('./pages/marketing/CGV'));
const PolitiqueConfidentialite = lazy(() => import('./pages/marketing/PolitiqueConfidentialite'));
const FAQ = lazy(() => import('./pages/marketing/FAQ'));
const Login = lazy(() => import('./pages/auth/Login'));
const Signup = lazy(() => import('./pages/auth/Signup'));
const MarketingPage = lazy(() => import('./pages/marketing/MarketingPage'));
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard'));
const KanbanPipeline = lazy(() => import('./pages/admin/KanbanPipeline'));
const Operations = lazy(() => import('./pages/admin/Operations'));
const AdminClients = lazy(() => import('./pages/admin/Clients'));
const AdminFinance = lazy(() => import('./pages/admin/Finance'));
const AdminTickets = lazy(() => import('./pages/admin/Tickets'));
const AdminDossiers = lazy(() => import('./pages/admin/Dossiers'));
const AdminMessagerie = lazy(() => import('./pages/admin/Messagerie'));
const AdminInstances = lazy(() => import('./pages/admin/Instances'));
const ClientDashboard = lazy(() => import('./pages/client/Dashboard'));
const ClientDocuments = lazy(() => import('./pages/client/Documents'));
const ClientChat = lazy(() => import('./pages/client/Chat'));
const ClientShop = lazy(() => import('./pages/client/Shop'));
const ClientSupport = lazy(() => import('./pages/client/Support'));
const ClientSuivi = lazy(() => import('./pages/client/Suivi'));
const ClientProfile = lazy(() => import('./pages/client/Profile'));
const DeveloperDashboard = lazy(() => import('./pages/developer/Dashboard'));
const DeveloperMissions = lazy(() => import('./pages/developer/Missions'));
const DeveloperDeliverables = lazy(() => import('./pages/developer/Deliverables'));
const DeveloperCommissions = lazy(() => import('./pages/developer/Commissions'));
const DeveloperResources = lazy(() => import('./pages/developer/Resources'));
const DeveloperProfile = lazy(() => import('./pages/developer/Profile'));
const SuperAdminDashboard = lazy(() => import('./pages/superadmin/Dashboard'));
const SuperAdminUsers = lazy(() => import('./pages/superadmin/Users'));
const SuperAdminOrders = lazy(() => import('./pages/superadmin/Orders'));
const SuperAdminPartners = lazy(() => import('./pages/superadmin/Partners'));
const SuperAdminCommando = lazy(() => import('./pages/superadmin/Commando'));
const SuperAdminDevelopers = lazy(() => import('./pages/superadmin/Developers'));
const SuperAdminSupervision = lazy(() => import('./pages/superadmin/Supervision'));
const SuperAdminSettings = lazy(() => import('./pages/superadmin/Settings'));
const PaddeCiAudits = lazy(() => import('./pages/superadmin/PaddeCiAudits'));
const SuperAdminMissions = lazy(() => import('./pages/superadmin/Missions'));
const PartnerDashboard = lazy(() => import('./pages/partner/Dashboard'));
const PartnerClients = lazy(() => import('./pages/partner/Clients'));
const PartnerCommissions = lazy(() => import('./pages/partner/Commissions'));
const PartnerResources = lazy(() => import('./pages/partner/Resources'));
const PartnerProfile = lazy(() => import('./pages/partner/Profile'));
const ModuleLogin = lazy(() => import('./pages/module/Login'));
const ModuleDashboard = lazy(() => import('./pages/module/Dashboard'));

function App() {
  return (
    <ErrorBoundary>
      <FirebaseProvider>
        <Toaster position="top-right" />
        <CookieBanner />
        <Router>
          <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-surface-primary text-text-primary">Chargement...</div>}>
            <Routes>
          {/* Marketing Routes */}
          <Route element={<MarketingLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/solutions" element={<Solutions />} />
            <Route path="/infinite-crm" element={<MarketingPage />} />
            <Route path="/infinite-finance" element={<MarketingPage />} />
            <Route path="/rh" element={<MarketingPage />} />
            <Route path="/projects" element={<MarketingPage />} />
            <Route path="/academy" element={<MarketingPage />} />
            <Route path="/comms" element={<MarketingPage />} />
            <Route path="/store" element={<MarketingPage />} />
            <Route path="/tarifs" element={<Pricing />} />
            <Route path="/a-propos" element={<About />} />
            
            {/* Legal Routes */}
            <Route path="/mentions-legales" element={<MentionsLegales />} />
            <Route path="/cgu" element={<CGU />} />
            <Route path="/cgv" element={<CGV />} />
            <Route path="/confidentialite" element={<PolitiqueConfidentialite />} />
            <Route path="/securite" element={<MarketingPage />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/cookies" element={<Cookies />} />
          </Route>

          <Route path="/login" element={<Login />} />
          <Route path="/staff/login" element={<Login isStaff={true} />} />
          <Route path="/signup" element={<Signup />} />
          
          {/* Module Routes */}
          <Route path="/module/:id/login" element={<ModuleLogin />} />
          <Route path="/module/:id/dashboard" element={<ModuleDashboard />} />
          
          {/* Super Admin Routes (Admin Général) */}
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route path="/superadmin" element={<SuperAdminLayout />}>
              <Route index element={<SuperAdminDashboard />} />
              <Route path="users" element={<SuperAdminUsers />} />
              <Route path="orders" element={<SuperAdminOrders />} />
              <Route path="partners" element={<SuperAdminPartners />} />
              <Route path="commando" element={<SuperAdminCommando />} />
              <Route path="developers" element={<SuperAdminDevelopers />} />
              <Route path="supervision" element={<SuperAdminSupervision />} />
              <Route path="settings" element={<SuperAdminSettings />} />
              <Route path="audits-padde" element={<PaddeCiAudits />} />
              <Route path="missions" element={<SuperAdminMissions />} />
            </Route>
          </Route>

          {/* Admin Routes (Infinite Commando) */}
          <Route element={<ProtectedRoute allowedRoles={['commando', 'admin']} />}>
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              <Route path="pipeline" element={<KanbanPipeline />} />
              <Route path="clients" element={<AdminClients />} />
              <Route path="operations" element={<Operations />} />
              <Route path="finance" element={<AdminFinance />} />
              <Route path="messagerie" element={<AdminMessagerie />} />
              <Route path="dossiers" element={<AdminDossiers />} />
              <Route path="instances" element={<AdminInstances />} />
            </Route>
          </Route>

          {/* Client Routes (Portail Infinite) */}
          <Route element={<ProtectedRoute allowedRoles={['client']} />}>
            <Route path="/dashboard" element={<ClientLayout />}>
              <Route index element={<ClientDashboard />} />
              <Route path="documents" element={<ClientDocuments />} />
              <Route path="messagerie" element={<ClientChat />} />
              <Route path="boutique" element={<ClientShop />} />
              <Route path="suivi" element={<ClientSuivi />} />
              <Route path="profil" element={<ClientProfile />} />
            </Route>
          </Route>

          {/* Developer Routes */}
          <Route element={<ProtectedRoute allowedRoles={['developer', 'admin']} />}>
            <Route path="/developer" element={<DeveloperLayout />}>
              <Route index element={<DeveloperDashboard />} />
              <Route path="missions" element={<DeveloperMissions />} />
              <Route path="livrables" element={<DeveloperDeliverables />} />
              <Route path="commissions" element={<DeveloperCommissions />} />
              <Route path="ressources" element={<DeveloperResources />} />
              <Route path="profil" element={<DeveloperProfile />} />
            </Route>
          </Route>

          {/* Partner Routes */}
          <Route element={<ProtectedRoute allowedRoles={['partner', 'admin']} />}>
            <Route path="/partenaire" element={<PartnerLayout />}>
              <Route index element={<PartnerDashboard />} />
              <Route path="clients" element={<PartnerClients />} />
              <Route path="commissions" element={<PartnerCommissions />} />
              <Route path="ressources" element={<PartnerResources />} />
              <Route path="profil" element={<PartnerProfile />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
          </Suspense>
        </Router>
      </FirebaseProvider>
    </ErrorBoundary>
  );
}

export default App;
