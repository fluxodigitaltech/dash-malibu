import { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Session, User } from '@supabase/supabase-js';
import { profiles } from '@/integrations/nocodb/client';

export type UserRole = 'admin' | 'manager' | 'viewer';

const NC_SESSION_KEY = 'malibu_nc_session';

interface NcSessionData {
  sessionToken: string;
  user: { id: string; email: string; name: string; role: string; units: string };
}

interface AuthContextType {
  session: Session | NcSessionData | null;
  user: User | { id: string; email: string; user_metadata: { name: string } } | null;
  role: UserRole;
  loading: boolean;
  isAdmin: boolean;
  isManager: boolean;
  allowedUnits: string[] | 'all';
  refreshRole: () => Promise<void>;
  signOut: () => Promise<void>;
  loginWithNcSession: (data: NcSessionData) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession]           = useState<Session | NcSessionData | null>(null);
  const [user, setUser]                 = useState<AuthContextType['user']>(null);
  const [role, setRole]                 = useState<UserRole>('viewer');
  const [allowedUnits, setAllowedUnits] = useState<string[] | 'all'>('all');
  const [loading, setLoading]           = useState(true);

  const parseUnits = (units: string | null | undefined): string[] | 'all' => {
    if (!units || units === 'all') return 'all';
    try { return JSON.parse(units); } catch { return 'all'; }
  };

  // ── NocoDB session helpers ──────────────────────────────────────────────────

  const loadNcSession = (): NcSessionData | null => {
    try {
      const raw = localStorage.getItem(NC_SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  };

  const saveNcSession = (data: NcSessionData) => {
    localStorage.setItem(NC_SESSION_KEY, JSON.stringify(data));
  };

  const clearNcSession = () => {
    localStorage.removeItem(NC_SESSION_KEY);
  };

  const applyNcSession = (data: NcSessionData) => {
    setSession(data);
    setUser({
      id: data.user.id,
      email: data.user.email,
      user_metadata: { name: data.user.name },
    });
    setRole((data.user.role as UserRole) || 'viewer');
    setAllowedUnits(parseUnits(data.user.units));
  };

  // ── Supabase role fetch ─────────────────────────────────────────────────────

  const fetchRole = async (userId: string, userEmail?: string, isInitialLoad = false) => {
    try {
      let result = await Promise.race([
        profiles.getByUserId(userId),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
      ]);

      if (!result && userEmail) {
        result = await profiles.getByEmail(userEmail).catch(() => null);
        if (result?.Id) {
          profiles.linkUserId(result.Id, userId).catch(() => {});
        }
      }

      if (result?.role) {
        setRole(result.role as UserRole);
        setAllowedUnits(parseUnits(result.units));
      } else if (isInitialLoad) {
        if (userEmail) {
          try {
            await profiles.upsert({
              user_id: userId,
              first_name: null,
              last_name: null,
              avatar_url: null,
              role: 'viewer',
              email: userEmail,
            });
          } catch (e) {
            console.warn('[Auth] Erro ao criar perfil NocoDB:', e);
          }
        }
        setRole('viewer');
        setAllowedUnits('all');
      }
    } catch (e) {
      console.warn('[Auth] fetchRole erro NocoDB:', e);
      if (isInitialLoad) { setRole('viewer'); setAllowedUnits('all'); }
    }
  };

  const refreshRole = async () => {
    // NocoDB session: re-validate token
    const nc = loadNcSession();
    if (nc) {
      const fresh = await profiles.getBySessionToken(nc.sessionToken).catch(() => null);
      if (fresh) {
        setRole((fresh.role as UserRole) || 'viewer');
        setAllowedUnits(parseUnits(fresh.units));
      }
      return;
    }
    // Supabase session
    const sbUser = (await supabase.auth.getUser()).data.user;
    if (sbUser?.id) await fetchRole(sbUser.id, sbUser.email ?? undefined, true);
  };

  // Inicia sessão NocoDB atualizando estado React + localStorage
  const loginWithNcSession = (data: NcSessionData) => {
    saveNcSession(data);
    applyNcSession(data);
  };

  const signOut = async () => {
    clearNcSession();
    setSession(null);
    setUser(null);
    setRole('viewer');
    setAllowedUnits('all');
    await supabase.auth.signOut().catch(() => {});
  };

  // ── Mount: decide which session type to use ─────────────────────────────────

  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      setLoading((prev) => { if (prev) { console.warn('[Auth] Safety timeout'); return false; } return prev; });
    }, 5000);

    const init = async () => {
      // 1. Check NocoDB session first
      const nc = loadNcSession();
      if (nc) {
        // Validate against NocoDB (refresh role/units)
        const fresh = await profiles.getBySessionToken(nc.sessionToken).catch(() => null);
        if (fresh) {
          const updated: NcSessionData = {
            ...nc,
            user: { ...nc.user, role: fresh.role || 'viewer', units: fresh.units || 'all' },
          };
          saveNcSession(updated);
          applyNcSession(updated);
        } else {
          // Token revogado ou inválido
          clearNcSession();
        }
        setLoading(false);
        clearTimeout(safetyTimer);
        return;
      }

      // 2. Fall back to Supabase session
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user?.id) {
          await fetchRole(session.user.id, session.user.email ?? undefined, true);
        }
      } catch (e) {
        console.error('[Auth] Erro ao obter sessão:', e);
      } finally {
        setLoading(false);
        clearTimeout(safetyTimer);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (loadNcSession()) return; // NocoDB session takes priority
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user?.id) {
        await fetchRole(session.user.id, session.user.email ?? undefined, false);
      } else {
        setRole('viewer');
        setAllowedUnits('all');
      }
    });

    return () => { subscription.unsubscribe(); clearTimeout(safetyTimer); };
  }, []);

  const value: AuthContextType = {
    session,
    user,
    role,
    loading,
    isAdmin:           role === 'admin',
    isManager:         role === 'admin' || role === 'manager',
    allowedUnits,
    refreshRole,
    signOut,
    loginWithNcSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

// Helper used by Signup and Login pages to start a NocoDB session
export const startNcSession = (data: NcSessionData) => {
  localStorage.setItem(NC_SESSION_KEY, JSON.stringify(data));
};
