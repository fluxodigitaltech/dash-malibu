import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, DollarSign, RefreshCw, AlertCircle, Building2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';
import { pactoApiClient } from '@/integrations/pacto/client';
import { showError } from '@/utils/toast';

interface BiSummaryContent {
  mes: string;
  contasReceberPorDataQuitacao: number;
  recebiveis: number;
  totalReceita: number;
  totalFaturamento: number;
  totalDespesa: number;
  competencia: number;
  contasReceberPorDataCompetencia: number;
  totalCompetencia: number;
}

interface PiracicabaRevenueCardProps {
  piracicabaActualCompanyName: string | null;
}

const PiracicabaRevenueCard: React.FC<PiracicabaRevenueCardProps> = ({ piracicabaActualCompanyName }) => {
  const [revenueData, setRevenueData] = useState<BiSummaryContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const unitName = piracicabaActualCompanyName || 'Piracicaba';

  const fetchRevenueData = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (!unitName) {
      setError('Nome da unidade Piracicaba não disponível.');
      setLoading(false);
      return;
    }

    try {
      const currentDate = new Date();
      const currentMonth = format(currentDate, 'yyyy-MM');
      
      const result = await pactoApiClient.fetchBiSummary(unitName, currentMonth, currentMonth);
      const data = result?.current;

      if (data) {
        setRevenueData(data);
      } else {
        setError('Nenhum dado de faturamento encontrado para o período.');
      }
    } catch (err: any) {
      const errorMessage = err.message || `Erro ao buscar dados de faturamento da ${unitName}.`;
      showError(errorMessage);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [unitName]);

  useEffect(() => {
    fetchRevenueData();
  }, [fetchRevenueData]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const calculateMargin = (receita: number, despesa: number) => {
    if (receita === 0) return 0;
    return ((receita - despesa) / receita) * 100;
  };

  const getTrendIcon = (value: number) => {
    return value >= 0 ? TrendingUp : TrendingDown;
  };

  const getTrendColor = (value: number) => {
    return value >= 0 ? 'text-green-500' : 'text-red-500';
  };

  if (loading) {
    return (
      <Card className="shadow-lg hover:shadow-xl transition-all duration-300 border-border/50 bg-gradient-to-br from-slate-900/50 to-slate-800/50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Recebíveis</CardTitle>
          <div className="p-2 rounded-lg bg-blue-500/10">
            <DollarSign className="h-5 w-5 text-blue-500 animate-pulse" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-40" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="shadow-lg hover:shadow-xl transition-all duration-300 border-border/50 bg-gradient-to-br from-slate-900/50 to-slate-800/50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Recebíveis</CardTitle>
          <div className="p-2 rounded-lg bg-red-500/10">
            <AlertCircle className="h-5 w-5 text-red-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-red-500 text-sm break-words">{error}</p>
            <Button 
              onClick={fetchRevenueData} 
              variant="outline" 
              size="sm"
              className="text-red-500 border-red-500 hover:bg-red-500/10"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Tentar Novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!revenueData) {
    return (
      <Card className="shadow-lg hover:shadow-xl transition-all duration-300 border-border/50 bg-gradient-to-br from-slate-900/50 to-slate-800/50">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">Recebíveis</CardTitle>
          <div className="p-2 rounded-lg bg-gray-500/10">
            <DollarSign className="h-5 w-5 text-gray-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-gray-500 text-sm">Nenhum dado disponível</p>
            <Button 
              onClick={fetchRevenueData} 
              variant="outline" 
              size="sm"
              className="text-blue-500 border-blue-500 hover:bg-blue-500/10"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Tentar Novamente
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const recebiveis = revenueData.recebiveis || 0;
  const totalReceita = revenueData.totalReceita || 0;
  const totalDespesa = revenueData.totalDespesa || 0;
  const totalLucro = totalReceita - totalDespesa;
  const margemLucro = calculateMargin(totalReceita, totalDespesa);

  return (
    <Card className="shadow-lg hover:shadow-xl transition-all duration-300 border-border/50 bg-gradient-to-br from-slate-900/50 to-slate-800/50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Recebíveis</CardTitle>
          <Badge variant="secondary" className="text-xs bg-blue-500/10 text-blue-500 border-blue-500/30">
            <Building2 className="h-3 w-3 mr-1" />
            {unitName}
          </Badge>
        </div>
        <div className="p-2 rounded-lg bg-green-500/10">
          <DollarSign className="h-5 w-5 text-green-500" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="text-3xl font-bold text-green-500">
              {formatCurrency(recebiveis)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Valor total a receber no mês atual
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border/30">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Faturamento Real</span>
                <span className="text-sm font-medium text-green-500">
                  {formatCurrency(totalReceita)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Despesas</span>
                <span className="text-sm font-medium text-red-500">
                  {formatCurrency(totalDespesa)}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Lucro</span>
                <span className="text-sm font-medium text-blue-500">
                  {formatCurrency(totalLucro)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Margem</span>
                <div className="flex items-center gap-1">
                  {React.createElement(getTrendIcon(margemLucro), {
                    className: `h-3 w-3 ${getTrendColor(margemLucro)}`
                  })}
                  <span className={`text-sm font-medium ${getTrendColor(margemLucro)}`}>
                    {margemLucro.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progresso Mensal</span>
              <span>{new Date().getDate()} de {new Date().getMonth() + 1} dias</span>
            </div>
            <Progress 
              value={(new Date().getDate() / 30) * 100} 
              className="h-2" 
            />
          </div>

          <Button 
            onClick={fetchRevenueData} 
            variant="outline" 
            size="sm"
            className="w-full text-blue-500 border-blue-500 hover:bg-blue-500/10"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar Dados
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PiracicabaRevenueCard;