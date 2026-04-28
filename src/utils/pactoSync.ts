// src/utils/pactoSync.ts
// IMPORTANT: This is the SINGLE SOURCE OF TRUTH for all data processing.
// Pass 1: Paginate clients to get per-contract detail (expirations, delinquency buckets).
// Pass 2: Override totals from the faster /rel-clientes/situacao endpoint (authoritative).
// Pass 3: Accumulate unit stats into the 'all' aggregate.

import { pactoApiClient, UNIT_CONFIGS } from '@/integrations/pacto/client';
import { format } from 'date-fns';

export interface ProcessedStats {
  active: number;
  visitor: number;
  gympass: number;
  delinquent: number;
  other: number;
  total: number;
  expiringToday: number;
  expiringInMonth: number;
  expiringInThreeMonths: number;
  expired: number;
  pending: number;
  pendingValue: number;
  delinquent1Month: number;
  delinquent2Months: number;
  delinquent3Months: number;
  delinquent4PlusMonths: number;
  realRevenue: number;
  prevRevenue: number;
  newEnrollments: number;
  cancellations: number;
}

export interface SyncData {
  clientData: {
    totalClients: number;
    activeClients: number;
    visitorClients: number;
    gympassClients: number;
    delinquentClients: number;
    otherClients: number;
    expiredClients: number;
    totalRealRevenue: number;
    prevRevenue: number;
    totalNewEnrollments: number;
    totalCancellations: number;
    delinquent1Month: number;
    delinquent2Months: number;
    delinquent3Months: number;
    delinquent4PlusMonths: number;
    clientsByCompany: { [key: string]: ProcessedStats };
  };
  companyOptions: string[];
  lastSyncISO: string;
  syncErrors: string[];
}

const emptyStats = (): ProcessedStats => ({
  active: 0, visitor: 0, gympass: 0, delinquent: 0,
  other: 0, total: 0, expiringToday: 0, expiringInMonth: 0,
  expiringInThreeMonths: 0, expired: 0, pending: 0, pendingValue: 0,
  delinquent1Month: 0, delinquent2Months: 0, delinquent3Months: 0,
  delinquent4PlusMonths: 0, realRevenue: 0, prevRevenue: 0, newEnrollments: 0, cancellations: 0,
});

export const processPactoData = (
  allClients: any[],
  biSumm: { [key: string]: { current: any | null; previous: any | null } | null },
  gympassCounts: { [key: string]: number },
  unitSummaries: { [key: string]: any[] | null },
  newEnrollmentsByUnit: { [key: string]: number } = {},
  cancellationsByUnit: { [key: string]: number } = {},
): SyncData => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
  const threeMo = new Date(today);
  threeMo.setMonth(threeMo.getMonth() + 3);

  // Unit stats — keyed by company name (NOT including 'all' yet)
  const stats: { [key: string]: ProcessedStats } = {};
  const companies = new Set<string>();

  // Debug: log all unique situacao values per unit + first record structure
  const situacaoDebug: { [unit: string]: { [sit: string]: number } } = {};
  const loggedUnits = new Set<string>();
  for (const c of allClients) {
    const unit = c.empresa ?? 'UNKNOWN';
    const sit = (c.situacao ?? 'NULL').toString().trim().toUpperCase();
    if (!situacaoDebug[unit]) situacaoDebug[unit] = {};
    situacaoDebug[unit][sit] = (situacaoDebug[unit][sit] || 0) + 1;

    // Log ALL keys of the first ATIVO record per unit — so we can see contract fields
    if (sit === 'ATIVO' && !loggedUnits.has(unit)) {
      loggedUnits.add(unit);
      const keys = Object.keys(c).sort();
      console.log(`[Debug Campos] ${unit} (cliente ATIVO) keys:`, keys.join(', '));
      // Log contract-related fields specifically
      const contractFields: Record<string, any> = {};
      for (const k of keys) {
        if (k.toLowerCase().includes('contrato') || k.toLowerCase().includes('contract') ||
            k.toLowerCase().includes('lista') || k.toLowerCase().includes('plano') ||
            k.toLowerCase().includes('modalidade') || k.toLowerCase().includes('situacao') ||
            k.toLowerCase().includes('cancel') || k.toLowerCase().includes('motivo') ||
            k.toLowerCase().includes('mudanca') || k.toLowerCase().includes('tipo')) {
          contractFields[k] = Array.isArray(c[k]) ? `Array(${c[k].length})` : c[k];
        }
      }
      console.log(`[Debug Contratos] ${unit}:`, JSON.stringify(contractFields));
    }

    // Log first CANCELADO record per unit — to see cancellation reason fields
    if ((sit === 'CANCELADO' || sit === 'INATIVO') && !loggedUnits.has(`${unit}_CANCEL`)) {
      loggedUnits.add(`${unit}_CANCEL`);
      const cancelFields: Record<string, any> = {};
      for (const k of Object.keys(c).sort()) {
        if (k.toLowerCase().includes('cancel') || k.toLowerCase().includes('motivo') ||
            k.toLowerCase().includes('mudanca') || k.toLowerCase().includes('situacao') ||
            k.toLowerCase().includes('contrato') || k.toLowerCase().includes('plano') ||
            k.toLowerCase().includes('tipo') || k.toLowerCase().includes('razao') ||
            k.toLowerCase().includes('observ')) {
          cancelFields[k] = c[k];
        }
      }
      console.log(`[Debug CANCELADO] ${unit}:`, JSON.stringify(cancelFields));
    }
  }
  for (const [unit, sits] of Object.entries(situacaoDebug)) {
    console.log(`[Debug Situação] ${unit}:`, JSON.stringify(sits));
  }

  // ── Debug: contar por situacaoContrato PER UNIT ──
  // Pacto conta CONTRATOS ATIVOS (situacaoContrato NORMAL/A_VENCER), não clientes com situacao=ATIVO
  const contratosDebug: { [unit: string]: { [sitContrato: string]: number } } = {};
  const contratosAtivosCount: { [unit: string]: number } = {};
  for (const c of allClients) {
    const unit = c.empresa ?? 'UNKNOWN';
    const sitContrato = (c.situacaoContrato ?? c.situacao_contrato ?? 'NULL').toString().trim().toUpperCase();
    if (!contratosDebug[unit]) contratosDebug[unit] = {};
    contratosDebug[unit][sitContrato] = (contratosDebug[unit][sitContrato] || 0) + 1;
    // Contar contratos "ativos" = NORMAL ou A_VENCER (hipótese)
    if (sitContrato === 'NORMAL' || sitContrato === 'A_VENCER') {
      contratosAtivosCount[unit] = (contratosAtivosCount[unit] || 0) + 1;
    }
  }
  for (const [unit, sits] of Object.entries(contratosDebug)) {
    const ativosCliente = situacaoDebug[unit]?.['ATIVO'] ?? 0;
    const ativosContrato = contratosAtivosCount[unit] ?? 0;
    console.log(`[Debug SituacaoContrato] ${unit}:`, JSON.stringify(sits),
      `| clientesAtivos=${ativosCliente} | contratosAtivos=${ativosContrato} | diff=${ativosContrato - ativosCliente}`);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // PASS 1: Process raw client records — IGUAL PAULÍNIA.
  // Contagem por situacao do cliente:
  //   ATIVO → active (Paulínia = 799, bate 100% com Pacto)
  //   INATIVO_VENCIDO (via situacaoContrato) → delinquent (inadimplente)
  //   VISITANTE → visitor
  //   CANCELADO / INATIVO → expired
  //
  // Para unidades com includeRenewed=true (Araçatuba, Araras, Mogi Guaçu, São João):
  //   INATIVO com situacaoContrato=NORMAL → contado como ativo ("Renovado" oculto na API)
  // ────────────────────────────────────────────────────────────────────────────

  // Unidades que precisam incluir "Renovados" (INATIVO + contrato NORMAL)
  const renewedUnits = new Set(
    UNIT_CONFIGS.filter(u => u.includeRenewed).map(u => u.name)
  );
  const renewedCount: { [unit: string]: number } = {};

  for (const c of allClients) {
    if (!c.empresa) continue;
    companies.add(c.empresa);
    if (!stats[c.empresa]) stats[c.empresa] = emptyStats();

    const s = stats[c.empresa];
    s.total++;

    const situacao: string = (c.situacao ?? '').toString().trim().toUpperCase();
    const situacaoContrato: string = (c.situacaoContrato ?? c.situacao_contrato ?? '').toString().trim().toUpperCase();
    const endDateStr: string | undefined =
      c.fimContrato ?? c.fim_contrato ?? c.dataFimContrato ?? c.data_fim_contrato ?? undefined;

    // Inadimplente = contrato vencido (INATIVO_VENCIDO)
    const isDelinquent = situacaoContrato === 'INATIVO_VENCIDO';

    // "Renovado oculto": INATIVO mas com contrato NORMAL — só em unidades com includeRenewed
    const isRenewed = renewedUnits.has(c.empresa) &&
      situacao === 'INATIVO' &&
      (situacaoContrato === 'NORMAL' || situacaoContrato === 'A_VENCER');

    if (situacao === 'ATIVO' || isRenewed) {
      if (isRenewed) {
        renewedCount[c.empresa] = (renewedCount[c.empresa] || 0) + 1;
      }
      s.active++;
      if (endDateStr) {
        const end = new Date(endDateStr);
        if (end.toDateString() === today.toDateString()) s.expiringToday++;
        if (end > today && end <= monthEnd) s.expiringInMonth++;
        if (end >= today && end <= threeMo) s.expiringInThreeMonths++;
      }
    } else if (isDelinquent) {
      s.delinquent++;
      if (endDateStr) {
        const end = new Date(endDateStr);
        const diff =
          (today.getFullYear() - end.getFullYear()) * 12 +
          (today.getMonth() - end.getMonth());
        if (diff < 2) s.delinquent1Month++;
        else if (diff < 3) s.delinquent2Months++;
        else if (diff < 4) s.delinquent3Months++;
        else s.delinquent4PlusMonths++;
      } else {
        s.delinquent1Month++;
      }
    } else if (situacao === 'VISITANTE') {
      s.visitor++;
    } else if (situacao === 'CANCELADO' || situacao === 'INATIVO') {
      s.expired++;
    } else {
      s.other++;
    }
  }

  // Log resumido dos "Renovados" incluídos
  for (const [unit, count] of Object.entries(renewedCount)) {
    console.log(`[Renovado] ${unit}: +${count} clientes INATIVO com contrato ativo → somados aos ativos`);
  }

  // ────────────────────────────────────────────────────────────────────────────
  // PASS 2: Override SOME totals from /rel-clientes/situacao.
  // IMPORTANT: NÃO sobrescrever `active` aqui!
  // O endpoint /rel-clientes/situacao conta por CLIENTE (situacao=ATIVO),
  // mas o BI do Pacto conta por CONTRATO (situacaoContrato).
  // O PASS 1 já conta por situacaoContrato, que é o correto.
  // Apenas visitor/delinquent/expired são sobrescritos.
  // ────────────────────────────────────────────────────────────────────────────
  for (const unitName of Object.keys(stats)) {
    const summary = unitSummaries[unitName];
    if (Array.isArray(summary) && summary.length > 0) {
      const find = (situation: string) =>
        summary.find((s: any) =>
          (s.situacao ?? s.situation ?? '').toUpperCase() === situation
        );

      const activeObj    = find('ATIVO');
      const visitorObj   = find('VISITANTE');
      const delinqObj    = find('INADIMPLENTE');
      const canceladoObj = find('CANCELADO');

      // Log: comparar contagem PASS 1 (por contrato) vs summary (por cliente)
      if (activeObj?.quantidade != null) {
        const pass1Active = stats[unitName].active;
        const summaryActive = Number(activeObj.quantidade);
        if (pass1Active !== summaryActive) {
          console.log(`[PASS 2] ${unitName}: active CONTRATO=${pass1Active} vs CLIENTE=${summaryActive} (diff=${pass1Active - summaryActive}) — usando contagem por CONTRATO`);
        }
      }
      // NÃO sobrescrever active — PASS 1 (contrato) é mais preciso que summary (cliente)
      if (visitorObj?.quantidade   != null) stats[unitName].visitor   = Number(visitorObj.quantidade);
      if (delinqObj?.quantidade    != null) stats[unitName].delinquent = Number(delinqObj.quantidade);
      if (canceladoObj?.quantidade != null) stats[unitName].expired   = Number(canceladoObj.quantidade);
    }

    // BI Revenue — handle all known field names from Pacto /v1/bi/resumo
    const bi = biSumm[unitName];
    const extractRevenue = (rec: any): number => {
      if (!rec) return 0;
      return rec.totalReceita ?? rec.totalFaturamento ?? rec.totalCompetencia ??
        rec.receitaTotal ?? rec.receita ?? rec.contasReceberPorDataQuitacao ??
        rec.recebiveis ?? rec.competencia ?? rec.total ?? 0;
    };
    if (bi?.current)  stats[unitName].realRevenue = extractRevenue(bi.current);
    if (bi?.previous) stats[unitName].prevRevenue = extractRevenue(bi.previous);

    // Gympass count — only override if we got a real value
    const gympassCount = gympassCounts[unitName] ?? 0;
    if (gympassCount > 0) stats[unitName].gympass = gympassCount;

    // New enrollments & cancellations (if fetched)
    if (newEnrollmentsByUnit[unitName] != null)
      stats[unitName].newEnrollments = newEnrollmentsByUnit[unitName];
    if (cancellationsByUnit[unitName] != null)
      stats[unitName].cancellations = cancellationsByUnit[unitName];
  }

  // ────────────────────────────────────────────────────────────────────────────
  // PASS 3: Build the 'all' aggregate by summing all individual unit stats.
  // This happens AFTER overrides so the 'all' sum reflects final correct values.
  // ────────────────────────────────────────────────────────────────────────────
  const all = emptyStats();
  for (const unitName of Object.keys(stats)) {
    const s = stats[unitName];
    all.active    += s.active;
    all.visitor   += s.visitor;
    all.gympass   += s.gympass;
    all.delinquent += s.delinquent;
    all.other     += s.other;
    all.total     += s.total;
    all.expired   += s.expired;
    all.realRevenue         += s.realRevenue;
    all.prevRevenue         += s.prevRevenue;
    all.newEnrollments      += s.newEnrollments;
    all.cancellations       += s.cancellations;
    all.expiringToday       += s.expiringToday;
    all.expiringInMonth     += s.expiringInMonth;
    all.expiringInThreeMonths += s.expiringInThreeMonths;
    all.delinquent1Month    += s.delinquent1Month;
    all.delinquent2Months   += s.delinquent2Months;
    all.delinquent3Months   += s.delinquent3Months;
    all.delinquent4PlusMonths += s.delinquent4PlusMonths;
  }

  return {
    clientData: {
      ...all,
      clientsByCompany: stats,
      totalClients:        all.total,
      activeClients:       all.active,
      visitorClients:      all.visitor,
      gympassClients:      all.gympass,
      delinquentClients:   all.delinquent,
      otherClients:        all.other,
      expiredClients:      all.expired,
      totalRealRevenue:    all.realRevenue,
      totalNewEnrollments: all.newEnrollments,
      totalCancellations:  all.cancellations,
      delinquent1Month:    all.delinquent1Month,
      delinquent2Months:   all.delinquent2Months,
      delinquent3Months:   all.delinquent3Months,
      delinquent4PlusMonths: all.delinquent4PlusMonths,
    },
    companyOptions: Array.from(companies).sort(),
    lastSyncISO: new Date().toISOString(),
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// SHEETY — AGREGADORES (Gympass / Wellhub) via Google Sheets API
// ─────────────────────────────────────────────────────────────────────────────
const SHEETY_URL = '/api/sheety/cd1d179ec9a92ce2e25859ab03de9510/acompanhamentoDeResultados2026/geral2026';

const PT_MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
                   'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const toSheetyKey = (yyyymm: string): string => {
  const [y, m] = yyyymm.split('-');
  return `${PT_MONTHS[parseInt(m, 10) - 1]}/${y.slice(2)}`;
};

// Maps uppercase sheet unit names → our UNIT_CONFIGS names
const SHEETY_UNIT_MAP: { [k: string]: string | null } = {
  'PIRACICABA':         'Piracicaba',
  'HORTOLÂNDIA':        null,
  'MOGI MIRIM':         'Mogi Mirim',
  'MOGI GUAÇU':         'Mogi Guaçu',
  'SÃO JOÃO':           'São João',
  'ARAÇATUBA':          'Araçatuba',
  'ARARAS':             'Araras',
  'PRUDENTE':           'Presidente Prudente',
  'AMERICANA':          'Americanas',
  'PAULÍNIA':           'Paulínia',
  'SUMARÉ':             'Malibu 24 Horas', // confirm with client if needed
};

interface SheetyResult {
  agregadores:    { [unitName: string]: number };
  wellhubRevenue: { [unitName: string]: number };
}

const fetchSheetyData = async (
  currentMonth: string,
  prevMonth: string,
): Promise<SheetyResult> => {
  const empty: SheetyResult = { agregadores: {}, wellhubRevenue: {} };
  try {
    const res = await fetch(SHEETY_URL);
    if (!res.ok) { console.warn(`[Sheety] HTTP ${res.status}`); return empty; }
    const json = await res.json();
    const rows: any[] = json?.geral2026 ?? [];

    const curr = toSheetyKey(currentMonth);
    const prev = toSheetyKey(prevMonth);

    const agregadores:    { [unitName: string]: number } = {};
    const wellhubRevenue: { [unitName: string]: number } = {};
    let currentUnit: string | null = 'Sorocaba'; // first section has no explicit header row

    for (const row of rows) {
      const label: string = (row.sorocaba ?? '').toString().trim();
      if (!label) continue;
      const upper = label.toUpperCase();

      // Unit header row (e.g. "PIRACICABA", "MOGI MIRIM")
      if (upper in SHEETY_UNIT_MAP) {
        currentUnit = SHEETY_UNIT_MAP[upper];
        continue;
      }

      if (!currentUnit) continue;

      const getValue = (): { value: number; source: string } => {
        // Try current month, then previous month
        for (const key of [curr, prev]) {
          const v = row[key];
          if (typeof v === 'number' && v > 0) return { value: v, source: key };
        }
        // Fallback: spreadsheet may not have current/prev month yet
        // Try all numeric columns, most recent first (Sheety returns columns in order)
        const monthKeys = Object.keys(row)
          .filter(k => k !== 'sorocaba' && k !== 'id' && typeof row[k] === 'number' && row[k] > 0)
          .reverse();
        if (monthKeys.length > 0) return { value: row[monthKeys[0]], source: monthKeys[0] };
        return { value: 0, source: 'none' };
      };

      if (upper === 'AGREGADORES') {
        const { value, source } = getValue();
        if (value > 0) {
          agregadores[currentUnit] = value;
          console.log(`[Sheety] ${currentUnit}: ${value} agregadores (${source})`);
        }
      } else if (upper === 'FATUR. WELLHUB' || upper === 'FATURAMENTO WELLHUB') {
        const { value, source } = getValue();
        if (value > 0) {
          wellhubRevenue[currentUnit] = value;
          console.log(`[Sheety] ${currentUnit}: R$${value} Wellhub revenue (${source})`);
        }
      }
    }

    console.log(
      `[Sheety] ✅ ${Object.keys(agregadores).length} unidades c/ agregadores | ` +
      `${Object.keys(wellhubRevenue).length} unidades c/ receita Wellhub`
    );
    return { agregadores, wellhubRevenue };
  } catch (e) {
    console.error('[Sheety] Erro:', e);
    return empty;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SYNC ORCHESTRATOR
// Two-phase: fetch raw client data for detail, then fetch fast summaries for totals.
// ─────────────────────────────────────────────────────────────────────────────
export const fetchAllUnitsDataSequence = async (
  _force = false,
  onProgress?: (p: number) => void,
): Promise<SyncData> => {
  const today2 = new Date();
  const prevDate = new Date(today2.getFullYear(), today2.getMonth() - 1, 1);
  const prevMonth = format(prevDate, 'yyyy-MM');
  const activeUnits = pactoApiClient.getActiveUnits();
  const currentMonth = format(new Date(), 'yyyy-MM');

  console.log(`[PactoSync] Starting sync for ${activeUnits.length} active units. Month: ${currentMonth}`);

  // Steps: unit clients + unit summaries+BI (parallel) + Gympass
  const totalSteps = activeUnits.length + activeUnits.length + 1;
  let step = 0;
  const tick = () => { step++; onProgress?.(Math.min((step / totalSteps) * 100, 99)); };

  // ── PHASE 1: Fetch raw client records IN PARALLEL (per-unit rate limiter) ──
  // Each unit has its own token → independent on Pacto's server → safe to run concurrently.
  let allClients: any[] = [];
  const syncErrors: string[] = [];

  const phase1Results = await Promise.all(
    activeUnits.map(async (unit) => {
      const clients = await pactoApiClient.fetchUnitClients(unit.name);
      tick();
      return { unit, clients: Array.isArray(clients) ? clients : [] };
    })
  );

  for (const { unit, clients } of phase1Results) {
    if (clients.length === 0) syncErrors.push(unit.name);
    allClients = allClients.concat(clients);
    console.log(`[PactoSync] ${unit.name}: ${clients.length} clientes | empresaId: ${unit.empresaId}`);
  }

  // ── DEDUPLICAÇÃO DESABILITADA ──
  // Mogi Guaçu e Araras compartilham o mesmo token e retornam dados idênticos.
  // A API /clientes não suporta filtro por empresaId (nem header, nem query param).
  // Até descobrirmos como separar, mantemos os dados duplicados para que AMBAS
  // as unidades apareçam no dashboard. Os totais vão ficar inflados, mas
  // cada unidade individual mostra os dados combinados.
  // TODO: quando encontrarmos como filtrar por empresa, reativar a separação.
  const unitFingerprints: { key: string; unitName: string }[] = [];
  for (const { unit, clients } of phase1Results) {
    if (clients.length === 0) continue;
    const firstIds = clients.slice(0, 3).map(c => c.codigoCliente ?? c.matricula ?? '').join(',');
    const key = `${clients.length}|${firstIds}`;
    const existing = unitFingerprints.find(f => f.key === key);
    if (existing) {
      console.warn(`[PactoSync] ⚠️ TOKEN COMPARTILHADO: ${unit.name} e ${existing.unitName} retornam dados idênticos (${clients.length} registros). Dados duplicados mantidos para que ambas apareçam no dashboard.`);
    } else {
      unitFingerprints.push({ key, unitName: unit.name });
    }
  }

  // ── PHASE 1.5: empresaId já está hardcoded no UNIT_CONFIGS ───────────────
  // IDs descobertos via /psec/empresas/ativas: quase todos = 1, Araras = 2.
  // Mogi Guaçu e Araras compartilham token — Mogi Guaçu=1, Araras=2.

  // ── PHASE 2: Fetch summaries + BI SEQUENTIALLY per unit ──────────────────
  // Running sequentially avoids hammering PACTO's API with 330+ parallel
  // requests (11 units × 30 empresaId probes), which causes mass 429 errors.
  const unitSummaries: { [key: string]: any[] | null } = {};
  const biSumm: { [key: string]: { current: any | null; previous: any | null } | null } = {};

  for (const unit of activeUnits) {
    const [summary, bi] = await Promise.all([
      pactoApiClient.fetchClientsSummary(unit.token, unit.empresaId),
      pactoApiClient.fetchBiSummary(unit.name, prevMonth, currentMonth),
    ]);
    unitSummaries[unit.name] = summary;
    biSumm[unit.name] = bi;

    if (summary) {
      console.log(`[PactoSync] ${unit.name} summary (${summary.length} situações):`, JSON.stringify(summary).slice(0, 400));
    } else {
      console.warn(`[PactoSync] ${unit.name}: summary endpoint returned null — contagens virão da paginação`);
    }
    if (bi?.current) {
      console.log(`[PactoSync] ${unit.name} BI current:`, JSON.stringify(bi.current).slice(0, 150));
    }
    tick();
  }

  // ── PHASE 2.5: /movimentacao-contrato — DESABILITADO ──
  // O endpoint requer escopo de permissão `adm:business-intelligence:bi-administrativo:consultar`
  // que não está habilitado nos tokens atuais. Todos retornam HTTP 500.
  // Para reativar: pedir ao Pacto que libere o escopo nos tokens e setar ENABLE_MOVIMENTACAO=true.
  const ENABLE_MOVIMENTACAO = false;
  const movimentacaoData: { [unitName: string]: Awaited<ReturnType<typeof pactoApiClient.fetchMovimentacaoContrato>> } = {};
  let movimentacaoAvailable = false;
  if (ENABLE_MOVIMENTACAO && activeUnits.length > 0) {
    console.log(`[PactoSync] Testando /movimentacao-contrato com ${activeUnits[0].name}...`);
    try {
      const probe = await pactoApiClient.fetchMovimentacaoContrato(activeUnits[0].name);
      if (probe && probe.ativos > 0) {
        movimentacaoAvailable = true;
        movimentacaoData[activeUnits[0].name] = probe;
        console.log(`[MovContrato] ✅ Endpoint disponivel! ${activeUnits[0].name}: ${probe.ativos} ativos`);
        for (const unit of activeUnits.slice(1)) {
          try {
            const mov = await pactoApiClient.fetchMovimentacaoContrato(unit.name);
            if (mov && mov.ativos > 0) {
              movimentacaoData[unit.name] = mov;
              console.log(`[MovContrato] ✅ ${unit.name}: ${mov.ativos} ativos`);
            }
          } catch { /* skip */ }
        }
      } else {
        console.log('[PactoSync] /movimentacao-contrato: probe retornou 0 ativos. Usando contagem por situacao.');
      }
    } catch {
      console.log('[PactoSync] /movimentacao-contrato: endpoint indisponivel (HTTP 500). Usando contagem por situacao.');
    }
  } else if (!ENABLE_MOVIMENTACAO) {
    console.log('[PactoSync] /movimentacao-contrato: DESABILITADO (tokens sem escopo BI). Usando contagem por situacao.');
  }

  // ── PHASE 3: Agregadores + Wellhub revenue via Sheety + PACTO Gympass ────
  const [sheety, pactoGympass] = await Promise.all([
    fetchSheetyData(currentMonth, prevMonth),
    pactoApiClient.fetchAllGympassData().catch((e) => {
      console.warn('[PactoSync] fetchAllGympassData falhou:', e);
      return {} as { [key: string]: number };
    }),
  ]);
  tick();

  onProgress?.(100);

  // Merge gympass: Sheety overrides PACTO, PACTO fills gaps
  const mergedGympass: { [key: string]: number } = { ...pactoGympass };
  for (const [unit, count] of Object.entries(sheety.agregadores)) {
    if (count > 0) mergedGympass[unit] = count;
  }

  const result = processPactoData(allClients, biSumm, mergedGympass, unitSummaries);

  // ── PHASE 4: Override with authoritative /movimentacao-contrato counts ──
  // These are the SAME numbers shown in the Pacto BI screen.
  let movOverrideCount = 0;
  for (const [unitName, mov] of Object.entries(movimentacaoData)) {
    if (!mov || !result.clientData.clientsByCompany[unitName]) continue;
    const s = result.clientData.clientsByCompany[unitName];
    const oldActive = s.active;
    if (mov.ativos > 0) {
      s.active = mov.ativos;
      movOverrideCount++;
      if (oldActive !== mov.ativos) {
        console.log(`[PactoSync] ${unitName}: ativos corrigidos ${oldActive} → ${mov.ativos} (via /movimentacao-contrato)`);
      }
    }
    if (mov.cancelados > 0) {
      s.cancellations = mov.cancelados;
    }
    if (mov.matriculados > 0) {
      s.newEnrollments = mov.matriculados;
    }
  }

  if (movOverrideCount > 0) {
    // Recalculate 'all' aggregates after override
    let totalActive = 0, totalNewEnrollments = 0, totalCancellations = 0;
    for (const s of Object.values(result.clientData.clientsByCompany)) {
      totalActive += s.active;
      totalNewEnrollments += s.newEnrollments;
      totalCancellations += s.cancellations;
    }
    result.clientData.activeClients = totalActive;
    result.clientData.active = totalActive;
    result.clientData.totalNewEnrollments = totalNewEnrollments;
    result.clientData.totalCancellations = totalCancellations;
    console.log(`[PactoSync] ✅ ${movOverrideCount} unidades com contagens corrigidas via /movimentacao-contrato`);
  }

  // Add Wellhub revenue on top of Pacto faturamento
  for (const [unitName, wRev] of Object.entries(sheety.wellhubRevenue)) {
    if (result.clientData.clientsByCompany[unitName] && wRev > 0) {
      result.clientData.clientsByCompany[unitName].realRevenue += wRev;
    }
  }
  // Recalculate aggregate after Wellhub injection
  const recalcRevenue = Object.values(result.clientData.clientsByCompany)
    .reduce((sum, s) => sum + s.realRevenue, 0);
  result.clientData.totalRealRevenue = recalcRevenue;
  result.clientData.realRevenue = recalcRevenue;

  console.log(
    `[PactoSync] ✅ Done. Ativos: ${result.clientData.activeClients} | ` +
    `Inadimplentes: ${result.clientData.delinquentClients} | ` +
    `Gympass: ${result.clientData.gympassClients} | ` +
    `Faturamento: R$${result.clientData.totalRealRevenue?.toFixed(2)} | ` +
    `Erros: ${syncErrors.length > 0 ? syncErrors.join(', ') : 'nenhum'}`
  );
  return { ...result, syncErrors };
};
