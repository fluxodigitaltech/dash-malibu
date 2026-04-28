import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarX, TrendingUp, AlertTriangle, Clock, Users, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExpirationLevel {
  level: string;
  period: string;
  count: number;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: React.ElementType;
  description: string;
}

interface ExpirationLevelsProps {
  expiredClients: number;
  delinquentClients: number;
  delinquent1Month: number;
  delinquent2Months: number;
  delinquent3Months: number;
  delinquent4PlusMonths: number;
  onLevelClick: (level: string, title: string, companyName?: string) => void;
}

const ExpirationLevels: React.FC<ExpirationLevelsProps> = ({ 
  expiredClients, 
  delinquentClients,
  delinquent1Month,
  delinquent2Months,
  delinquent3Months,
  delinquent4PlusMonths,
  onLevelClick 
}) => {
  const levels: ExpirationLevel[] = [
    {
      level: '1-month',
      period: '1 mês',
      count: delinquent1Month,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/20',
      icon: Clock,
      description: 'Vencido há 30 dias'
    },
    {
      level: '2-months',
      period: '2 meses',
      count: delinquent2Months,
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/10',
      borderColor: 'border-orange-500/20',
      icon: AlertTriangle,
      description: 'Vencido há 60 dias'
    },
    {
      level: '3-months',
      period: '3 meses',
      count: delinquent3Months,
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/20',
      icon: CalendarX,
      description: 'Vencido há 90 dias'
    },
    {
      level: '4-plus-months',
      period: '4+ meses',
      count: delinquent4PlusMonths,
      color: 'text-rose-500',
      bgColor: 'bg-rose-500/10',
      borderColor: 'border-rose-500/20',
      icon: TrendingUp,
      description: 'Vencido há 120+ dias'
    }
  ];

  return (
    <Card className="glass-card glow-border h-full relative">
      <CardHeader className="relative z-10">
        <div className="flex items-center gap-3 mb-2">
           <div className="p-2 rounded-lg bg-red-500/20 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
             <Activity className="h-5 w-5" />
           </div>
           <CardTitle className="text-xl font-black text-white tracking-tight">
            Níveis de Vencimento
          </CardTitle>
        </div>
        <CardDescription className="text-muted-foreground/50 font-medium">
          Degradação da carteira por tempo de atraso.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 relative z-10 text-white">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {levels.map((level) => {
            const Icon = level.icon;
            return (
              <div
                key={level.level}
                onClick={() => onLevelClick(level.level, `Clientes vencidos há ${level.period}`)}
                className={cn(
                  "p-5 rounded-3xl border transition-all duration-500 group/item cursor-pointer",
                  level.bgColor,
                  level.borderColor,
                  "hover:bg-white/10 hover:border-white/20 hover:-translate-y-1"
                )}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={cn("p-2 rounded-xl bg-white/5 border border-white/5", level.color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className={cn("text-[10px] font-black uppercase tracking-widest opacity-60", level.color)}>
                    {level.period}
                  </span>
                </div>
                <div className="text-3xl font-black tracking-tighter mb-1">
                  {level.count}
                </div>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider opacity-60">
                  {level.description}
                </p>
              </div>
            );
          })}
        </div>
        
        <div className="mt-8 p-6 bg-white/5 rounded-3xl border border-white/5 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
          <div className="flex items-center justify-between relative z-10">
            <div>
              <h4 className="text-sm font-black uppercase tracking-[0.2em] text-white/40 mb-2">Resumo Geral</h4>
              <p className="text-base font-bold text-white/70">
                Inadimplência Total: <span className="text-red-400 font-black">{delinquentClients}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-1">Total Vencidos</p>
              <p className="text-2xl font-black text-white">{expiredClients}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ExpirationLevels;