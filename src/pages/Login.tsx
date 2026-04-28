import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import AuthLayout from '@/components/layouts/AuthLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { showError } from '@/utils/toast';
import { Loader2, Lock, Mail, Activity } from 'lucide-react';

const Login = () => {
  const { loginWithNcSession } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    // 1. Tenta Supabase primeiro (usuários admin/originais)
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) { navigate('/dashboard'); setLoading(false); return; }

    // 2. Fallback: login NocoDB (usuários cadastrados via convite)
    try {
      const res    = await fetch('/api/nocodb-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const result = await res.json();
      if (res.ok && result.ok) {
        loginWithNcSession({ sessionToken: result.sessionToken, user: result.user });
        navigate('/dashboard');
        setLoading(false);
        return;
      }
    } catch { /* ignora erro de rede */ }

    showError('Email ou senha incorretos');
    setLoading(false);
  };

  return (
    <AuthLayout>
      {/* Logo + Branding */}
      <div className="text-center mb-10">
        <div className="relative inline-flex items-center justify-center mb-6">
          <div className="absolute inset-0 bg-primary/40 rounded-full blur-3xl scale-150 opacity-60" />
          <div className="relative z-10 p-3 rounded-2xl bg-primary/15 border border-primary/20">
            <img
              src="https://framerusercontent.com/images/hGJyQWRHAsnDQLAGF0vGRbNIkb0.png?scale-down-to=512"
              alt="Malibu"
              className="h-12 w-auto drop-shadow-2xl"
            />
          </div>
        </div>

        <h1 className="text-4xl font-black tracking-tighter text-white mb-1">
          MALIBU <span className="text-primary">BI</span>
        </h1>
        <p className="text-muted-foreground/50 font-bold text-[10px] uppercase tracking-[0.25em]">
          Painel Estratégico de Performance
        </p>

        {/* Stats badge */}
        <div className="inline-flex items-center gap-2 mt-4 px-4 py-1.5 rounded-full bg-white/5 border border-white/8">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
          </span>
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">
            11 unidades · dados em tempo real
          </span>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleLogin} className="space-y-4">
        {/* Email */}
        <div className="relative">
          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20 pointer-events-none" />
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@malibu.com"
            required
            className="h-14 rounded-2xl bg-white/[0.06] border-white/8 text-white placeholder:text-white/15 focus:border-primary/50 focus:ring-0 focus:bg-white/[0.08] transition-all font-semibold pl-11 pr-5"
          />
        </div>

        {/* Password */}
        <div className="relative">
          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20 pointer-events-none" />
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            className="h-14 rounded-2xl bg-white/[0.06] border-white/8 text-white placeholder:text-white/15 focus:border-primary/50 focus:ring-0 focus:bg-white/[0.08] transition-all font-semibold pl-11 pr-5"
          />
        </div>

        {/* Submit */}
        <div className="pt-2">
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-14 bg-primary hover:bg-primary/90 text-white font-black rounded-2xl text-sm tracking-wide shadow-[0_0_30px_rgba(242,140,29,0.25)] hover:shadow-[0_0_40px_rgba(242,140,29,0.45)] transition-all duration-500 active:scale-[0.98]"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <span className="flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Acessar o Painel
              </span>
            )}
          </Button>
        </div>
      </form>

      {/* Signup link */}
      <p className="text-center text-sm text-white/40 mt-8">
        Não tem conta?{' '}
        <Link to="/signup" className="font-bold text-primary hover:text-primary/80 transition-colors">
          Criar conta
        </Link>
      </p>

      {/* Footer */}
      <p className="text-center text-[9px] font-black uppercase tracking-[0.2em] text-white/15 mt-6">
        Malibu Exclusive &copy; {new Date().getFullYear()} · Todos os Direitos Reservados
      </p>
    </AuthLayout>
  );
};

export default Login;
