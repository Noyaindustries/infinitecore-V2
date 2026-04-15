import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Suspense, lazy } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuthProvider } from './components/AuthProvider';
import CookieBanner from './components/CookieBanner';
import GoogleEmailModal from './components/GoogleEmailModal';
import GoogleConfirmModal from './components/GoogleConfirmModal';
import ProtectedRoute from './components/ProtectedRoute';
import AdminLayout from './components/layout/AdminLayout';
import ClientLayout from './components/layout/ClientLayout';
import DeveloperLayout from './components/layout/DeveloperLayout';
import SuperAdminLayout from './components/layout/SuperAdminLayout';
import MarketingLayout from './components/layout/MarketingLayout';
import PartnerLayout from './components/layout/PartnerLayout';

// Lazy load pages
const Home = lazy(() => import('./views/Home'));
const About = lazy(() => import('./views/marketing/About'));
const Pricing = lazy(() => import('./views/marketing/Pricing'));
const Solutions = lazy(() => import('./views/marketing/Solutions'));
const Cookies = lazy(() => import('./views/marketing/Cookies'));
const MentionsLegales = lazy(() => import('./views/marketing/MentionsLegales'));
const CGU = lazy(() => import('./views/marketing/CGU'));
const CGV = lazy(() => import('./views/marketing/CGV'));
const PolitiqueConfidentialite = lazy(() => import('./views/marketing/PolitiqueConfidentialite'));
const FAQ = lazy(() => import('./views/marketing/FAQ'));
const Login = lazy(() => import('./views/auth/Login'));
const Signup = lazy(() => import('./views/auth/Signup'));
const ResetPassword = lazy(() => import('./views/auth/ResetPassword'));
const MarketingPage = lazy(() => import('./views/marketing/MarketingPage'));
const AdminDashboard = lazy(() => import('./views/admin/Dashboard'));
const KanbanPipeline = lazy(() => import('./views/admin/KanbanPipeline'));
const Operations = lazy(() => import('./views/admin/Operations'));
const AdminClients = lazy(() => import('./views/admin/Clients'));
const AdminFinance = lazy(() => import('./views/admin/Finance'));
const AdminTickets = lazy(() => import('./views/admin/Tickets'));
const AdminDossiers = lazy(() => import('./views/admin/Dossiers'));
const AdminMessagerie = lazy(() => import('./views/admin/Messagerie'));
const AdminInstances = lazy(() => import('./views/admin/Instances'));
const AdminPartners = lazy(() => import('./views/admin/Partners'));
const AdminLeads = lazy(() => import('./views/admin/Leads'));
const ClientDashboard = lazy(() => import('./views/client/Dashboard'));
const ClientDocuments = lazy(() => import('./views/client/Documents'));
const ClientChat = lazy(() => import('./views/client/Chat'));
const ClientShop = lazy(() => import('./views/client/Shop'));
const ClientSupport = lazy(() => import('./views/client/Support'));
const ClientSuivi = lazy(() => import('./views/client/Suivi'));
const ClientProfile = lazy(() => import('./views/client/Profile'));
const DeveloperDashboard = lazy(() => import('./views/developer/Dashboard'));
const DeveloperMissions = lazy(() => import('./views/developer/Missions'));
const DeveloperDeliverables = lazy(() => import('./views/developer/Deliverables'));
const DeveloperCommissions = lazy(() => import('./views/developer/Commissions'));
const DeveloperResources = lazy(() => import('./views/developer/Resources'));
const DeveloperProfile = lazy(() => import('./views/developer/Profile'));
const SuperAdminDashboard = lazy(() => import('./views/superadmin/Dashboard'));
const SuperAdminUsers = lazy(() => import('./views/superadmin/Users'));
const SuperAdminOrders = lazy(() => import('./views/superadmin/Orders'));
const SuperAdminPartners = lazy(() => import('./views/superadmin/Partners'));
const SuperAdminCommando = lazy(() => import('./views/superadmin/Commando'));
const SuperAdminDevelopers = lazy(() => import('./views/superadmin/Developers'));
const SuperAdminSupervision = lazy(() => import('./views/superadmin/Supervision'));
const SuperAdminSettings = lazy(() => import('./views/superadmin/Settings'));
const PaddeCiAudits = lazy(() => import('./views/superadmin/PaddeCiAudits'));
const SuperAdminMissions = lazy(() => import('./views/superadmin/Missions'));
const PartnerDashboard = lazy(() => import('./views/partner/Dashboard'));
const PartnerClients = lazy(() => import('./views/partner/Clients'));
const PartnerCommissions = lazy(() => import('./views/partner/Commissions'));
const PartnerResources = lazy(() => import('./views/partner/Resources'));
const PartnerProfile = lazy(() => import('./views/partner/Profile'));
const PartnerReferrals = lazy(() => import('./views/partner/Referrals'));
const ModuleDashboard = lazy(() => import('./views/module/Dashboard'));

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Toaster
          position="bottom-center"
          containerClassName="!bottom-4 max-sm:!px-3 sm:!bottom-6"
          toastOptions={{
            duration: 4000,
            className: "!max-w-[min(100vw-1.5rem,22rem)] !text-sm",
          }}
        />
        <GoogleEmailModal />
        <GoogleConfirmModal />
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
            <Route path="/contact" element={<Navigate to="/signup" replace />} />
            <Route path="/a-propos" element={<About />} />
            
            {/* Legal Routes */}
            <Route path="/mentions-legales" element={<MentionsLegales />} />
            <Route path="/cgu" element={<CGU />} />
            <Route path="/cgv" element={<CGV />} />
            <Route path="/confidentialite" element={<PolitiqueConfidentialite />} />
            <Route path="/securite" element={<MarketingPage />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/cookies" element={<Cookies />} />

            <Route path="/login" element={<Login />} />
            <Route path="/login/staff" element={<Login isStaff />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/reset-password" element={<ResetPassword />} />
          </Route>
          
          {/* Module Routes */}
          <Route path="/module/:id/login" element={<Navigate to="/login" replace />} />
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
              <Route path="tickets" element={<AdminTickets />} />
              <Route path="messagerie" element={<AdminMessagerie />} />
              <Route path="dossiers" element={<AdminDossiers />} />
              <Route path="instances" element={<AdminInstances />} />
              <Route path="partners" element={<AdminPartners />} />
              <Route path="leads" element={<AdminLeads />} />
              <Route path="audits-padde" element={<PaddeCiAudits />} />
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
              <Route path="filleuls" element={<PartnerReferrals />} />
              <Route path="commissions" element={<PartnerCommissions />} />
              <Route path="ressources" element={<PartnerResources />} />
              <Route path="profil" element={<PartnerProfile />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
          </Suspense>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
