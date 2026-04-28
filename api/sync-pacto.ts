// NocoDB integration — replaces Supabase for dashboard_sync storage
const NOCODB_BASE_URL = 'https://app.nocodb.com/api/v1';
const NOCODB_TOKEN = process.env.NOCODB_TOKEN || 'vgfnX7Pkz4Nm_ha8RhRr-rHWR6H3SxnPuBCNnKpM';
const NOCODB_PROJECT_ID = 'pbeaqdmhiy69ylu';
const NOCODB_SYNC_TABLE = 'mqbz9gf5j9nzw1v'; // dashboard_sync table ID

async function nocoUpsertSync(data: object): Promise<void> {
  const baseUrl = `${NOCODB_BASE_URL}/db/data/noco/${NOCODB_PROJECT_ID}/${NOCODB_SYNC_TABLE}`;
  const headers = { 'xc-token': NOCODB_TOKEN, 'Content-Type': 'application/json' };

  // Fetch existing row
  const listRes = await fetch(`${baseUrl}?limit=1&sort=-last_updated`, { headers });
  const listJson = await listRes.json();
  const existing = listJson?.list?.[0];

  const payload = {
    data: JSON.stringify(data),
    last_updated: new Date().toISOString(),
  };

  if (existing?.Id) {
    await fetch(`${baseUrl}/${existing.Id}`, { method: 'PATCH', headers, body: JSON.stringify(payload) });
  } else {
    await fetch(baseUrl, { method: 'POST', headers, body: JSON.stringify(payload) });
  }
}

// Configuration for Pacto units - duplicated from client.ts to keep serverless function independent
const UNIT_TOKENS = {
  AMERICANAS:          process.env.VITE_PACTO_AMERICANAS_API_TOKEN,
  MOGI_GUACU:          process.env.VITE_PACTO_MOGIGUACU_API_TOKEN,
  ARACATUBA:           process.env.VITE_PACTO_ARACATUBA_API_TOKEN,
  PIRACICABA:          process.env.VITE_PACTO_PIRACICABA_API_TOKEN,
  PRESIDENTE_PRUDENTE: process.env.VITE_PACTO_PRESIDENTE_PRUDENTE_API_TOKEN,
  SAO_JOAO:            process.env.VITE_PACTO_SAO_JOAO_API_TOKEN,
  ARARAS:              process.env.VITE_PACTO_ARARAS_API_TOKEN,
  MOGI_MIRIM:          process.env.VITE_PACTO_MOGIMIRIM_API_TOKEN,
  PAULINIA:            process.env.VITE_PACTO_PAULINIA_API_TOKEN,
  MALIBU_24HORAS:      process.env.VITE_PACTO_24HORAS_API_TOKEN,
  SOROCABA:            process.env.VITE_PACTO_SOROCABA_API_TOKEN,
};

const UNIT_CONFIGS = [
  { name: 'Americanas',          token: UNIT_TOKENS.AMERICANAS,          empresaId: '1'  },
  { name: 'Mogi Guaçu',          token: UNIT_TOKENS.MOGI_GUACU,          empresaId: '2'  },
  { name: 'Araçatuba',           token: UNIT_TOKENS.ARACATUBA,           empresaId: '3'  },
  { name: 'Piracicaba',          token: UNIT_TOKENS.PIRACICABA,          empresaId: '4'  },
  { name: 'Presidente Prudente', token: UNIT_TOKENS.PRESIDENTE_PRUDENTE, empresaId: '5'  },
  { name: 'São João',            token: UNIT_TOKENS.SAO_JOAO,            empresaId: '6'  },
  { name: 'Araras',              token: UNIT_TOKENS.ARARAS,              empresaId: '7'  },
  { name: 'Mogi Mirim',          token: UNIT_TOKENS.MOGI_MIRIM,          empresaId: '8'  },
  { name: 'Paulínia',            token: UNIT_TOKENS.PAULINIA,            empresaId: '9'  },
  { name: 'Malibu 24 Horas',     token: UNIT_TOKENS.MALIBU_24HORAS,      empresaId: '10' },
  { name: 'Sorocaba',            token: UNIT_TOKENS.SOROCABA,            empresaId: '11' },
];

const PACTO_BASE = 'https://apigw.pactosolucoes.com.br';
const SHEETY_BASE_URL = 'https://api.sheety.co/cd1d179ec9a92ce2e25859ab03de9510/acompanhamentoDeResultados2026/geral2026';

// ── Revenue extraction — tries ALL known Pacto BI field names ──
const extractRevenue = (rec: any): number => {
  if (!rec) return 0;
  return rec.totalReceita ?? rec.totalFaturamento ?? rec.totalCompetencia ??
    rec.receitaTotal ?? rec.receita ?? rec.recebiveis ??
    rec.contasReceberPorDataQuitacao ?? rec.competencia ?? rec.total ?? 0;
};

// ── Sheety extraction — same logic as pactoSync.ts ──
const PT_MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
                   'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const toSheetyKey = (yyyymm: string): string => {
  const [y, m] = yyyymm.split('-');
  return `${PT_MONTHS[parseInt(m, 10) - 1]}/${y.slice(2)}`;
};

const SHEETY_UNIT_MAP: { [k: string]: string | null } = {
  'PIRACICABA':    'Piracicaba',
  'HORTOLÂNDIA':   null,
  'MOGI MIRIM':    'Mogi Mirim',
  'MOGI GUAÇU':    'Mogi Guaçu',
  'SÃO JOÃO':      'São João',
  'ARAÇATUBA':     'Araçatuba',
  'ARARAS':        'Araras',
  'PRUDENTE':      'Presidente Prudente',
  'AMERICANA':     'Americanas',
  'PAULÍNIA':      'Paulínia',
  'SUMARÉ':        'Malibu 24 Horas',
};

interface SheetyResult {
  agregadores:    { [unitName: string]: number };
  wellhubRevenue: { [unitName: string]: number };
}

async function fetchSheetyData(currentMonth: string, prevMonth: string): Promise<SheetyResult> {
  const empty: SheetyResult = { agregadores: {}, wellhubRevenue: {} };
  try {
    const res = await fetch(SHEETY_BASE_URL);
    if (!res.ok) { console.warn(`[Cron/Sheety] HTTP ${res.status}`); return empty; }
    const json = await res.json();
    const rows: any[] = json?.geral2026 ?? [];

    const curr = toSheetyKey(currentMonth);
    const prev = toSheetyKey(prevMonth);

    const agregadores:    { [unitName: string]: number } = {};
    const wellhubRevenue: { [unitName: string]: number } = {};
    let currentUnit: string | null = 'Sorocaba';

    for (const row of rows) {
      const label: string = (row.sorocaba ?? '').toString().trim();
      if (!label) continue;
      const upper = label.toUpperCase();

      if (upper in SHEETY_UNIT_MAP) {
        currentUnit = SHEETY_UNIT_MAP[upper];
        continue;
      }

      if (!currentUnit) continue;

      const getValue = (): number => {
        for (const key of [curr, prev]) {
          const v = row[key];
          if (typeof v === 'number' && v > 0) return v;
        }
        const monthKeys = Object.keys(row)
          .filter(k => k !== 'sorocaba' && k !== 'id' && typeof row[k] === 'number' && row[k] > 0)
          .reverse();
        return monthKeys.length > 0 ? row[monthKeys[0]] : 0;
      };

      if (upper === 'AGREGADORES') {
        const v = getValue();
        if (v > 0) agregadores[currentUnit] = v;
      } else if (upper === 'FATUR. WELLHUB' || upper === 'FATURAMENTO WELLHUB') {
        const v = getValue();
        if (v > 0) wellhubRevenue[currentUnit] = v;
      }
    }

    console.log(`[Cron/Sheety] ${Object.keys(agregadores).length} unidades c/ agregadores | ${Object.keys(wellhubRevenue).length} c/ receita Wellhub`);
    return { agregadores, wellhubRevenue };
  } catch (e) {
    console.error('[Cron/Sheety] Erro:', e);
    return empty;
  }
}

// ── Empty stats template (matches ProcessedStats interface) ──
const emptyStats = () => ({
  active: 0, visitor: 0, gympass: 0, delinquent: 0,
  other: 0, total: 0, expiringToday: 0, expiringInMonth: 0,
  expiringInThreeMonths: 0, expired: 0, pending: 0, pendingValue: 0,
  delinquent1Month: 0, delinquent2Months: 0, delinquent3Months: 0,
  delinquent4PlusMonths: 0, realRevenue: 0, prevRevenue: 0, newEnrollments: 0, cancellations: 0,
});

export default async function handler(req: any, res: any) {
  const authHeader = req.headers['authorization'];
  if (process.env.NODE_ENV === 'production' && !req.headers['x-vercel-cron'] && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('[Cron] Starting Pacto & Sheety Sync...');

  try {
    const activeUnits = UNIT_CONFIGS.filter(u => u.token && u.token.length > 10);
    const syncErrors: string[] = [];
    const clientsByCompany: Record<string, ReturnType<typeof emptyStats>> = {};
    const companies: string[] = [];

    const now = new Date();
    const currentMonth = now.toISOString().slice(0, 7);
    const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

    // ── Helper: fetch with retry for 429 rate limiting ──
    const fetchWithRetry = async (url: string, options: RequestInit, retries = 3): Promise<Response> => {
      const r = await fetch(url, options);
      if (r.status === 429 && retries > 0) {
        console.warn(`[Cron] Rate limited. Retrying in 4s... (${retries} left)`);
        await new Promise(resolve => setTimeout(resolve, 4000));
        return fetchWithRetry(url, options, retries - 1);
      }
      return r;
    };

    // Helper: extract count from Pacto paginated response (tries multiple field names)
    const extractCount = (data: any): number => {
      if (!data) return 0;
      return data?.totalElements ??
        (data?.totalPages != null && data?.size != null ? data.totalPages * data.size : null) ??
        data?.total ??
        data?.numberOfElements ??
        (Array.isArray(data?.content) ? data.content.length : null) ??
        (Array.isArray(data) ? data.length : null) ??
        0;
    };

    // ── 1. Fetch BI + client counts per unit — SEQUENTIAL to avoid rate limiting ──
    for (const unit of activeUnits) {
      const stats = emptyStats();
      try {
        // BI Revenue (current + previous month)
        const biRes = await fetchWithRetry(
          `${PACTO_BASE}/v1/bi/resumo?mesInicial=${prevMonth}&mesFinal=${currentMonth}`,
          { headers: { 'accept': 'application/json', 'Authorization': `Bearer ${unit.token}`, 'empresaId': unit.empresaId } }
        );
        if (biRes.ok) {
          const biData = await biRes.json();
          const content: any[] = Array.isArray(biData?.content) ? biData.content : biData ? [biData] : [];
          const findMonth = (m: string) => content.find((c: any) => c?.mes === m || c?.mes?.startsWith(m));
          const currentRec = findMonth(currentMonth) ?? content[0] ?? null;
          const previousRec = findMonth(prevMonth) ?? (content.length > 1 ? content[1] : null) ?? null;
          stats.realRevenue = extractRevenue(currentRec);
          stats.prevRevenue = extractRevenue(previousRec);
        }

        // ── MÉTODO PRINCIPAL: GET /cancelamento-contrato/contratos-ativos ──
        const movHeaders = { 'accept': 'application/json', 'Authorization': `Bearer ${unit.token}` };

        try {
          await new Promise(resolve => setTimeout(resolve, 500));
          const r = await fetchWithRetry(
            `${PACTO_BASE}/cancelamento-contrato/contratos-ativos`,
            { headers: movHeaders }
          );

          if (r.ok) {
            const data = await r.json();
            console.log(`[Cron] ${unit.name} /cancelamento-contrato/contratos-ativos:`, JSON.stringify(data).slice(0, 800));

            let count = 0;
            if (typeof data === 'number') count = data;
            else if (Array.isArray(data)) count = data.length;
            else if (data?.totalElements != null) count = Number(data.totalElements);
            else if (Array.isArray(data?.content)) count = data.totalElements ?? data.content.length;
            else if (data?.content?.contratos && Array.isArray(data.content.contratos)) count = data.totalElements ?? data.content.contratos.length;
            else if (data?.total != null) count = Number(data.total);
            else if (data?.quantidade != null) count = Number(data.quantidade);

            if (count > 0) {
              stats.active = count;
              console.log(`[Cron] ✅ ${unit.name}: ${count} contratos ativos`);
            } else {
              console.warn(`[Cron] ⚠️ ${unit.name}: resposta OK mas count=0`);
            }
          } else {
            console.warn(`[Cron] ❌ ${unit.name} /cancelamento-contrato/contratos-ativos: HTTP ${r.status}`);
          }
        } catch (e) {
          console.error(`[Cron] ❌ ${unit.name} contratos-ativos erro:`, e);
        }

        console.log(`[Cron] ${unit.name}: ativos=${stats.active} inadimp=${stats.delinquent} visit=${stats.visitor} cancel=${stats.expired} receita=R$${stats.realRevenue.toFixed(2)}`);
      } catch (e) {
        console.error(`[Cron] Error syncing ${unit.name}:`, e);
        syncErrors.push(unit.name);
      }
      clientsByCompany[unit.name] = stats;
      companies.push(unit.name);
    }

    // ── 2. Fetch Sheety (Agregadores + Wellhub Revenue) ──
    const sheety = await fetchSheetyData(currentMonth, prevMonth);

    // Inject Gympass counts from Sheety
    for (const [unitName, count] of Object.entries(sheety.agregadores)) {
      if (clientsByCompany[unitName] && count > 0) {
        clientsByCompany[unitName].gympass = count;
      }
    }

    // Inject Wellhub revenue on top of Pacto BI
    for (const [unitName, wRev] of Object.entries(sheety.wellhubRevenue)) {
      if (clientsByCompany[unitName] && wRev > 0) {
        clientsByCompany[unitName].realRevenue += wRev;
      }
    }

    // ── 3. Build 'all' aggregate ──
    const all = emptyStats();
    for (const s of Object.values(clientsByCompany)) {
      all.active       += s.active;
      all.visitor       += s.visitor;
      all.gympass       += s.gympass;
      all.delinquent   += s.delinquent;
      all.other        += s.other;
      all.total        += s.total;
      all.expired      += s.expired;
      all.realRevenue  += s.realRevenue;
      all.prevRevenue  += s.prevRevenue;
      all.delinquent1Month     += s.delinquent1Month;
      all.delinquent2Months    += s.delinquent2Months;
      all.delinquent3Months    += s.delinquent3Months;
      all.delinquent4PlusMonths += s.delinquent4PlusMonths;
    }

    // ── 4. Build SyncData payload (matches interface expected by PactoDataContext) ──
    const payload = {
      clientData: {
        ...all,
        clientsByCompany,
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
      companyOptions: companies.sort(),
      lastSyncISO: new Date().toISOString(),
      syncErrors,
    };

    // ── 5. Save to NocoDB ──
    await nocoUpsertSync(payload);

    console.log(
      `[Cron] ✅ Done. Ativos: ${all.active} | Gympass: ${all.gympass} | ` +
      `Faturamento: R$${all.realRevenue.toFixed(2)} | Erros: ${syncErrors.length > 0 ? syncErrors.join(', ') : 'nenhum'}`
    );

    return res.status(200).json({ success: true, units: companies.length, active: all.active, revenue: all.realRevenue });
  } catch (error: any) {
    console.error('[Cron] Sync failed:', error);
    return res.status(500).json({ error: error.message });
  }
}
