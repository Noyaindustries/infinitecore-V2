import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthProvider';

interface ProtectedRouteProps {
  allowedRoles?: string[];
}

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { user, userData, isAuthReady } = useAuth();

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2A4365]"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !userData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6 text-center">
        <p className="text-sm font-medium text-gray-700 max-w-md">
          Profil utilisateur introuvable dans la base. Un document <code className="font-mono text-xs">users/{'{votre UID}'}</code> avec un
          champ <code className="font-mono text-xs">role</code> (ex. <code className="font-mono text-xs">commando</code> ou{' '}
          <code className="font-mono text-xs">admin</code>) est requis pour accéder à cet espace.
        </p>
      </div>
    );
  }

  const role = typeof userData?.role === "string" ? userData.role : undefined;
  if (allowedRoles && userData && role && !allowedRoles.includes(role)) {
    // User is logged in but doesn't have the right role
    if (role === "admin") {
      return <Navigate to="/superadmin" replace />;
    } else if (role === "commando") {
      return <Navigate to="/admin" replace />;
    } else if (role === "developer") {
      return <Navigate to="/developer" replace />;
    } else if (role === "partner") {
      return <Navigate to="/partenaire" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
