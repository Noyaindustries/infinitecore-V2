import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './FirebaseProvider';

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

  if (allowedRoles && userData && !allowedRoles.includes(userData.role)) {
    // User is logged in but doesn't have the right role
    if (userData.role === 'admin') {
      return <Navigate to="/superadmin" replace />;
    } else if (userData.role === 'commando') {
      return <Navigate to="/admin" replace />;
    } else if (userData.role === 'developer') {
      return <Navigate to="/developer" replace />;
    } else if (userData.role === 'partner') {
      return <Navigate to="/partenaire" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
