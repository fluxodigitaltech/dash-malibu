import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { profiles, invites as inviteApi } from '@/integrations/nocodb/client';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import AuthLayout from '@/components/layouts/AuthLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { showError } from '@/utils/toast';
import { Loader2, Lock, Mail, User, UserPlus } from 'lucide-react';

const Signup = () => {
  const { loginWithNcSession } = useAuth();
  const [searchParams] = useSearchParams();
  const [name, setName] = useState('');
  const [email, setEmail] = useState(decodeURIComponent(searchParams.get('email') || ''));
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const inviteToken = searchParams.get('invite') || null;
  const navigate = useNavigate();

  const handleSignup = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      let userId: string | undefined;

      if (inviteToken) {
        // Fluxo convite: 100% NocoDB — sem Supabase, sem verificação de email
        const res = await fetch('/api/invite-signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name, invite_token: inviteToken }),
        });
        const result = await res.json();
        if (!res.ok || result.error) {
          showError(result.error || 'Erro ao criar conta');
          setLoading(false);
          return;
        }
        // Inicia sessão NocoDB e redireciona direto
        loginWithNcSession({ sessionToken: result.sessionToken, user: result.user });
        navigate('/dashboard');
        return;
      } else {
        // Fluxo normal: signUp padrão do Supabase (pode pedir confirmação de email)
        const { data: signupData, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name } },
        });
        if (error) {
          showError(error.message);
          setLoading(false);
          return;
        }
        userId = signupData?.user?.id;
      }

      if (userId) {
        let role = 'viewer';
        let units: string = 'all';
        try {
          const invite = inviteToken
            ? await inviteApi.getByToken(inviteToken)
            : await inviteApi.getPendingByEmail(email);
          if (invite?.Id && invite.status === 'pending') {
            role = invite.role;
            units = invite.units ?? 'all';
            await inviteApi.accept(invite.Id);
          }
        } catch (err) {
          console.warn('[Signup] Erro ao verificar convite:', err);
        }

        const nameParts = name.trim().split(' ');
        try {
          await profiles.upsert({
            user_id: userId,
            first_name: nameParts[0] || null,
            last_name: nameParts.slice(1).join(' ') || null,
            avatar_url: null,
            role,
            email: email.toLowerCase(),
            units,
          });
        } catch (err) {
          console.warn('[Signup] Erro ao criar perfil NocoDB:', err);
        }
      }

      // Faz login direto
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        showError(signInError.message);
      } else {
        navigate('/dashboard');
      }
    } catch (err: any) {
      showError(err.message || 'Erro inesperado');
    } finally {
      setLoading(false);
    }
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
          Criar nova conta
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSignup} className="space-y-4">
        {/* Name */}
        <div className="relative">
          <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20 pointer-events-none" />
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome completo"
            required
            className="h-14 rounded-2xl bg-white/[0.06] border-white/8 text-white placeholder:text-white/15 focus:border-primary/50 focus:ring-0 focus:bg-white/[0.08] transition-all font-semibold pl-11 pr-5"
          />
        </div>

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
                <UserPlus className="h-4 w-4" />
                Criar Conta
              </span>
            )}
          </Button>
        </div>
      </form>

      {/* Login link */}
      <p className="text-center text-sm text-white/40 mt-8">
        Já tem uma conta?{' '}
        <Link to="/login" className="font-bold text-primary hover:text-primary/80 transition-colors">
          Fazer login
        </Link>
      </p>

      {/* Footer */}
      <p className="text-center text-[9px] font-black uppercase tracking-[0.2em] text-white/15 mt-6">
        Malibu Exclusive &copy; {new Date().getFullYear()} · Todos os Direitos Reservados
      </p>
    </AuthLayout>
  );
};

export default Signup;
