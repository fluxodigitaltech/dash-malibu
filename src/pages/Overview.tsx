import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { profiles } from '@/integrations/nocodb/client';
import { Users, Activity, CheckCircle2, MapPin, Loader2 } from 'lucide-react';
import UnitTotalsChart from '@/components/dashboard/UnitTotalsChart';
import StatCard from '@/components/dashboard/StatCard';
import MalibuMap from '@/components/dashboard/MalibuMap';
import { useFilteredPactoData as usePactoData } from '@/hooks/useFilteredPactoData';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const Overview = () => {
  const { user } = useAuth();
  const { data: globalData, syncing, syncPactoData } = usePactoData();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    if (user && !profile) {
      profiles.getByUserId(user.id).then(data => setProfile(data));
    }
  }, [user, profile]);

  const displayStats = globalData?.clientData?.clientsByCompany;
  const totalStudents = (globalData?.clientData?.activeClients || 0) + (globalData?.clientData?.gympassClients || 0);
  const activeUnits   = displayStats ? Object.keys(displayStats).length : 0;

  return (
    <div className="space-y-10 p-10 max-w-[1600px] mx-auto animate-in fade-in duration-700">
      {/* Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-primary/20 text-primary shadow-[0_0_15px_rgba(242,140,29,0.3)]">
              <Activity className="h-6 w-6" />
            </div>
            <h1 className="text-4xl font-black tracking-tighter text-white">
              Olá, <span className="text-primary">{profile?.first_name || 'Líder'}</span>
            </h1>
          </div>
          <p className="text-muted-foreground/50 font-medium uppercase tracking-[0.2em] text-[10px]">
            Bem-vindo à nova central de inteligência Malibu.
          </p>
        </div>

        <div className="flex items-center gap-4">
          <Button
            onClick={() => syncPactoData(true)}
            variant="ghost"
            disabled={syncing}
            className="h-12 px-6 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold border border-white/5 hover:border-white/10 transition-all flex items-center gap-3"
          >
            <Loader2 className={cn("h-4 w-4", syncing ? 'animate-spin text-primary' : '')} />
            {syncing ? 'Atualizando...' : 'Sincronizar Rede'}
          </Button>
          <div className="flex items-center bg-white/5 rounded-2xl px-4 py-2 border border-white/5">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse mr-3 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
            <span className="text-[10px] font-black text-green-400 uppercase tracking-widest">Network Online</span>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Unidades Malibu" value={activeUnits || 11} description="Ativas na Rede" icon={MapPin} />
        <StatCard title="Total Alunos" value={totalStudents} description="Ativos + Gympass" icon={Users} iconColor="text-primary" />
        <StatCard title="Status WhatsApp" value="Conectado" description="Sync em tempo real" icon={CheckCircle2} iconColor="text-green-400" />
        <StatCard title="Agente IA" value="Ativo" description="IA Multinível" icon={Activity} iconColor="text-blue-400" />
      </div>

      {/* Map + Chart */}
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="glass-card glow-border rounded-3xl overflow-hidden min-h-[500px]">
          <MalibuMap />
        </div>
        {displayStats && <UnitTotalsChart clientsByCompany={displayStats} />}
      </div>
    </div>
  );
};

export default Overview;
