import { useState, useEffect } from 'react';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import { profiles, invites, NcProfile, NcInvite } from '@/integrations/nocodb/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { showSuccess, showError } from '@/utils/toast';
import {
  Users, UserPlus, Shield, Eye, Crown, Mail,
  Loader2, Search, MoreVertical, Send, X, Clock, CheckCircle2, XCircle, Link2, Copy, Check, Building2, Globe,
} from 'lucide-react';

const ALL_UNITS = [
  'Americanas', 'Mogi Guaçu', 'Araçatuba', 'Piracicaba',
  'Presidente Prudente', 'São João', 'Araras', 'Mogi Mirim',
  'Paulínia', 'Malibu 24 Horas', 'Sorocaba',
];
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// ── Types ──
type UserProfile = NcProfile;
type Invite = NcInvite;

const ROLE_CONFIG: Record<UserRole, { label: string; icon: typeof Crown; color: string; bgColor: string; desc: string }> = {
  admin:   { label: 'Admin',        icon: Crown,  color: 'text-amber-400',  bgColor: 'bg-amber-500/10 border-amber-500/20', desc: 'Acesso total ao sistema' },
  manager: { label: 'Gerente',      icon: Shield, color: 'text-blue-400',   bgColor: 'bg-blue-500/10 border-blue-500/20',   desc: 'Visualiza tudo, sem gestão de usuários' },
  viewer:  { label: 'Visualizador', icon: Eye,    color: 'text-green-400',  bgColor: 'bg-green-500/10 border-green-500/20', desc: 'Somente leitura' },
};

// ── Component ──
const UserManagement = () => {
  const { user: currentUser, isAdmin } = useAuth();
  const [users, setUsers]         = useState<UserProfile[]>([]);
  const [inviteList, setInviteList] = useState<Invite[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [tab, setTab]             = useState<'users' | 'invites'>('users');

  // Invite form
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail]       = useState('');
  const [inviteRole, setInviteRole]         = useState<UserRole>('viewer');
  const [sendingInvite, setSendingInvite]   = useState(false);
  const [generatedLink, setGeneratedLink]   = useState<string | null>(null);
  const [copied, setCopied]                 = useState(false);
  const [unitsMode, setUnitsMode]           = useState<'all' | 'specific'>('all');
  const [selectedUnits, setSelectedUnits]   = useState<string[]>([]);

  useEffect(() => {
    if (isAdmin) loadData();
  }, [isAdmin]);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([loadUsers(), loadInvites()]);
    setLoading(false);
  };

  const loadUsers = async () => {
    try {
      const data = await profiles.list();
      setUsers(data);
    } catch (err: any) {
      console.warn('[Users] Erro ao carregar:', err.message);
    }
  };

  const loadInvites = async () => {
    try {
      const data = await invites.list();
      setInviteList(data);
    } catch (err: any) {
      console.warn('[Invites] Erro ao carregar:', err.message);
    }
  };

  const handleChangeRole = async (userId: string, newRole: UserRole) => {
    if (userId === currentUser?.id) {
      showError('Você não pode alterar seu próprio cargo');
      return;
    }
    try {
      await profiles.updateRole(userId, newRole);
      setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, role: newRole } : u));
      showSuccess(`Cargo atualizado para ${ROLE_CONFIG[newRole].label}`);
    } catch (err: any) {
      showError('Erro ao atualizar cargo: ' + err.message);
    }
  };

  const buildInviteLink = (token: string, email: string) =>
    `${window.location.origin}/signup?invite=${token}&email=${encodeURIComponent(email)}`;

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const sendInviteEmail = async (email: string, role: string, token: string) => {
    try {
      await fetch('/api/send-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          role,
          token,
          inviterName: currentUser?.user_metadata?.name || currentUser?.email || 'Administrador',
        }),
      });
    } catch {
      // Email é não-crítico — convite já foi criado no NocoDB
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    setSendingInvite(true);
    try {
      const existing = await invites.getPendingByEmail(inviteEmail.trim());
      if (existing) {
        showError('Já existe um convite pendente para este email');
        setSendingInvite(false);
        return;
      }
      const unitsValue = unitsMode === 'all' ? 'all' : JSON.stringify(selectedUnits);
      const created = await invites.create(inviteEmail.trim(), inviteRole, currentUser?.id ?? null, unitsValue);
      await sendInviteEmail(created.email, created.role, created.token);
      const link = buildInviteLink(created.token, created.email);
      setGeneratedLink(link);
      await loadInvites();
    } catch (err: any) {
      showError('Erro ao criar convite: ' + err.message);
    } finally {
      setSendingInvite(false);
    }
  };

  const handleRevokeInvite = async (invite: Invite) => {
    if (!invite.Id) return;
    try {
      await invites.revoke(invite.Id);
      showSuccess('Convite revogado');
      await loadInvites();
    } catch (err: any) {
      showError('Erro ao revogar: ' + err.message);
    }
  };

  const handleResendInvite = async (invite: Invite) => {
    if (!invite.Id) return;
    try {
      await invites.revoke(invite.Id);
      const created = await invites.create(invite.email, invite.role as UserRole, currentUser?.id ?? null);
      await sendInviteEmail(created.email, created.role, created.token);
      showSuccess(`Convite reenviado para ${invite.email}`);
      await loadInvites();
    } catch (err: any) {
      showError('Erro ao reenviar: ' + err.message);
    }
  };

  // Filter
  const filteredUsers = users.filter(u => {
    const name = `${u.first_name || ''} ${u.last_name || ''} ${u.email || ''}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const pendingInvites = inviteList.filter(i => i.status === 'pending');
  const historyInvites = inviteList.filter(i => i.status !== 'pending');

  const getInitials = (u: UserProfile) => {
    const f = u.first_name?.[0] || '';
    const l = u.last_name?.[0] || '';
    return (f + l).toUpperCase() || 'U';
  };

  const formatDate = (d: string | null | undefined) => {
    if (!d) return '-';
    try { return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }); }
    catch { return '-'; }
  };

  // ── Access guard ──
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 animate-in fade-in duration-700">
        <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20">
          <Shield className="h-8 w-8 text-red-400" />
        </div>
        <h2 className="text-xl font-black text-white">Acesso Restrito</h2>
        <p className="text-sm text-muted-foreground/50">Somente administradores podem acessar esta área.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 p-6 lg:p-10 max-w-[1200px] mx-auto animate-in fade-in duration-700">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-primary/15 border border-primary/20">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tighter">
              Gestão de <span className="text-primary">Usuários</span>
            </h1>
          </div>
          <p className="text-sm text-muted-foreground/50 font-medium">
            Gerencie acessos, permissões e convites da plataforma
          </p>
        </div>

        <Button
          onClick={() => setShowInviteForm(true)}
          className="h-12 px-6 bg-primary hover:bg-primary/90 text-white font-bold rounded-2xl shadow-[0_0_20px_rgba(242,140,29,0.2)] hover:shadow-[0_0_30px_rgba(242,140,29,0.4)] transition-all"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Convidar Usuário
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card glow-border rounded-2xl p-5">
          <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">Total Usuários</p>
          <p className="text-2xl font-black text-white mt-1">{users.length}</p>
        </div>
        <div className="glass-card glow-border rounded-2xl p-5">
          <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">Convites Pendentes</p>
          <p className="text-2xl font-black text-amber-400 mt-1">{pendingInvites.length}</p>
        </div>
        <div className="glass-card glow-border rounded-2xl p-5">
          <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">Admins</p>
          <p className="text-2xl font-black text-primary mt-1">{users.filter(u => u.role === 'admin').length}</p>
        </div>
      </div>

      {/* Invite Form Modal */}
      {showInviteForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="glass-card glow-border rounded-3xl p-8 w-full max-w-md animate-in slide-in-from-bottom-5 duration-500">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-black text-white flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                Convidar Usuário
              </h3>
              <Button variant="ghost" size="icon" onClick={() => { setShowInviteForm(false); setGeneratedLink(null); setInviteEmail(''); setInviteRole('viewer'); setUnitsMode('all'); setSelectedUnits([]); }} className="text-muted-foreground/40 hover:text-white">
                <X className="h-5 w-5" />
              </Button>
            </div>

            {generatedLink ? (
              <div className="space-y-5">
                <div className="p-4 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0" />
                  <p className="text-sm font-bold text-green-400">Convite criado com sucesso!</p>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest ml-1">Link de Acesso</label>
                  <div className="flex gap-2">
                    <div className="flex-1 bg-white/[0.04] border border-white/8 rounded-2xl px-4 py-3 overflow-hidden">
                      <p className="text-xs text-primary/80 font-mono break-all leading-relaxed">{generatedLink}</p>
                    </div>
                    <Button
                      type="button"
                      onClick={() => copyToClipboard(generatedLink)}
                      className="shrink-0 h-auto px-4 bg-primary/15 hover:bg-primary/25 text-primary border border-primary/20 rounded-2xl transition-all"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-[10px] text-muted-foreground/30 ml-1">Copie e envie este link para o usuário. Expira em 7 dias.</p>
                </div>
                <Button
                  type="button"
                  onClick={() => { setGeneratedLink(null); setInviteEmail(''); setInviteRole('viewer'); setUnitsMode('all'); setSelectedUnits([]); }}
                  className="w-full h-12 bg-white/5 hover:bg-white/10 text-white/60 font-bold rounded-2xl transition-all"
                >
                  Criar Outro Convite
                </Button>
              </div>
            ) : (
            <form onSubmit={handleSendInvite} className="space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest ml-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
                  <Input
                    type="email"
                    value={inviteEmail}
                    onChange={e => setInviteEmail(e.target.value)}
                    placeholder="usuario@malibu.com"
                    required
                    className="h-14 rounded-2xl bg-white/[0.06] border-white/8 text-white placeholder:text-white/15 pl-11 pr-5 focus:border-primary/50"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest ml-1">Cargo</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(ROLE_CONFIG) as UserRole[]).map(r => {
                    const cfg = ROLE_CONFIG[r];
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setInviteRole(r)}
                        className={cn(
                          "flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-center",
                          inviteRole === r
                            ? `${cfg.bgColor} ${cfg.color} border-current`
                            : "bg-white/[0.03] border-white/5 text-muted-foreground/40 hover:bg-white/[0.06]"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">{cfg.label}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-muted-foreground/30 ml-1 mt-1">{ROLE_CONFIG[inviteRole].desc}</p>
              </div>

              {/* Unit access */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest ml-1">Acesso às Unidades</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setUnitsMode('all')}
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-xl border transition-all",
                      unitsMode === 'all'
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "bg-white/[0.03] border-white/5 text-muted-foreground/40 hover:bg-white/[0.06]"
                    )}
                  >
                    <Globe className="h-4 w-4 shrink-0" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Rede Completa</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUnitsMode('specific')}
                    className={cn(
                      "flex items-center gap-2 p-3 rounded-xl border transition-all",
                      unitsMode === 'specific'
                        ? "bg-blue-500/10 border-blue-500/30 text-blue-400"
                        : "bg-white/[0.03] border-white/5 text-muted-foreground/40 hover:bg-white/[0.06]"
                    )}
                  >
                    <Building2 className="h-4 w-4 shrink-0" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Unidade(s)</span>
                  </button>
                </div>

                {unitsMode === 'specific' && (
                  <div className="grid grid-cols-2 gap-1.5 mt-2 max-h-44 overflow-y-auto pr-1">
                    {ALL_UNITS.map(unit => {
                      const checked = selectedUnits.includes(unit);
                      return (
                        <button
                          key={unit}
                          type="button"
                          onClick={() => setSelectedUnits(prev =>
                            checked ? prev.filter(u => u !== unit) : [...prev, unit]
                          )}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all",
                            checked
                              ? "bg-blue-500/10 border-blue-500/30 text-blue-300"
                              : "bg-white/[0.03] border-white/5 text-muted-foreground/40 hover:bg-white/[0.06]"
                          )}
                        >
                          <div className={cn("h-3 w-3 rounded-sm border shrink-0 flex items-center justify-center", checked ? "bg-blue-500 border-blue-500" : "border-white/20")}>
                            {checked && <Check className="h-2 w-2 text-white" />}
                          </div>
                          <span className="text-[10px] font-semibold truncate">{unit}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {unitsMode === 'specific' && selectedUnits.length === 0 && (
                  <p className="text-[10px] text-amber-400/60 ml-1">Selecione ao menos uma unidade</p>
                )}
              </div>

              <Button
                type="submit"
                disabled={sendingInvite || (unitsMode === 'specific' && selectedUnits.length === 0)}
                className="w-full h-14 bg-primary hover:bg-primary/90 text-white font-black rounded-2xl shadow-[0_0_20px_rgba(242,140,29,0.2)] transition-all"
              >
                {sendingInvite ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <span className="flex items-center gap-2">
                    <Send className="h-4 w-4" />
                    Criar Convite
                  </span>
                )}
              </Button>
            </form>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('users')}
          className={cn(
            "px-5 py-2.5 rounded-xl text-sm font-bold transition-all",
            tab === 'users'
              ? "bg-primary/15 text-primary border border-primary/20"
              : "text-muted-foreground/40 hover:text-white hover:bg-white/5"
          )}
        >
          <Users className="h-4 w-4 inline mr-2" />
          Usuários ({users.length})
        </button>
        <button
          onClick={() => setTab('invites')}
          className={cn(
            "px-5 py-2.5 rounded-xl text-sm font-bold transition-all",
            tab === 'invites'
              ? "bg-primary/15 text-primary border border-primary/20"
              : "text-muted-foreground/40 hover:text-white hover:bg-white/5"
          )}
        >
          <Mail className="h-4 w-4 inline mr-2" />
          Convites ({pendingInvites.length})
        </button>
      </div>

      {/* Search */}
      {tab === 'users' && (
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-white/20" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar usuário por nome ou email..."
            className="h-12 rounded-2xl bg-white/[0.04] border-white/5 text-white placeholder:text-white/15 pl-11 focus:border-primary/50"
          />
        </div>
      )}

      {/* Users List */}
      {tab === 'users' && (
        <div className="space-y-3">
          {filteredUsers.map(u => {
            const roleCfg = ROLE_CONFIG[u.role as UserRole] || ROLE_CONFIG.viewer;
            const RoleIcon = roleCfg.icon;
            const isCurrentUser = u.user_id === currentUser?.id;

            return (
              <div
                key={u.user_id}
                className={cn(
                  "glass-card glow-border rounded-2xl p-5 flex items-center gap-4 transition-all duration-300 hover:bg-[#1c1c27]/80",
                  isCurrentUser && "border-primary/20"
                )}
              >
                <Avatar className="h-12 w-12 border border-white/10">
                  <AvatarImage src={u.avatar_url || ''} />
                  <AvatarFallback className="bg-primary/20 text-primary font-black text-sm">{getInitials(u)}</AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-sm truncate">
                    {(u.first_name || u.last_name)
                      ? `${u.first_name || ''} ${u.last_name || ''}`.trim()
                      : (u.email?.split('@')[0] || u.user_id.slice(0, 8))}
                    {isCurrentUser && <span className="text-primary ml-1">(você)</span>}
                  </p>
                  <p className="text-[11px] text-muted-foreground/40 truncate">{u.email || u.user_id.slice(0, 12) + '...'}</p>
                </div>

                {/* Role badge */}
                <div className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider", roleCfg.bgColor, roleCfg.color)}>
                  <RoleIcon className="h-3 w-3" />
                  {roleCfg.label}
                </div>

                {/* Actions */}
                {!isCurrentUser && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-muted-foreground/30 hover:text-white">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="bg-[#11111a] border-white/5 rounded-xl p-1" align="end">
                      {(Object.keys(ROLE_CONFIG) as UserRole[]).map(r => {
                        const cfg = ROLE_CONFIG[r];
                        const Icon = cfg.icon;
                        return (
                          <DropdownMenuItem
                            key={r}
                            onClick={() => handleChangeRole(u.user_id, r)}
                            className={cn(
                              "cursor-pointer rounded-lg h-9 text-sm font-semibold",
                              u.role === r ? `${cfg.color} bg-white/5` : "text-muted-foreground/60 hover:text-white"
                            )}
                          >
                            <Icon className="mr-2 h-3.5 w-3.5" />
                            {u.role === r ? `${cfg.label} (atual)` : `Tornar ${cfg.label}`}
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            );
          })}

          {filteredUsers.length === 0 && (
            <div className="text-center py-12 text-muted-foreground/30">
              <Users className="h-8 w-8 mx-auto mb-2" />
              <p className="font-bold text-sm">Nenhum usuário encontrado</p>
            </div>
          )}
        </div>
      )}

      {/* Invites Tab */}
      {tab === 'invites' && (
        <div className="space-y-6">
          {/* Pending */}
          {pendingInvites.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">Pendentes</h3>
              {pendingInvites.map(inv => {
                const roleCfg = ROLE_CONFIG[inv.role as UserRole] || ROLE_CONFIG.viewer;
                const isExpired = inv.expires_at ? new Date(inv.expires_at) < new Date() : false;
                return (
                  <div key={inv.Id} className="glass-card glow-border rounded-2xl p-5 flex items-center gap-4">
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                      <Clock className="h-4 w-4 text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white text-sm">{inv.email}</p>
                      <p className="text-[10px] text-muted-foreground/40">
                        Criado em {formatDate(inv.created_at)} · {isExpired ? 'Expirado' : `Expira em ${formatDate(inv.expires_at)}`}
                      </p>
                    </div>
                    <div className={cn("px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider", roleCfg.bgColor, roleCfg.color)}>
                      {roleCfg.label}
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => copyToClipboard(buildInviteLink(inv.token, inv.email))} className="text-muted-foreground/30 hover:text-primary h-8 w-8" title="Copiar link de convite">
                        <Link2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleResendInvite(inv)} className="text-muted-foreground/30 hover:text-blue-400 h-8 w-8" title="Recriar convite">
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleRevokeInvite(inv)} className="text-muted-foreground/30 hover:text-red-400 h-8 w-8" title="Revogar">
                        <XCircle className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* History */}
          {historyInvites.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">Histórico</h3>
              {historyInvites.map(inv => {
                const roleCfg = ROLE_CONFIG[inv.role as UserRole] || ROLE_CONFIG.viewer;
                const StatusIcon = inv.status === 'accepted' ? CheckCircle2 : XCircle;
                const statusColor = inv.status === 'accepted' ? 'text-green-400' : 'text-red-400';
                return (
                  <div key={inv.Id} className="glass-card rounded-2xl p-4 flex items-center gap-4 opacity-60">
                    <div className={cn("p-2 rounded-xl", inv.status === 'accepted' ? 'bg-green-500/10' : 'bg-red-500/10')}>
                      <StatusIcon className={cn("h-4 w-4", statusColor)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white/60 text-sm">{inv.email}</p>
                      <p className="text-[10px] text-muted-foreground/30">
                        {inv.status === 'accepted'
                          ? `Aceito em ${formatDate(inv.accepted_at)}`
                          : `Revogado · ${formatDate(inv.created_at)}`}
                      </p>
                    </div>
                    <div className={cn("px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider opacity-60", roleCfg.color)}>
                      {roleCfg.label}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {inviteList.length === 0 && (
            <div className="text-center py-12 text-muted-foreground/30">
              <Mail className="h-8 w-8 mx-auto mb-2" />
              <p className="font-bold text-sm">Nenhum convite criado ainda</p>
              <p className="text-xs mt-1">Clique em "Convidar Usuário" para começar</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default UserManagement;
