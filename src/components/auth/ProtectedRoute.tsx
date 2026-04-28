import { useAuth } from '@/contexts/AuthContext';
import { Navigate, Outlet } from 'react-router-dom';
import { useEffect } from 'react';

const ProtectedRoute = () => {
  const { session, loading, signOut } = useAuth();

  // Limpa sessão expirada se necessário
  useEffect(() => {}, [session]);

  if (loading) {
    return (
      <div className="min-h-screen w-full bg-malibu-orange flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;