// src/hooks/useFilteredPactoData.ts
// Retorna os dados do Pacto filtrados pelas unidades permitidas do usuário logado.
// Se allowedUnits === 'all', retorna tudo sem filtro.

import { useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePactoData } from '@/contexts/PactoDataContext';
import type { SyncData, ProcessedStats } from '@/utils/pactoSync';

const sumStats = (list: ProcessedStats[]): ProcessedStats => list.reduce(
  (acc, s) => ({
    active:                acc.active                + s.active,
    visitor:               acc.visitor               + s.visitor,
    gympass:               acc.gympass               + s.gympass,
    delinquent:            acc.delinquent            + s.delinquent,
    other:                 acc.other                 + s.other,
    total:                 acc.total                 + s.total,
    expiringToday:         acc.expiringToday         + s.expiringToday,
    expiringInMonth:       acc.expiringInMonth       + s.expiringInMonth,
    expiringInThreeMonths: acc.expiringInThreeMonths + s.expiringInThreeMonths,
    expired:               acc.expired               + s.expired,
    pending:               acc.pending               + s.pending,
    pendingValue:          acc.pendingValue          + s.pendingValue,
    delinquent1Month:      acc.delinquent1Month      + s.delinquent1Month,
    delinquent2Months:     acc.delinquent2Months     + s.delinquent2Months,
    delinquent3Months:     acc.delinquent3Months     + s.delinquent3Months,
    delinquent4PlusMonths: acc.delinquent4PlusMonths + s.delinquent4PlusMonths,
    realRevenue:           acc.realRevenue           + s.realRevenue,
    prevRevenue:           acc.prevRevenue           + s.prevRevenue,
    newEnrollments:        acc.newEnrollments        + s.newEnrollments,
    cancellations:         acc.cancellations         + s.cancellations,
  }),
  {
    active: 0, visitor: 0, gympass: 0, delinquent: 0, other: 0, total: 0,
    expiringToday: 0, expiringInMonth: 0, expiringInThreeMonths: 0, expired: 0,
    pending: 0, pendingValue: 0, delinquent1Month: 0, delinquent2Months: 0,
    delinquent3Months: 0, delinquent4PlusMonths: 0, realRevenue: 0, prevRevenue: 0,
    newEnrollments: 0, cancellations: 0,
  }
);

const filterSyncData = (data: SyncData, allowedUnits: string[] | 'all'): SyncData => {
  if (allowedUnits === 'all') return data;

  const { clientsByCompany } = data.clientData;

  // Filtra apenas as unidades permitidas (ignora 'all' aggregate)
  const filtered: Record<string, ProcessedStats> = {};
  for (const unit of allowedUnits) {
    if (clientsByCompany[unit]) filtered[unit] = clientsByCompany[unit];
  }

  // Recalcula o aggregate 'all' somente com as unidades permitidas
  const unitStats = Object.values(filtered);
  const agg = unitStats.length > 0 ? sumStats(unitStats) : clientsByCompany['all'] ?? sumStats([]);
  filtered['all'] = agg;

  return {
    ...data,
    companyOptions: allowedUnits.filter(u => clientsByCompany[u]),
    clientData: {
      totalClients:          agg.total,
      activeClients:         agg.active,
      visitorClients:        agg.visitor,
      gympassClients:        agg.gympass,
      delinquentClients:     agg.delinquent,
      otherClients:          agg.other,
      expiredClients:        agg.expired,
      totalRealRevenue:      agg.realRevenue,
      prevRevenue:           agg.prevRevenue,
      totalNewEnrollments:   agg.newEnrollments,
      totalCancellations:    agg.cancellations,
      delinquent1Month:      agg.delinquent1Month,
      delinquent2Months:     agg.delinquent2Months,
      delinquent3Months:     agg.delinquent3Months,
      delinquent4PlusMonths: agg.delinquent4PlusMonths,
      clientsByCompany:      filtered,
    },
  };
};

export const useFilteredPactoData = () => {
  const pacto = usePactoData();
  const { allowedUnits } = useAuth();

  const filteredData = useMemo(
    () => (pacto.data ? filterSyncData(pacto.data, allowedUnits) : null),
    [pacto.data, allowedUnits]
  );

  return { ...pacto, data: filteredData };
};
