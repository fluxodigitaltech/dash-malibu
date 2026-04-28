// src/pages/TVDashboard.tsx
// Kiosk/TV mode — no authentication required, reads cached data from NocoDB.
// Access via /tv in the browser. Designed for 1080p/4K displays running 24/7.

import { useEffect, useState, useCallback } from 'react';
import { dashboardSync } from '@/integrations/nocodb/client';
import { SyncData } from '@/utils/pactoSync';
import { Users, DollarSign, Activity, UserX, Dumbbell, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes

const formatCurrency = (v: number) => {
  if (!v) return 'R$ 0';
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}K`;
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
};

interface Metric { label: string; value: string | number; sub?: string; color: string; icon: typeof Users }

const TVDashboard = () => {
  const [data, setData] = useState<SyncData | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(navigator.onLine);

  const load = useCallback(async () => {
    try {
      setError(null);
      const row = await dashboardSync.getLatest();
      if (row) {
        setData(JSON.parse(row.data));
        setLastUpdated(new Date(row.last_updated));
      }
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, REFRESH_INTERVAL);
    const onOnline  = () => { setOnline(true);  load(); };
    const onOffline = () => setOnline(false);
    window.addEventListener('online',  onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      clearInterval(interval);
      window.removeEventListener('online',  onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [load]);

  const cd = data?.clientData;
  const total    = (cd?.activeClients || 0) + (cd?.gympassClients || 0);
  const revenue  = cd?.totalRealRevenue || 0;
  const avgTicket = cd?.activeClients ? revenue / cd.activeClients : 0;

  const metrics: Metric[] = [
    { label: 'Alunos Ativos', value: cd?.activeClients ?? '—', sub: 'contratos regulares', color: 'text-green-400', icon: Users },
    { label: 'Wellhub / Gympass', value: cd?.gympassClients ?? '—', sub: 'agregadores', color: 'text-blue-400', icon: Dumbbell },
    { label: 'Total na Base', value: total || '—', sub: 'ativos + Gympass', color: 'text-primary', icon: Activity },
    { label: 'Inadimplentes', value: cd?.delinquentClients ?? '—', sub: 'contratos em atraso', color: 'text-red-400', icon: UserX },
    { label: 'Faturamento Mês', value: formatCurrency(revenue), sub: 'mês atual', color: 'text-amber-400', icon: DollarSign },
    { label: 'Ticket Médio', value: formatCurrency(avgTicket), sub: 'por aluno ativo', color: 'text-purple-400', icon: DollarSign },
  ];

  // Unit breakdown
  const units = cd?.clientsByCompany
    ? Object.entries(cd.clientsByCompany)
        .sort(([, a], [, b]) => (b.active + b.gympass) - (a.active + a.gympass))
    : [];

  return (
    <div
      className="min-h-screen bg-[#0e0d15] text-white flex flex-col select-none overflow-hidden"
      style={{ fontFamily: 'Inter, sans-serif' }}
    >
      {/* Header */}
      <header className="flex items-center justify-between px-12 py-6 border-b border-white/5 bg-[#0e0d15]">
        <div className="flex items-center gap-4">
          <img
            src="https://framerusercontent.com/images/hGJyQWRHAsnDQLAGF0vGRbNIkb0.png?scale-down-to=512"
            alt="Malibu"
            className="h-10 w-auto"
          />
          <div>
            <h1 className="text-2xl font-black tracking-tighter">MALIBU <span className="text-[#F28C1D]">BI</span></h1>
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/30">Painel Estratégico · Tempo Real</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          {/* Online/Offline indicator */}
          <div className={cn("flex items-center gap-2 text-xs font-bold uppercase tracking-wider", online ? "text-green-400" : "text-red-400")}>
            {online ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
            {online ? 'Online' : 'Offline'}
          </div>

          {/* Last sync */}
          {lastUpdated && (
            <div className="text-right">
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Última atualização</p>
              <p className="text-sm font-bold text-white/60">{format(lastUpdated, "dd/MM HH:mm", { locale: ptBR })}</p>
            </div>
          )}

          {/* Clock */}
          <Clock />
        </div>
      </header>

      {/* Loading */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <RefreshCw className="h-12 w-12 text-[#F28C1D] animate-spin mx-auto mb-4" />
            <p className="text-white/40 font-bold uppercase tracking-widest text-sm">Carregando dados...</p>
          </div>
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <WifiOff className="h-12 w-12 text-red-400 mx-auto" />
            <p className="text-red-400 font-bold">{error}</p>
            <button
              onClick={load}
              className="px-6 py-2 bg-[#F28C1D] text-white font-bold rounded-xl hover:bg-[#F28C1D]/80 transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      )}

      {/* Dashboard */}
      {!loading && !error && data && (
        <main className="flex-1 p-10 space-y-8 overflow-hidden">

          {/* Metric cards */}
          <div className="grid grid-cols-6 gap-4">
            {metrics.map(m => {
              const Icon = m.icon;
              return (
                <div
                  key={m.label}
                  className="rounded-2xl bg-white/[0.04] border border-white/[0.06] p-5 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/30">{m.label}</p>
                    <Icon className={cn("h-4 w-4", m.color)} />
                  </div>
                  <p className={cn("text-3xl font-black tracking-tight", m.color)}>{m.value}</p>
                  <p className="text-[10px] text-white/20 font-medium">{m.sub}</p>
                </div>
              );
            })}
          </div>

          {/* Unit breakdown table */}
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.05] overflow-hidden">
            <div className="px-8 py-4 border-b border-white/[0.05] flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-widest text-white/50">Performance por Unidade</h2>
              <p className="text-xs text-white/20">{units.length} unidades</p>
            </div>
            <div className="grid grid-cols-2 gap-0 divide-x divide-white/[0.04]">
              {units.map(([name, stats], i) => {
                const total = stats.active + stats.gympass;
                return (
                  <div
                    key={name}
                    className={cn("flex items-center gap-4 px-8 py-3", i % 2 === 1 ? "" : "")}
                  >
                    <div className="w-3 h-3 rounded-full bg-[#F28C1D]/60 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white/80 truncate">{name}</p>
                    </div>
                    <div className="flex items-center gap-6 text-right">
                      <div>
                        <p className="text-xs text-white/20 uppercase tracking-wide">Ativos</p>
                        <p className="text-sm font-black text-green-400">{stats.active}</p>
                      </div>
                      <div>
                        <p className="text-xs text-white/20 uppercase tracking-wide">Gympass</p>
                        <p className="text-sm font-black text-blue-400">{stats.gympass}</p>
                      </div>
                      <div>
                        <p className="text-xs text-white/20 uppercase tracking-wide">Total</p>
                        <p className="text-sm font-black text-white">{total}</p>
                      </div>
                      <div>
                        <p className="text-xs text-white/20 uppercase tracking-wide">Fatura</p>
                        <p className="text-sm font-black text-amber-400">{formatCurrency(stats.realRevenue)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </main>
      )}

      {/* Footer bar */}
      <footer className="px-12 py-3 border-t border-white/5 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-white/15">
        <span>Malibu Exclusive &copy; {new Date().getFullYear()}</span>
        <span>Atualização automática a cada 30 min</span>
        <span>malibu-bi.vercel.app</span>
      </footer>
    </div>
  );
};

// Real-time clock component
const Clock = () => {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="text-right">
      <p className="text-2xl font-black tabular-nums text-white">
        {format(time, 'HH:mm')}
      </p>
      <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">
        {format(time, "EEE, dd/MM", { locale: ptBR })}
      </p>
    </div>
  );
};

export default TVDashboard;
