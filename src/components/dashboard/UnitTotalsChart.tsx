import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { LayoutDashboard } from 'lucide-react';
import { ProcessedStats } from '@/utils/pactoSync';

interface UnitTotalsChartProps {
  clientsByCompany: { [unitName: string]: ProcessedStats };
}

const UnitTotalsChart: React.FC<UnitTotalsChartProps> = ({ clientsByCompany }) => {
  const data = Object.entries(clientsByCompany)
    .map(([name, stats]) => ({
      name,
      value: (stats.active || 0) + (stats.gympass || 0),
      active: stats.active || 0,
      gympass: stats.gympass || 0,
    }))
    .filter(item => item.value > 0)
    .sort((a, b) => a.value - b.value);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const dataPoint = data.find(d => d.name === label);
      if (!dataPoint) return null;
      return (
        <div className="bg-[#11111a]/95 backdrop-blur-3xl border border-white/10 rounded-2xl p-4 shadow-2xl">
          <p className="font-black text-white mb-2 text-sm uppercase tracking-widest">{label}</p>
          <div className="space-y-1">
            <p className="text-primary font-black text-base flex justify-between gap-4">
              <span>Total:</span> <span>{dataPoint.value.toLocaleString('pt-BR')}</span>
            </p>
            <div className="w-full h-px bg-white/5 my-2" />
            <p className="text-white/60 text-[10px] font-bold uppercase flex justify-between gap-4">
              <span>Ativos:</span> <span>{dataPoint.active.toLocaleString('pt-BR')}</span>
            </p>
            <p className="text-white/60 text-[10px] font-bold uppercase flex justify-between gap-4">
              <span>Gympass:</span> <span>{dataPoint.gympass.toLocaleString('pt-BR')}</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="glass-card glow-border h-full relative overflow-hidden">
      <CardHeader>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-primary/20 text-primary">
            <LayoutDashboard className="h-5 w-5" />
          </div>
          <CardTitle className="text-xl font-black text-white tracking-tight">Alunos por Unidade</CardTitle>
        </div>
        <CardDescription className="text-muted-foreground/50 font-semibold uppercase tracking-widest text-[10px]">
          Comparativo de performance entre unidades Malibu.
        </CardDescription>
      </CardHeader>
      <CardContent className="h-[400px] p-6 relative z-10">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 5, right: 60, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.8} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal vertical={false} />
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                stroke="rgba(255,255,255,0.4)"
                fontSize={10}
                fontFamily="inherit"
                fontWeight="black"
                width={120}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => val.toUpperCase()}
              />
              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)', radius: 8 }} content={<CustomTooltip />} />
              <Bar dataKey="value" fill="url(#barGradient)" radius={[0, 8, 8, 0]} barSize={20} animationDuration={1500}>
                <LabelList
                  dataKey="value"
                  position="right"
                  fill="rgba(255,255,255,0.6)"
                  fontSize={10}
                  fontWeight="black"
                  offset={15}
                  formatter={(value: number) => value.toLocaleString('pt-BR')}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground/20 font-black uppercase text-[10px] tracking-widest border border-dashed border-white/5 rounded-3xl">
            Dados de Rede Carregando...
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default UnitTotalsChart;
