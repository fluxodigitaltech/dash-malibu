import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, TrendingUp, TrendingDown, AlertTriangle, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ProcessedStats } from '@/utils/pactoSync';

interface UnitSummaryTableProps {
  clientsByCompany: { [unitName: string]: ProcessedStats };
  syncErrors?: string[];
}

const DELINQUENCY_WARNING = 10;
const DELINQUENCY_DANGER  = 20;

const UnitSummaryTable: React.FC<UnitSummaryTableProps> = ({ clientsByCompany, syncErrors = [] }) => {
  const units = Object.entries(clientsByCompany)
    .map(([name, s]) => {
      const total = s.active + s.delinquent;
      return {
        name,
        active:          s.active,
        delinquent:      s.delinquent,
        delinquencyPct:  total > 0 ? (s.delinquent / total) * 100 : 0,
        revenue:         s.realRevenue,
        prevRevenue:     s.prevRevenue,
        revenueChange:   s.prevRevenue > 0
                           ? ((s.realRevenue - s.prevRevenue) / s.prevRevenue) * 100
                           : null,
        hasError: syncErrors.includes(name),
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  const fmt = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const exportCSV = () => {
    const headers = ['Unidade', 'Ativos', 'Inadimplentes', '% Inadimpl.', 'Faturamento Atual', 'Faturamento Anterior', 'Variação (%)'];
    const rows = units.map(u => [
      u.name,
      u.active,
      u.delinquent,
      u.delinquencyPct.toFixed(1) + '%',
      u.revenue.toFixed(2),
      u.prevRevenue.toFixed(2),
      u.revenueChange != null ? u.revenueChange.toFixed(1) + '%' : 'N/A',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `malibu-rede-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="glass-card glow-border rounded-3xl overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/20 text-primary">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-white font-black text-xl">Resumo por Unidade</CardTitle>
            <p className="text-muted-foreground/50 text-[10px] uppercase tracking-widest font-bold mt-0.5">
              Todas as unidades · mês atual vs anterior
            </p>
          </div>
        </div>
        <Button
          onClick={exportCSV}
          variant="ghost"
          className="h-9 px-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-bold text-xs flex gap-2"
        >
          <Download className="h-3.5 w-3.5" /> Exportar CSV
        </Button>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                {['Unidade', 'Ativos', 'Inadimpl.', '% Inadimpl.', 'Faturamento', 'Var. Mês'].map(h => (
                  <th key={h} className={cn(
                    "px-5 py-3 text-[10px] font-black uppercase tracking-widest text-muted-foreground/50",
                    h === 'Unidade' ? 'text-left' : 'text-right'
                  )}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {units.map((u) => {
                const isDanger  = u.delinquencyPct >= DELINQUENCY_DANGER;
                const isWarning = u.delinquencyPct >= DELINQUENCY_WARNING && !isDanger;
                return (
                  <tr
                    key={u.name}
                    className={cn(
                      "border-b border-white/5 transition-colors hover:bg-white/[0.03]",
                      isDanger && "bg-red-500/[0.04]",
                    )}
                  >
                    {/* Unit name */}
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        {isDanger && <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" />}
                        {u.hasError && !isDanger && <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
                        <span className="text-white font-bold text-sm">{u.name}</span>
                        {u.hasError && (
                          <span className="text-[9px] font-black uppercase text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-md border border-amber-500/20">
                            sem dados
                          </span>
                        )}
                      </div>
                    </td>
                    {/* Active */}
                    <td className="px-5 py-4 text-right">
                      <span className="text-green-400 font-bold text-sm">{u.active.toLocaleString('pt-BR')}</span>
                    </td>
                    {/* Delinquent */}
                    <td className="px-5 py-4 text-right">
                      <span className={cn("font-bold text-sm", u.delinquent > 0 ? "text-red-400" : "text-muted-foreground/30")}>
                        {u.delinquent.toLocaleString('pt-BR')}
                      </span>
                    </td>
                    {/* Delinquency % */}
                    <td className="px-5 py-4 text-right">
                      <span className={cn(
                        "font-black text-sm px-2 py-0.5 rounded-lg",
                        isDanger  ? "text-red-400 bg-red-500/10 border border-red-500/20" :
                        isWarning ? "text-amber-400 bg-amber-500/10 border border-amber-500/20" :
                                    "text-green-400 bg-green-500/10 border border-green-500/20"
                      )}>
                        {u.delinquencyPct.toFixed(1)}%
                      </span>
                    </td>
                    {/* Revenue */}
                    <td className="px-5 py-4 text-right">
                      {u.revenue > 0
                        ? <span className="text-white font-bold text-sm">{fmt(u.revenue)}</span>
                        : <span className="text-muted-foreground/30 text-sm">—</span>
                      }
                    </td>
                    {/* Revenue change */}
                    <td className="px-5 py-4 text-right">
                      {u.revenueChange != null ? (
                        <div className={cn(
                          "inline-flex items-center gap-1 font-bold text-sm",
                          u.revenueChange >= 0 ? "text-green-400" : "text-red-400"
                        )}>
                          {u.revenueChange >= 0
                            ? <TrendingUp className="h-3.5 w-3.5" />
                            : <TrendingDown className="h-3.5 w-3.5" />
                          }
                          {Math.abs(u.revenueChange).toFixed(1)}%
                        </div>
                      ) : (
                        <span className="text-muted-foreground/30 text-sm">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Totals row */}
        {units.length > 0 && (() => {
          const totalActive     = units.reduce((s, u) => s + u.active, 0);
          const totalDelinquent = units.reduce((s, u) => s + u.delinquent, 0);
          const totalRevenue    = units.reduce((s, u) => s + u.revenue, 0);
          const totalPrev       = units.reduce((s, u) => s + u.prevRevenue, 0);
          const totalChange     = totalPrev > 0 ? ((totalRevenue - totalPrev) / totalPrev) * 100 : null;
          const totalPct        = (totalActive + totalDelinquent) > 0
            ? (totalDelinquent / (totalActive + totalDelinquent)) * 100 : 0;
          return (
            <div className="border-t border-white/10 bg-white/[0.02] px-5 py-4 flex flex-wrap items-center gap-6">
              <span className="text-[10px] font-black uppercase tracking-widest text-primary">TOTAL REDE</span>
              <span className="text-white font-black text-sm">{totalActive.toLocaleString('pt-BR')} ativos</span>
              <span className="text-red-400 font-bold text-sm">{totalDelinquent.toLocaleString('pt-BR')} inadimpl. ({totalPct.toFixed(1)}%)</span>
              <span className="text-white font-bold text-sm">{fmt(totalRevenue)}</span>
              {totalChange != null && (
                <span className={cn("font-bold text-sm flex items-center gap-1", totalChange >= 0 ? "text-green-400" : "text-red-400")}>
                  {totalChange >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                  {Math.abs(totalChange).toFixed(1)}% vs mês anterior
                </span>
              )}
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
};

export default UnitSummaryTable;
