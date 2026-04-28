import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Users, DollarSign, Loader2, Activity, Dumbbell, UserX, UserCheck, Wallet, AlertTriangle, FileDown } from 'lucide-react';
import StatCard from '@/components/dashboard/StatCard';
import UnitSummaryTable from '@/components/dashboard/UnitSummaryTable';
import ClientOverviewChart from '@/components/dashboard/ClientOverviewChart';
import { Button } from '@/components/ui/button';
import UnitSelector from '@/components/dashboard/UnitSelector';
import ExpirationLevels from '@/components/dashboard/ExpirationLevels';
import ClientCategoryBreakdown from '@/components/dashboard/ClientCategoryBreakdown';
import { format } from 'date-fns';
import { useFilteredPactoData as usePactoData } from '@/hooks/useFilteredPactoData';
import { cn } from '@/lib/utils';
import { generateSyncReport } from '@/utils/generateReport';

const Dashboard = () => {
  const {
    data: globalData,
    lastUpdated,
    syncing,
    syncPactoData,
    syncProgress
  } = usePactoData();

  const { allowedUnits } = useAuth();
  const [selectedUnit, setSelectedUnit] = useState<string>('all');

  // Se o usuário só tem acesso a uma unidade, seleciona ela automaticamente
  useEffect(() => {
    if (Array.isArray(allowedUnits) && allowedUnits.length === 1) {
      setSelectedUnit(allowedUnits[0]);
    }
  }, [allowedUnits]);

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

  const formatCurrencyCompact = (v: number) => {
    if (!v) return 'R$ 0';
    if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace('.', ',')}M`;
    if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(0)}K`;
    return formatCurrency(v);
  };

  const clientDataResult = globalData?.clientData;
  const companyOptions = globalData?.companyOptions || [];

  // Get stats for selected unit — fallback to 'all' if unit key doesn't exist yet
  const emptyStats = {
    active: 0, visitor: 0, gympass: 0, delinquent: 0, other: 0, total: 0,
    realRevenue: 0, expiringToday: 0, expiringInMonth: 0, expiringInThreeMonths: 0,
    expired: 0, delinquent1Month: 0, delinquent2Months: 0, delinquent3Months: 0, delinquent4PlusMonths: 0
  };

  const unitStats = selectedUnit !== 'all'
    ? (clientDataResult?.clientsByCompany?.[selectedUnit] ?? emptyStats)
    : emptyStats;

  const stats = selectedUnit === 'all'
    ? (clientDataResult ?? emptyStats as any)
    : unitStats;

  // For "all" mode, prefer totalRealRevenue (recalculated after Wellhub injection)
  // over realRevenue which may be stale from old cached data
  const effectiveRevenue = selectedUnit === 'all'
    ? (clientDataResult?.totalRealRevenue || clientDataResult?.realRevenue || 0)
    : (stats.realRevenue || 0);

  const totalStudents = (stats.active || 0) + (stats.gympass || 0);
  const avgTicket     = stats.active > 0 ? effectiveRevenue / stats.active : 0;

  const prevRevenue = (selectedUnit === 'all'
    ? (clientDataResult?.prevRevenue ?? 0)
    : (unitStats as any).prevRevenue ?? 0) as number;

  const revenueTrend = prevRevenue > 0 ? {
    value: Math.abs(Math.round((effectiveRevenue - prevRevenue) / prevRevenue * 100)),
    isPositive: effectiveRevenue >= prevRevenue,
  } : undefined;

  const syncErrors = globalData?.syncErrors ?? [];

  return (
    <div className="space-y-10 p-6 lg:p-10 max-w-[1800px] 2xl:max-w-full mx-auto animate-in fade-in duration-700">

      {/* ── Header ── */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-primary/20 text-primary shadow-[0_0_15px_rgba(242,140,29,0.3)]">
              <Activity className="h-6 w-6" />
            </div>
            <h1 className="text-4xl font-black tracking-tighter text-white">Dashboard <span className="text-primary">BI</span></h1>
          </div>
          {lastUpdated && (
            <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-2xl border border-white/5 mt-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${syncing ? 'bg-amber-400' : 'bg-green-400'} opacity-75`} />
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${syncing ? 'bg-amber-500' : 'bg-green-500'}`} />
              </span>
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">
                {syncing ? 'Sincronizando...' : 'Cache Ativo (6h)'}
              </span>
              <div className="w-px h-3 bg-white/10" />
              <p className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest">
                Ref: {format(new Date(lastUpdated), 'dd/MM HH:mm:ss')}
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4">
          {syncing && globalData?.clientData && (
            <div className="hidden sm:flex flex-col items-end gap-2 pr-4 border-r border-white/5">
              <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em] animate-pulse">
                Network Sync {Math.round(syncProgress)}%
              </span>
              <div className="w-32 h-1 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all duration-500" style={{ width: `${syncProgress}%` }} />
              </div>
            </div>
          )}
          {globalData && !syncing && (
            <Button
              onClick={() => generateSyncReport(globalData, syncErrors)}
              variant="ghost"
              className="h-12 px-6 rounded-2xl bg-primary/10 hover:bg-primary/20 text-primary font-bold border border-primary/20 hover:border-primary/30 transition-all flex items-center gap-3"
            >
              <FileDown className="h-4 w-4" />
              Exportar Relatório
            </Button>
          )}
          <Button
            onClick={() => syncPactoData(true)}
            variant="ghost"
            disabled={syncing}
            className="h-12 px-6 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold border border-white/5 hover:border-white/10 transition-all flex items-center gap-3"
          >
            <Loader2 className={cn("h-4 w-4", syncing ? 'animate-spin text-primary' : '')} />
            {syncing ? 'Sincronizando...' : 'Atualizar Rede'}
          </Button>
        </div>
      </div>

      {/* ── Unit Selector ── */}
      <UnitSelector
        currentUnit={selectedUnit}
        onSelectUnit={setSelectedUnit}
        unitOptions={companyOptions}
        allowNetwork={allowedUnits === 'all' || companyOptions.length > 1}
      />

      {/* ── Sync Error Alert ── */}
      {syncErrors.length > 0 && (
        <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20">
          <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-400 font-bold text-sm">Atenção: algumas unidades não retornaram dados</p>
            <p className="text-amber-400/70 text-xs mt-0.5">{syncErrors.join(' · ')}</p>
          </div>
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
        <StatCard
          title="Total Alunos"
          value={totalStudents.toLocaleString('pt-BR')}
          description="Ativos + Gympass"
          icon={Users}
          iconColor="text-primary"
          valueColor="text-primary"
        />
        <StatCard
          title="Ativos"
          value={(stats.active || 0).toLocaleString('pt-BR')}
          description="Contratos Ativos"
          icon={Dumbbell}
          iconColor="text-green-400"
          valueColor="text-green-400"
        />
        <StatCard
          title="Wellhub"
          value={(stats.gympass || 0).toLocaleString('pt-BR')}
          description="Agregadores/Mês"
          icon={UserCheck}
          iconColor="text-purple-400"
          valueColor="text-purple-400"
        />
        <StatCard
          title="Inadimplentes"
          value={(stats.delinquent || 0).toLocaleString('pt-BR')}
          description="Atraso Pagamento"
          icon={UserX}
          iconColor="text-red-400"
          valueColor="text-red-400"
        />
        <StatCard
          title="Faturamento"
          value={formatCurrencyCompact(effectiveRevenue)}
          description={prevRevenue > 0 ? `vs ${formatCurrencyCompact(prevRevenue)} mês ant.` : 'Receita do Mês'}
          icon={DollarSign}
          iconColor="text-green-400"
          trend={revenueTrend}
        />
        <StatCard
          title="Ticket Médio"
          value={formatCurrencyCompact(avgTicket)}
          description="Por Aluno Ativo"
          icon={Wallet}
          iconColor="text-blue-400"
        />
      </div>

      {/* ── Charts & Details ── */}
      {clientDataResult?.clientsByCompany && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 lg:gap-10">
          <ClientCategoryBreakdown
            visitorClients={selectedUnit === 'all' ? (clientDataResult.visitorClients || 0) : (unitStats.visitor || 0)}
            gympassClients={selectedUnit === 'all' ? (clientDataResult.gympassClients || 0) : (unitStats.gympass || 0)}
            onLevelClick={() => {}}
            companyName={selectedUnit !== 'all' ? selectedUnit : undefined}
          />

          <ExpirationLevels
            expiredClients={selectedUnit === 'all' ? clientDataResult.expiredClients : (unitStats.expired || 0)}
            delinquentClients={selectedUnit === 'all' ? clientDataResult.delinquentClients : (unitStats.delinquent || 0)}
            delinquent1Month={selectedUnit === 'all' ? clientDataResult.delinquent1Month : (unitStats.delinquent1Month || 0)}
            delinquent2Months={selectedUnit === 'all' ? clientDataResult.delinquent2Months : (unitStats.delinquent2Months || 0)}
            delinquent3Months={selectedUnit === 'all' ? clientDataResult.delinquent3Months : (unitStats.delinquent3Months || 0)}
            delinquent4PlusMonths={selectedUnit === 'all' ? clientDataResult.delinquent4PlusMonths : (unitStats.delinquent4PlusMonths || 0)}
            onLevelClick={() => {}}
          />

          <div className="xl:col-span-2">
            <ClientOverviewChart
              activeClients={selectedUnit === 'all' ? clientDataResult.activeClients : (unitStats.active || 0)}
              delinquentClients={selectedUnit === 'all' ? clientDataResult.delinquentClients : (unitStats.delinquent || 0)}
              expiredClients={selectedUnit === 'all' ? clientDataResult.expiredClients : (unitStats.expired || 0)}
              visitorClients={selectedUnit === 'all' ? clientDataResult.visitorClients : (unitStats.visitor || 0)}
              gympassClients={selectedUnit === 'all' ? clientDataResult.gympassClients : (unitStats.gympass || 0)}
              otherClients={selectedUnit === 'all' ? clientDataResult.otherClients : (unitStats.other || 0)}
            />
          </div>
        </div>
      )}

      {/* ── Unit Summary Table ── */}
      {clientDataResult?.clientsByCompany && (
        <UnitSummaryTable
          clientsByCompany={clientDataResult.clientsByCompany}
          syncErrors={syncErrors}
        />
      )}

      {/* Empty state */}
      {!clientDataResult && !syncing && (
        <div className="flex flex-col items-center justify-center min-h-[400px] glass-card glow-border rounded-3xl gap-6">
          <Activity className="h-16 w-16 text-white/10 animate-pulse" />
          <div className="text-center">
            <p className="font-black text-white text-lg tracking-tight mb-2">Sem dados carregados</p>
            <p className="text-muted-foreground/40 text-sm font-medium">Clique em "Atualizar Rede" para sincronizar.</p>
          </div>
          <Button onClick={() => syncPactoData(true)} className="bg-primary text-white font-black rounded-2xl px-8 h-12">
            Sincronizar Agora
          </Button>
        </div>
      )}
    </div>
  );
};

export default Dashboard;