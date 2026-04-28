import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

interface ChartData {
  name: string;
  value: number;
  color: string;
}

interface ClientOverviewChartProps {
  activeClients: number;
  delinquentClients: number;
  expiredClients: number;
  visitorClients: number;
  gympassClients: number;
  otherClients: number;
}

const ClientOverviewChart: React.FC<ClientOverviewChartProps> = ({
  activeClients,
  delinquentClients,
  expiredClients,
  visitorClients,
  gympassClients,
  otherClients,
}) => {
  const data: ChartData[] = [
    { name: 'Ativos', value: activeClients, color: '#22c55e' },
    { name: 'Inadimplentes', value: delinquentClients, color: '#ef4444' },
    { name: 'Vencidos', value: expiredClients, color: '#f59e0b' },
    { name: 'Visitantes', value: visitorClients, color: '#3b82f6' },
    { name: 'Gympass', value: gympassClients, color: '#8b5cf6' },
    { name: 'Outros', value: otherClients, color: '#4b5563' },
  ].filter(item => item.value > 0);

  return (
    <Card className="glass-card glow-border h-full relative overflow-hidden">
      <CardHeader className="relative z-10">
        <div className="flex items-center gap-3 mb-2">
           <div className="p-2 rounded-lg bg-primary/20 text-primary">
             <BarChart3 className="h-5 w-5" />
           </div>
           <CardTitle className="text-xl font-black text-white tracking-tight">
            Distribuição de Clientes
          </CardTitle>
        </div>
        <CardDescription className="text-muted-foreground/50 font-medium font-semibold uppercase tracking-widest text-[10px]">
          Visão geral da base por situação contratual.
        </CardDescription>
      </CardHeader>
      <CardContent className="h-[350px] p-6 relative z-10">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 20, right: 30, left: 10, bottom: 20 }}
            >
              <defs>
                {data.map((entry, index) => (
                  <linearGradient key={`gradient-${index}`} id={`colorBar-${index}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={entry.color} stopOpacity={0.8}/>
                    <stop offset="100%" stopColor={entry.color} stopOpacity={0.2}/>
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis 
                dataKey="name" 
                stroke="rgba(255,255,255,0.3)" 
                fontSize={10} 
                fontWeight="black"
                tickLine={false} 
                axisLine={false} 
                dy={10}
                tickFormatter={(val) => val.toUpperCase()}
              />
              <YAxis 
                stroke="rgba(255,255,255,0.3)" 
                fontSize={10} 
                fontWeight="black"
                tickLine={false} 
                axisLine={false} 
              />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.03)', radius: 10 }}
                contentStyle={{
                  backgroundColor: '#11111a',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '16px',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                  backdropFilter: 'blur(10px)',
                }}
                itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                labelStyle={{ display: 'none' }}
              />
              <Bar 
                dataKey="value" 
                radius={[12, 12, 4, 4]} 
                barSize={45}
                animationDuration={1500}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={`url(#colorBar-${index})`} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground/30 font-black uppercase text-xs tracking-widest gap-4">
            <div className="w-16 h-16 rounded-full border-2 border-dashed border-white/5 flex items-center justify-center">
                <BarChart3 className="w-6 h-6" />
            </div>
            Dados Indisponíveis
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ClientOverviewChart;