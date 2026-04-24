import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './AuthProvider';

interface ProtectedRouteProps {
  allowedRoles?: string[];
}

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { user, userData, isAuthReady } = useAuth();
  const roleFromProfile = typeof userData?.role === "string" ? userData.role : undefined;
  const roleFromAuth = typeof user?.role === "string" ? user.role : undefined;
  const effectiveRole = roleFromProfile || roleFromAuth;

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

  if (allowedRoles && !effectiveRole) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6 text-center">
        <p className="text-sm font-medium text-gray-700 max-w-md">
          Impossible de déterminer votre rôle. Vérifiez que votre compte contient un champ{" "}
          <code className="font-mono text-xs">role</code> (ex. <code className="font-mono text-xs">commando</code> ou{" "}
          <code className="font-mono text-xs">admin</code>), puis reconnectez-vous.
        </p>
      </div>
    );
  }

  if (allowedRoles && effectiveRole && !allowedRoles.includes(effectiveRole)) {
    // User is logged in but doesn't have the right role
    if (effectiveRole === "admin") {
      return <Navigate to="/superadmin" replace />;
    } else if (effectiveRole === "commando") {
      return <Navigate to="/admin" replace />;
    } else if (effectiveRole === "developer") {
      return <Navigate to="/developer" replace />;
    } else if (effectiveRole === "partner") {
      return <Navigate to="/partenaire" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
