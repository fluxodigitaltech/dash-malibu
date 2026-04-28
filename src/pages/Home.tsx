import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react'; // Importar o ícone Loader2

const Home = () => {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (session) {
        navigate('/dashboard', { replace: true });
      } else {
        navigate('/login', { replace: true });
      }
    }
  }, [session, loading, navigate]);

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-malibu-orange to-malibu-gold flex items-center justify-center">
      <div className="flex flex-col items-center space-y-4">
        <Loader2 className="h-16 w-16 text-white animate-spin" />
        <p className="text-white text-lg font-semibold">Carregando...</p>
      </div>
    </div>
  );
};

export default Home;