import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import StatCard from '@/components/dashboard/StatCard';
import { Users, UserCheck } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

interface ClientCategoryBreakdownProps {
  visitorClients: number;
  gympassClients: number;
  onLevelClick: (level: string, title: string, companyName?: string) => void;
  companyName?: string;
}

const COLORS = ['#3B82F6', '#8B5CF6'];

const ClientCategoryBreakdown: React.FC<ClientCategoryBreakdownProps> = ({
  visitorClients,
  gympassClients,
  onLevelClick,
  companyName,
}) => {
  const total = visitorClients + gympassClients;

  const data = [
    { name: 'Visitantes', value: visitorClients || 0 },
    { name: 'Gympass', value: gympassClients || 0 },
  ];

  const hasData = data.some(d => d.value > 0);

  return (
    <Card className="glass-card glow-border h-full relative">
      <CardHeader className="relative z-10">
        <div className="flex items-center gap-3 mb-2">
           <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
             <Users className="h-5 w-5" />
           </div>
           <CardTitle className="text-xl font-black text-white tracking-tight">
            Visitantes e Gympass
          </CardTitle>
        </div>
        <CardDescription className="text-muted-foreground/50 font-medium">
          Visão detalhada de fluxos externos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StatCard
            title="Visitantes"
            value={visitorClients}
            description="Não-Gympass"
            icon={Users}
            iconColor="text-blue-400"
            valueColor="text-blue-400"
            onClick={() => onLevelClick('visitor', `Visitantes - ${companyName || 'Geral'}`, companyName)}
          />
          <StatCard
            title="Gympass"
            value={gympassClients}
            description="Acessos App"
            icon={UserCheck}
            iconColor="text-purple-400"
            valueColor="text-purple-400"
            onClick={() => onLevelClick('gympass', `Clientes Gympass - ${companyName || 'Geral'}`, companyName)}
          />
        </div>

        {hasData && (
          <div className="h-[250px] w-full mt-4 bg-white/5 rounded-3xl p-4 border border-white/5">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.filter(d => d.value > 0)}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={90}
                  fill="#8884d8"
                  paddingAngle={8}
                  dataKey="value"
                  labelLine={false}
                  stroke="none"
                >
                  {data.filter(d => d.value > 0).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="drop-shadow-[0_0_10px_rgba(59,130,246,0.3)]" />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#11111a',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '16px',
                    boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                    backdropFilter: 'blur(10px)',
                  }}
                  itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                  formatter={(value: number, name: string) => [`${value.toLocaleString('pt-BR')} (${total > 0 ? ((value / total) * 100).toFixed(1) : 0}%)`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        {!hasData && (
          <div className="flex items-center justify-center h-[200px] text-muted-foreground/40 font-bold uppercase text-[10px] tracking-widest border border-dashed border-white/10 rounded-3xl">
            Aguardando Sync de Dados
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ClientCategoryBreakdown;