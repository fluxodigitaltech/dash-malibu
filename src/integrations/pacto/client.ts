// src/integrations/pacto/client.ts
const PACTO_API_BASE_URL = '/api/pacto';

// ============================================================
// TOKENS — Source of Truth: ALL from environment variables
// ============================================================
export const PACTO_TOKENS = {
  AMERICANAS:          import.meta.env.VITE_PACTO_AMERICANAS_API_TOKEN          || '',
  MOGI_GUACU:          import.meta.env.VITE_PACTO_MOGIGUACU_API_TOKEN           || '',
  ARACATUBA:           import.meta.env.VITE_PACTO_ARACATUBA_API_TOKEN           || '',
  PIRACICABA:          import.meta.env.VITE_PACTO_PIRACICABA_API_TOKEN          || '',
  PRESIDENTE_PRUDENTE: import.meta.env.VITE_PACTO_PRESIDENTE_PRUDENTE_API_TOKEN || '',
  SAO_JOAO:            import.meta.env.VITE_PACTO_SAO_JOAO_API_TOKEN            || '',
  ARARAS:              import.meta.env.VITE_PACTO_ARARAS_API_TOKEN              || '',
  MOGI_MIRIM:          import.meta.env.VITE_PACTO_MOGIMIRIM_API_TOKEN           || '',
  PAULINIA:            import.meta.env.VITE_PACTO_PAULINIA_API_TOKEN            || '',
  MALIBU_24HORAS:      import.meta.env.VITE_PACTO_24HORAS_API_TOKEN             || '',
  SOROCABA:            import.meta.env.VITE_PACTO_SOROCABA_API_TOKEN            || '',
};

// ============================================================
// UNIT CONFIGURATION — name, token, empresaId (for BI endpoint)
// empresaId is the internal Pacto company ID used in headers
// ============================================================
export interface UnitConfig {
  name: string;
  token: string;
  empresaId: string;       // Required for /v1/bi/resumo
  empresaNome?: string;    // Pacto company name — used to filter shared tokens
  includeRenewed?: boolean; // Se true, conta INATIVO com situacaoContrato=NORMAL como ativo (corrige unidades com "Renovado" oculto)
}

// empresaId REAL descoberto via /psec/empresas/ativas e /psec/empresas/empdto:
// Mogi Guaçu e Araras compartilham o mesmo token — Mogi Guaçu = 1, Araras = 2.
// empresaNome = nome real no Pacto, usado para filtrar registros do token compartilhado.
// empresaNome = substring do nome real no Pacto (campo c.empresa da API)
// Cada token retorna clientes de TODAS as unidades da rede.
// O filtro por empresaNome garante que cada unidade veja apenas seus próprios clientes.
// Nomes reais confirmados via "Trocar Empresa" no Pacto:
//   ACAD. MALIBU EXCLUSIVE UNID. MOGI GUACU - SP
//   ACAD. MALIBU EXCLUSIVA UNID. AMERICANA - SP
//   ACAD. MALIBU EXCLUSIVE UNID. ARACATUBA - SP
//   ACAD. MALIBU EXCLUSIVE UNID. PIRACICABA- SP
//   ACAD. MALIBU EXCLUSIVE UNID. PRESIDENTE PRUDENTE -
//   ACAD. MALIBU EXCLUSIVE UNID. SAO JOAO - SP
//   ACAD. MALIBU UNID. ARARAS - SP
//   ACAD. MALIBU UNID. MOGI MIRIM - SP
//   ACAD. MALIBU UNID. PAULINIA - SP
//   MALIBU EXCLUSIVE 24 HORAS
//   MALIBU EXCLUSIVE UNID. SOROCABA - SP
export const UNIT_CONFIGS: UnitConfig[] = [
  { name: 'Americanas',          token: PACTO_TOKENS.AMERICANAS,          empresaId: '1', empresaNome: 'AMERICANA' },
  { name: 'Mogi Guaçu',          token: PACTO_TOKENS.MOGI_GUACU,          empresaId: '1', empresaNome: 'MOGI GUACU',          includeRenewed: true },
  { name: 'Araçatuba',           token: PACTO_TOKENS.ARACATUBA,           empresaId: '1', empresaNome: 'ARACATUBA',           includeRenewed: true },
  { name: 'Piracicaba',          token: PACTO_TOKENS.PIRACICABA,          empresaId: '1', empresaNome: 'PIRACICABA' },
  { name: 'Presidente Prudente', token: PACTO_TOKENS.PRESIDENTE_PRUDENTE, empresaId: '1', empresaNome: 'PRESIDENTE PRUDENTE' },
  { name: 'São João',            token: PACTO_TOKENS.SAO_JOAO,            empresaId: '1', empresaNome: 'SAO JOAO',            includeRenewed: true },
  { name: 'Araras',              token: PACTO_TOKENS.ARARAS,              empresaId: '2', empresaNome: 'ARARAS',              includeRenewed: true },
  { name: 'Mogi Mirim',          token: PACTO_TOKENS.MOGI_MIRIM,          empresaId: '1', empresaNome: 'MOGI MIRIM' },
  { name: 'Paulínia',            token: PACTO_TOKENS.PAULINIA,            empresaId: '1', empresaNome: 'PAULINIA' },
  { name: 'Malibu 24 Horas',     token: PACTO_TOKENS.MALIBU_24HORAS,      empresaId: '1', empresaNome: '24 HORAS' },
  { name: 'Sorocaba',            token: PACTO_TOKENS.SOROCABA,            empresaId: '1', empresaNome: 'SOROCABA' },
];

// Helper — get unit config by exact name
export const getUnitConfig = (name: string): UnitConfig | undefined =>
  UNIT_CONFIGS.find(u => u.name === name);

// Helper — get unit config by token
export const getUnitConfigByToken = (token: string): UnitConfig | undefined =>
  UNIT_CONFIGS.find(u => u.token === token);


// ============================================================
// RATE LIMITING & RETRY
// ============================================================
class RateLimiter {
  private queue: Promise<void> = Promise.resolve();
  private readonly delayMs: number;
  constructor(delayMs: number) { this.delayMs = delayMs; }
  async waitForNextRequest(): Promise<void> {
    const currentQueue = this.queue;
    let resolveNext!: () => void;
    this.queue = new Promise(resolve => { resolveNext = resolve; });
    await currentQueue;
    await new Promise(resolve => setTimeout(resolve, this.delayMs));
    resolveNext();
  }
}

// Per-unit rate limiters — each token is independent on Pacto's server,
// so parallel fetching across units is safe. 1 000 ms is conservative.
const _tokenRateLimiters = new Map<string, RateLimiter>();
const getRateLimiter = (token: string): RateLimiter => {
  if (!_tokenRateLimiters.has(token)) {
    _tokenRateLimiters.set(token, new RateLimiter(1000));
  }
  return _tokenRateLimiters.get(token)!;
};

async function fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
  const res = await fetch(url, options);
  if (res.status === 429 && retries > 0) {
    console.warn(`[PACTO] Rate limited. Retrying in 4s... (${retries} left)`);
    await new Promise(r => setTimeout(r, 4000));
    return fetchWithRetry(url, options, retries - 1);
  }
  return res;
}

// ============================================================
// DIAGNÓSTICO — Descobrir info de cada token
// ============================================================
if (typeof window !== 'undefined') {
  // Decodificar JWTs e mostrar empresa ID, scopes, etc.
  // Chamar no console: window.decodeTokens()
  (window as any).decodeTokens = () => {
    const units = [
      { name: 'Americanas', token: PACTO_TOKENS.AMERICANAS },
      { name: 'Mogi Guaçu', token: PACTO_TOKENS.MOGI_GUACU },
      { name: 'Araçatuba', token: PACTO_TOKENS.ARACATUBA },
      { name: 'Piracicaba', token: PACTO_TOKENS.PIRACICABA },
      { name: 'Presidente Prudente', token: PACTO_TOKENS.PRESIDENTE_PRUDENTE },
      { name: 'São João', token: PACTO_TOKENS.SAO_JOAO },
      { name: 'Araras', token: PACTO_TOKENS.ARARAS },
      { name: 'Mogi Mirim', token: PACTO_TOKENS.MOGI_MIRIM },
      { name: 'Paulínia', token: PACTO_TOKENS.PAULINIA },
      { name: 'Malibu 24 Horas', token: PACTO_TOKENS.MALIBU_24HORAS },
      { name: 'Sorocaba', token: PACTO_TOKENS.SOROCABA },
    ];

    const results: Record<string, any> = {};

    for (const unit of units) {
      if (!unit.token || unit.token.length < 10) {
        console.log(`⏭️ ${unit.name}: sem token`);
        continue;
      }

      try {
        // JWT = header.payload.signature — decodificar payload (parte 2)
        const parts = unit.token.split('.');
        if (parts.length === 3) {
          // Base64url decode
          const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
          console.log(`\n🔑 ${unit.name}:`, JSON.stringify(payload, null, 2));
          results[unit.name] = payload;
        } else {
          console.log(`⚠️ ${unit.name}: token não é JWT (${parts.length} partes)`);
          results[unit.name] = { error: 'not-jwt', tokenPreview: unit.token.slice(0, 20) + '...' };
        }
      } catch (e: any) {
        console.log(`❌ ${unit.name}: erro ao decodificar:`, e.message);
        results[unit.name] = { error: e.message };
      }
    }

    console.log('\n📊 RESUMO TOKENS:', JSON.stringify(results, null, 2));
    (window as any).__TOKEN_DATA__ = results;
    console.log('💡 Dados salvos em window.__TOKEN_DATA__');
    return results;
  };
  // Testar /d2/clientes pra todas as unidades — descobrir IDs e estrutura
  // Chamar no console: window.testD2Clientes()
  (window as any).testD2Clientes = async () => {
    const results: Record<string, any> = {};
    const d2Endpoints = [
      '/d2/clientes?page=0&size=1',
      '/d2/clientes?page=0&size=1&situacao=ATIVO',
      '/d2/clientes',
      '/d2/cliente',
      '/d2/contratos?page=0&size=1',
      '/d2/contrato',
      '/d2/empresas',
      '/d2/empresa',
    ];

    for (const unit of UNIT_CONFIGS) {
      if (!unit.token || unit.token.length < 10) continue;
      const h = { accept: 'application/json', Authorization: `Bearer ${unit.token}` };
      results[unit.name] = {};
      console.log(`\n🔍 ${unit.name}...`);

      for (const ep of d2Endpoints) {
        try {
          await new Promise(r => setTimeout(r, 500));
          const res = await fetch(`${PACTO_API_BASE_URL}${ep}`, { headers: h });
          const status = res.status;
          if (res.ok) {
            const data = await res.json();
            const preview = JSON.stringify(data).slice(0, 600);
            console.log(`  ✅ ${ep} → ${status}:`, preview);
            results[unit.name][ep] = { status, data, keys: data?.content?.[0] ? Object.keys(data.content[0]) : Object.keys(data) };
          } else {
            console.log(`  ❌ ${ep} → ${status}`);
            results[unit.name][ep] = { status };
          }
        } catch (e: any) {
          console.log(`  💥 ${ep} → erro:`, e.message);
        }
      }
    }

    console.log('\n📊 RESUMO /d2:', JSON.stringify(results, null, 2));
    (window as any).__D2_RESULTS__ = results;
    console.log('💡 Resultados salvos em window.__D2_RESULTS__');
    return results;
  };

  // Testar endpoints de CONTRATOS (separado de clientes)
  // Chamar no console: window.testContratos()
  (window as any).testContratos = async () => {
    const endpoints = [
      // EMPRESA — descobrir ID real
      '/empresa/empresas',
      '/empresa/empresas?filters=%7B%22ativo%22%3Atrue%7D',
      // CONTRATOS
      '/contratos?page=0&size=1',
      '/contrato?page=0&size=1',
      '/v1/contratos?page=0&size=1',
      '/contratos/ativos?page=0&size=1',
      '/contratos?situacao=NORMAL&page=0&size=1',
      '/cancelamento-contrato/contratos-ativos',
      // RELATÓRIOS
      '/rel-contratos/situacao',
      '/rel-clientes/situacao',
      '/relatorio/clientes/situacao',
      // INDICADORES / DASHBOARD
      '/inadimplencia',
      '/dashboard',
      '/resumo',
      '/indicadores',
      '/scopes?page=0&size=100',
    ];

    // Testar com TODOS os tokens pra pegar o empresaId de cada unidade
    const units = [
      { name: 'Americanas', token: PACTO_TOKENS.AMERICANAS },
      { name: 'Mogi Guaçu', token: PACTO_TOKENS.MOGI_GUACU },
      { name: 'Araçatuba', token: PACTO_TOKENS.ARACATUBA },
      { name: 'Piracicaba', token: PACTO_TOKENS.PIRACICABA },
      { name: 'Presidente Prudente', token: PACTO_TOKENS.PRESIDENTE_PRUDENTE },
      { name: 'São João', token: PACTO_TOKENS.SAO_JOAO },
      { name: 'Araras', token: PACTO_TOKENS.ARARAS },
      { name: 'Mogi Mirim', token: PACTO_TOKENS.MOGI_MIRIM },
      { name: 'Paulínia', token: PACTO_TOKENS.PAULINIA },
      { name: 'Malibu 24 Horas', token: PACTO_TOKENS.MALIBU_24HORAS },
      { name: 'Sorocaba', token: PACTO_TOKENS.SOROCABA },
    ];

    const results: Record<string, any> = {};

    // MOSTRAR TOKENS no console pra conferência
    console.log('🔑 === TOKENS CONFIGURADOS ===');
    for (const unit of units) {
      const tkn = unit.token || '(vazio)';
      const masked = tkn.length > 10 ? tkn.slice(0, 8) + '...' + tkn.slice(-4) : tkn;
      console.log(`  ${unit.name}: ${masked} (${tkn.length} chars)`);
    }
    console.log('');

    // PRIMEIRO: testar /psec/empresas/ativas e /empresa/empresas com cada token
    console.log('🏢 === DESCOBRINDO EMPRESA IDs ===\n');
    for (const unit of units) {
      if (!unit.token || unit.token.length < 10) continue;
      const h: Record<string, string> = { accept: 'application/json', Authorization: `Bearer ${unit.token}` };

      // Tentar /psec/empresas/ativas com empresaId 1
      try {
        await new Promise(r => setTimeout(r, 800));
        const res = await fetch(`${PACTO_API_BASE_URL}/psec/empresas/ativas`, {
          headers: { ...h, empresaId: '1' }
        });
        if (res.ok) {
          const data = await res.json();
          console.log(`✅ ${unit.name} /psec/empresas/ativas:`, JSON.stringify(data).slice(0, 500));
          results[`${unit.name}_psec_ativas`] = data;
        } else {
          console.log(`❌ ${unit.name} /psec/empresas/ativas: HTTP ${res.status}`);
        }
      } catch {}

      // Tentar /psec/empresas/empdto/{id} de 1 a 30
      console.log(`  🔍 ${unit.name}: testando /psec/empresas/empdto/1..30`);
      for (let id = 1; id <= 30; id++) {
        try {
          await new Promise(r => setTimeout(r, 500));
          const res = await fetch(`${PACTO_API_BASE_URL}/psec/empresas/empdto/${id}`, { headers: h });
          if (res.ok) {
            const data = await res.json();
            console.log(`  ✅ ${unit.name} empdto/${id}:`, JSON.stringify(data).slice(0, 400));
            if (!results[`${unit.name}_empdto`]) results[`${unit.name}_empdto`] = {};
            results[`${unit.name}_empdto`][id] = data;
          }
        } catch {}
      }

      // Tentar /empresa/empresas
      try {
        await new Promise(r => setTimeout(r, 800));
        const res = await fetch(`${PACTO_API_BASE_URL}/empresa/empresas?filters=%7B%22ativo%22%3Atrue%7D`, { headers: h });
        if (res.ok) {
          const data = await res.json();
          console.log(`✅ ${unit.name} /empresa/empresas:`, JSON.stringify(data).slice(0, 500));
          results[`${unit.name}_empresa`] = data;
        }
      } catch {}
    }

    // TESTE CRÍTICO: token Mogi Guaçu com empresaId query param para separar dados
    console.log('\n🔬 === TESTE: /clientes com empresaId query param (token Mogi Guaçu) ===');
    const mogiToken = PACTO_TOKENS.MOGI_GUACU;
    if (mogiToken && mogiToken.length > 10) {
      const mogiH = { accept: 'application/json', Authorization: `Bearer ${mogiToken}` };
      for (const eid of ['1', '2']) {
        try {
          await new Promise(r => setTimeout(r, 800));
          // Teste 1: empresaId como query param
          const r1 = await fetch(`${PACTO_API_BASE_URL}/clientes?page=0&size=1&empresaId=${eid}`, { headers: mogiH });
          if (r1.ok) {
            const d1 = await r1.json();
            console.log(`  ✅ /clientes?empresaId=${eid} (query): totalElements=${d1.totalElements}`, JSON.stringify(d1.content?.[0] ?? {}).slice(0, 200));
          } else {
            console.log(`  ❌ /clientes?empresaId=${eid} (query): HTTP ${r1.status}`);
          }
          // Teste 2: empresaId como header
          await new Promise(r => setTimeout(r, 500));
          const r2 = await fetch(`${PACTO_API_BASE_URL}/clientes?page=0&size=1`, { headers: { ...mogiH, empresaId: eid } });
          if (r2.ok) {
            const d2 = await r2.json();
            console.log(`  ✅ /clientes+header empresaId=${eid}: totalElements=${d2.totalElements}`);
          } else {
            console.log(`  ❌ /clientes+header empresaId=${eid}: HTTP ${r2.status}`);
          }
        } catch (e: any) {
          console.log(`  💥 empresaId=${eid}:`, e.message);
        }
      }
      // Teste 3: sem empresaId (baseline)
      try {
        await new Promise(r => setTimeout(r, 500));
        const r3 = await fetch(`${PACTO_API_BASE_URL}/clientes?page=0&size=1`, { headers: mogiH });
        if (r3.ok) {
          const d3 = await r3.json();
          console.log(`  ✅ /clientes SEM empresaId: totalElements=${d3.totalElements}`);
        }
      } catch {}
    }

    // DEPOIS: testar outros endpoints com 1 token só (Americanas)
    const token = PACTO_TOKENS.AMERICANAS;
    const h = { accept: 'application/json', Authorization: `Bearer ${token}` };
    console.log('\n🔍 Testando outros endpoints com token Americanas...\n');

    for (const ep of endpoints) {
      try {
        await new Promise(r => setTimeout(r, 600));
        const res = await fetch(`${PACTO_API_BASE_URL}${ep}`, { headers: h });
        if (res.ok) {
          const data = await res.json();
          const preview = JSON.stringify(data).slice(0, 600);
          console.log(`✅ ${ep} → ${res.status}:`, preview);
          results[ep] = { status: res.status, totalElements: data?.totalElements, keys: data?.content?.[0] ? Object.keys(data.content[0]) : undefined, data };
        } else {
          const status = res.status;
          let body = '';
          try { body = (await res.text()).slice(0, 200); } catch {}
          if (status !== 404) {
            console.log(`❌ ${ep} → ${status}: ${body}`);
          }
          results[ep] = { status, body };
        }
      } catch (e: any) {
        results[ep] = { error: e.message };
      }
    }

    console.log('\n📊 RESUMO CONTRATOS:', JSON.stringify(results, null, 2));
    (window as any).__CONTRATOS_RESULTS__ = results;
    return results;
  };

  // Discovery geral — testa vários endpoints
  (window as any).discoverEmpresaIds = async () => {
    const results: Record<string, any> = {};
    const endpoints = [
      '/empresa', '/empresas', '/empresas/atual', '/v1/empresa',
      '/d2/clientes?page=0&size=1', '/d2/empresas', '/d2/empresa',
      '/usuario', '/unidade', '/unidades', '/filial', '/filiais',
      '/configuracao', '/perfil', '/me', '/conta',
    ];

    for (const unit of UNIT_CONFIGS) {
      if (!unit.token || unit.token.length < 10) continue;
      const h = { accept: 'application/json', Authorization: `Bearer ${unit.token}` };
      results[unit.name] = {};

      console.log(`\n🔍 ${unit.name}...`);

      for (const ep of endpoints) {
        try {
          await new Promise(r => setTimeout(r, 400));
          const res = await fetch(`${PACTO_API_BASE_URL}${ep}`, { headers: h });
          if (res.ok) {
            const data = await res.json();
            console.log(`  ✅ ${ep}:`, JSON.stringify(data).slice(0, 500));
            results[unit.name][ep] = data;
          }
        } catch { /* skip */ }
      }

      // Pegar 1 cliente do /clientes e do /d2/clientes
      for (const clientEp of ['/clientes?page=0&size=1', '/d2/clientes?page=0&size=1']) {
        try {
          await new Promise(r => setTimeout(r, 400));
          const res = await fetch(`${PACTO_API_BASE_URL}${clientEp}`, { headers: h });
          if (res.ok) {
            const data = await res.json();
            const c = data?.content?.[0];
            if (c) {
              console.log(`  📋 ${clientEp} Keys:`, Object.keys(c).join(', '));
              console.log(`  📋 ${clientEp} totalElements:`, data?.totalElements);
              const interesting: Record<string, any> = {};
              for (const [k, v] of Object.entries(c)) {
                if (typeof v === 'object' && v !== null) interesting[k] = v;
                const kl = k.toLowerCase();
                if (kl.includes('empresa') || kl.includes('unidade') || kl.includes('filial') || kl.includes('codigo') || kl.includes('id')) {
                  interesting[k] = v;
                }
              }
              console.log(`  🏢 ${clientEp} Campos empresa/id:`, JSON.stringify(interesting));
              results[unit.name][`_fields_${clientEp}`] = interesting;
            }
          }
        } catch { /* skip */ }
      }
    }

    console.log('\n📊 RESUMO:', JSON.stringify(results, null, 2));
    return results;
  };
}

// ============================================================
// CORE FETCHERS
// ============================================================

/**
 * Fetch clients page-by-page for a unit. Used for detailed contract data
 * (expiration dates, installment status). For simple counts use fetchClientsSummary.
 */
const fetchClientsByToken = async (unitName: string, token: string, empresaId?: string, empresaNome?: string): Promise<any[]> => {
  if (!token) {
    console.warn(`[PACTO] Skipping "${unitName}" — no token configured.`);
    return [];
  }
  let all: any[] = [];
  let page = 0, totalPages = 1;
  const headers: Record<string, string> = {
    accept: 'application/json',
    Authorization: `Bearer ${token}`,
  };
  if (empresaId) {
    headers['empresaId'] = empresaId;
  }
  try {
    while (page < totalPages) {
      await getRateLimiter(token).waitForNextRequest();
      const res = await fetchWithRetry(
        `${PACTO_API_BASE_URL}/clientes?page=${page}&size=2000`,
        { headers }
      );
      if (!res.ok) {
        console.error(`[PACTO] ${unitName} page ${page}: HTTP ${res.status}`);
        break;
      }
      const data = await res.json();
      const content = data?.content;
      if (content?.length) {
        all = all.concat(content.map((c: any) => {
          // empresa field from API is the company NAME string (e.g. "ACAD. MALIBU UNID. ARARAS - SP")
          const rawEmpresaNome = typeof c.empresa === 'string' ? c.empresa : '';
          return {
            ...c,
            empresa: unitName,          // Override with our unit name
            _rawEmpresa: rawEmpresaNome, // Preserve original name for filtering
          };
        }));
        if (data.totalPages != null) {
          totalPages = data.totalPages;
        } else if (data.totalElements != null) {
          totalPages = Math.ceil(data.totalElements / 2000);
        } else {
          totalPages = page + 2;
        }
        page++;
      } else break;
    }

    // FILTRAR por empresaNome: para tokens compartilhados (Mogi Guaçu/Araras),
    // cada registro tem o nome da empresa no campo `empresa` da API.
    // Filtramos para manter apenas registros que pertencem a ESTA unidade.
    if (empresaNome) {
      const before = all.length;
      // Normaliza acentos para evitar mismatch: "MOGI GUACU" vs "MOGI GUAÇU"
      const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
      const searchTerm = normalize(empresaNome);
      all = all.filter(c => {
        const raw = normalize(c._rawEmpresa ?? '');
        return raw.includes(searchTerm);
      });
      console.log(`[PACTO] ${unitName}: filtrado por empresaNome "${empresaNome}": ${before} → ${all.length} registros`);
    }

    console.log(`[PACTO] ${unitName}: ${all.length} clientes carregados.`);
    return all;
  } catch (e) {
    console.error(`[PACTO] Erro em ${unitName}:`, e);
    return [];
  }
};

// ============================================================
// PUBLIC API CLIENT
// ============================================================
export const pactoApiClient = {

  /** Returns all units that have a valid token. */
  getActiveUnits: (): UnitConfig[] => UNIT_CONFIGS.filter(u => u.token.length > 10),

  /**
   * Tries to discover the real Pacto empresa ID for a token.
   * Attempts common "get current company" endpoint patterns.
   * Does NOT use the rate limiter — these are lightweight probes.
   */
  fetchEmpresaIdForToken: async (token: string): Promise<string | null> => {
    if (!token || token.length < 10) return null;
    const headers = { accept: 'application/json', Authorization: `Bearer ${token}` };
    for (const ep of ['/empresa', '/v1/empresa', '/empresas/atual', '/usuario']) {
      try {
        const res = await fetch(`${PACTO_API_BASE_URL}${ep}`, { headers });
        if (res.ok) {
          const data = await res.json();
          const id = data?.codigo ?? data?.id ?? data?.empresaId
                  ?? data?.empresa?.codigo ?? data?.content?.[0]?.codigo ?? null;
          if (id != null && !Number.isNaN(Number(id))) {
            console.log(`[BI Discovery] ${ep} → empresaId = ${id}`);
            return String(id);
          }
        }
      } catch { /* try next endpoint */ }
    }
    return null;
  },

  /** Fetch all clients for all configured (valid-token) units. */
  fetchAllClients: async (): Promise<any[]> => {
    const activeUnits = UNIT_CONFIGS.filter(u => u.token.length > 10);
    const results: any[][] = [];
    for (const unit of activeUnits) {
      results.push(await fetchClientsByToken(unit.name, unit.token, unit.empresaId, unit.empresaNome));
    }
    return results.flat();
  },

  /** Fetch all clients for a single named unit. */
  fetchUnitClients: (unitName: string): Promise<any[]> => {
    const cfg = getUnitConfig(unitName);
    if (!cfg) return Promise.resolve([]);
    return fetchClientsByToken(cfg.name, cfg.token, cfg.empresaId, cfg.empresaNome);
  },

  // Individual unit fetchers (preserved for backward-compat usage)
  fetchAmericanasClients:          () => fetchClientsByToken('Americanas',          PACTO_TOKENS.AMERICANAS),
  fetchMogiGuacuClients:           () => fetchClientsByToken('Mogi Guaçu',          PACTO_TOKENS.MOGI_GUACU),
  fetchAracatubaClients:           () => fetchClientsByToken('Araçatuba',           PACTO_TOKENS.ARACATUBA),
  fetchPiracicabaClients:          () => fetchClientsByToken('Piracicaba',          PACTO_TOKENS.PIRACICABA),
  fetchPresidentePrudenteClients:  () => fetchClientsByToken('Presidente Prudente', PACTO_TOKENS.PRESIDENTE_PRUDENTE),
  fetchSaoJoaoClients:             () => fetchClientsByToken('São João',            PACTO_TOKENS.SAO_JOAO),
  fetchArarasClients:              () => fetchClientsByToken('Araras',              PACTO_TOKENS.ARARAS),
  fetchMogiMirimClients:           () => fetchClientsByToken('Mogi Mirim',          PACTO_TOKENS.MOGI_MIRIM),
  fetchPauliniaClients:            () => fetchClientsByToken('Paulínia',            PACTO_TOKENS.PAULINIA),
  fetchMalibu24HorasClients:       () => fetchClientsByToken('Malibu 24 Horas',     PACTO_TOKENS.MALIBU_24HORAS),
  fetchSorocabaClients:            () => fetchClientsByToken('Sorocaba',            PACTO_TOKENS.SOROCABA),

  /**
   * GET /movimentacao-contrato?indicador=CONTRATOS_ATIVOS_MES_ATUAL
   * FONTE AUTORITATIVA — mesmo endpoint que o Pacto usa na tela "Movimentação de Contratos".
   * Parâmetro obrigatório: indicador (string)
   * Parâmetro opcional: filters (JSON URL-encoded com empresa, inicio, fim)
   * Retorna paginação com totalElements = contagem exata de contratos ativos.
   */
  fetchMovimentacaoContrato: async (unitName: string): Promise<{
    ativos: number;
    vencidos: number;
    agregadores: number;
    matriculados: number;
    cancelados: number;
    desistencia: number;
    trancados: number;
  } | null> => {
    const cfg = getUnitConfig(unitName);
    if (!cfg || !cfg.token) return null;

    const headers: Record<string, string> = {
      accept: 'application/json',
      Authorization: `Bearer ${cfg.token}`,
    };

    // Montar filtros para /movimentacao-contrato
    // Doc diz que `inicio`/`fim` são opcionais (obrigatório apenas para ALGUNS indicadores).
    // Indicadores _MES_ATUAL e _HOJE já definem o período implicitamente.
    // Tentativa 1: só empresa (sem datas) — o indicador já define o período.
    // Tentativa 2 (fallback): sem filtro nenhum.
    const empresaId = Number(cfg.empresaId) || 1;

    const buildFiltersUrl = (indicador: string, withEmpresa: boolean): string => {
      if (withEmpresa) {
        const filters = { empresa: empresaId };
        const encoded = encodeURIComponent(JSON.stringify(filters));
        return `${PACTO_API_BASE_URL}/movimentacao-contrato?indicador=${indicador}&filters=${encoded}&page=0&size=1`;
      }
      return `${PACTO_API_BASE_URL}/movimentacao-contrato?indicador=${indicador}&page=0&size=1`;
    };

    const fetchIndicador = async (indicador: string): Promise<number> => {
      // Tentar COM filtro empresa primeiro, depois SEM filtro
      for (const withEmpresa of [true, false]) {
        await getRateLimiter(cfg.token).waitForNextRequest();
        const url = buildFiltersUrl(indicador, withEmpresa);
        try {
          const res = await fetchWithRetry(url, { headers });
          if (!res.ok) {
            let errorBody = '';
            try { errorBody = await res.text(); } catch { /* ignore */ }
            console.warn(`[MovContrato] ❌ ${unitName} ${indicador} (empresa=${withEmpresa ? empresaId : 'none'}): HTTP ${res.status} | ${errorBody.slice(0, 200)}`);
            continue;
          }
          const data = await res.json();
          const total = data?.totalElements ?? 0;
          console.log(`[MovContrato] ${total > 0 ? '✅' : '⚠️'} ${unitName} ${indicador} (empresa=${withEmpresa ? empresaId : 'none'}): ${total}`, total === 0 && data ? `| response keys: ${Object.keys(data).join(',')}` : '');
          if (total > 0) return Number(total);
          // Se retornou 0 com empresa, tenta sem
          if (withEmpresa && total === 0) continue;
          return Number(total);
        } catch (e) {
          console.error(`[MovContrato] ❌ ${unitName} ${indicador}: ERRO:`, e);
        }
      }
      return 0;
    };

    try {
      // Buscar os indicadores principais em paralelo (são requests independentes)
      const [ativos, vencidos, cancelados, matriculados, trancados, agregadores] = await Promise.all([
        fetchIndicador('CONTRATOS_ATIVOS_MES_ATUAL'),
        fetchIndicador('CONTRATOS_VENCIDOS_MES_ANTERIOR'),
        fetchIndicador('CANCELADOS_ATE_HOJE'),
        fetchIndicador('MATRICULADOS_ATE_HOJE'),
        fetchIndicador('TRANCADOS_ATE_HOJE'),
        fetchIndicador('AGREGADORES_VINCULADOS_ATE_HOJE'),
      ]);

      if (ativos > 0) {
        console.log(`[MovContrato] ✅✅✅ ${unitName}: ${ativos} CONTRATOS ATIVOS (fonte autoritativa)`);
        return { ativos, vencidos, agregadores, matriculados, cancelados, desistencia: 0, trancados };
      }

      console.warn(`[MovContrato] ⚠️ ${unitName}: ativos=0 — possível erro de permissão`);
      return null;
    } catch (e) {
      console.error(`[MovContrato] ❌ ${unitName}: ERRO geral:`, e);
      return null;
    }
  },

  /**
   * Fetch authoritative client counts per situation.
   * The Pacto /clientes endpoint does NOT support ?situacao= filter (returns HTTP 500).
   * Returning null disables Pass 2 overrides — counts come from Pass 1 pagination
   * with global deduplication and correct empresa attribution.
   */
  fetchClientsSummary: async (_token: string, _empresaId?: string): Promise<any[] | null> => null,

  /**
   * Fetches BI summary for current and previous month in a single range call.
   * startMonth = previous month, endMonth = current month.
   * Returns { current, previous } parsed from the content array by `mes` field.
   * empresaIdOverride: real Pacto empresa codigo extracted from client records.
   */
  fetchBiSummary: async (
    unitName: string,
    startMonth: string,
    endMonth: string,
    empresaIdOverride?: string | null,
  ): Promise<{ current: any | null; previous: any | null }> => {
    const cfg = getUnitConfig(unitName);
    if (!cfg || !cfg.token) return { current: null, previous: null };
    await getRateLimiter(cfg?.token ?? 'global').waitForNextRequest();

    const url = `${PACTO_API_BASE_URL}/v1/bi/resumo?mesInicial=${startMonth}&mesFinal=${endMonth}`;
    const baseHeaders: Record<string, string> = {
      accept: 'application/json',
      Authorization: `Bearer ${cfg.token}`,
    };

    // BI field names known to come from Pacto /v1/bi/resumo
    const BI_FIELDS = ['totalReceita','receitaTotal','receita','contasReceberPorDataQuitacao',
                       'recebiveis','competencia','total','mes','totalFaturamento','totalCompetencia'];

    const parseResponse = (data: any): { current: any | null; previous: any | null } => {
      const raw: any[] = Array.isArray(data?.content) ? data.content : data ? [data] : [];
      const content = raw.filter((c: any) =>
        c && typeof c === 'object' && Object.keys(c).some(k => BI_FIELDS.includes(k))
      );
      const findMonth = (m: string) =>
        content.find((c: any) => c?.mes === m || c?.mes?.startsWith(m)) ?? null;
      const current  = findMonth(endMonth)   ?? content[0]                               ?? null;
      const previous = findMonth(startMonth) ?? (content.length > 1 ? content[1] : null) ?? null;
      return { current, previous };
    };

    const extractRevenue = (rec: any): number =>
      rec?.totalReceita ?? rec?.totalFaturamento ?? rec?.totalCompetencia ??
      rec?.recebiveis ?? rec?.receitaTotal ?? rec?.receita ??
      rec?.contasReceberPorDataQuitacao ?? rec?.competencia ?? rec?.total ?? 0;

    const tryFetch = async (headers: Record<string, string>) => {
      try {
        const res = await fetchWithRetry(url, { headers });
        if (!res.ok) return null;
        const data = await res.json();
        return parseResponse(data);
      } catch { return null; }
    };

    // Ir direto com empresaId configurado (já descoberto: quase todos = 1, Mogi Guaçu = 2)
    const resolvedEmpresaId = empresaIdOverride ?? cfg.empresaId;
    const a1 = await tryFetch({ ...baseHeaders, empresaId: resolvedEmpresaId });
    if (a1?.current && extractRevenue(a1.current) > 0) {
      console.log(`[BI] ✅ ${unitName} (empresaId=${resolvedEmpresaId}): R$${extractRevenue(a1.current)}`);
      return a1;
    }

    // Fallback: tentar sem header empresaId (alguns tokens funcionam assim)
    await getRateLimiter(cfg?.token ?? 'global').waitForNextRequest();
    const a2 = await tryFetch(baseHeaders);
    if (a2?.current && extractRevenue(a2.current) > 0) {
      console.log(`[BI] ✅ ${unitName} (token-only fallback): R$${extractRevenue(a2.current)}`);
      return a2;
    }

    console.warn(`[BI] ❌ ${unitName}: faturamento não encontrado`);
    return a1 ?? a2 ?? { current: null, previous: null };
  },

  /**
   * Fetch new contracts created in a given month (new enrollments).
   * Uses /clientes filtered by situacao=ATIVO — complement with date filtering client-side.
   */
  fetchNewEnrollments: async (unitName: string, yearMonth: string): Promise<number> => {
    const cfg = getUnitConfig(unitName);
    if (!cfg || !cfg.token) return 0;
    await getRateLimiter(cfg?.token ?? 'global').waitForNextRequest();
    try {
      const res = await fetchWithRetry(
        `${PACTO_API_BASE_URL}/clientes?situacao=ATIVO&dataInicio=${yearMonth}-01&page=0&size=1`,
        { headers: { accept: 'application/json', Authorization: `Bearer ${cfg.token}` } }
      );
      if (!res.ok) return 0;
      const data = await res.json();
      return data?.totalElements ?? 0;
    } catch { return 0; }
  },

  /**
   * Fetch total cancellations count for a unit.
   */
  fetchCancellations: async (unitName: string): Promise<number> => {
    const cfg = getUnitConfig(unitName);
    if (!cfg || !cfg.token) return 0;
    await getRateLimiter(cfg?.token ?? 'global').waitForNextRequest();
    try {
      const res = await fetchWithRetry(
        `${PACTO_API_BASE_URL}/clientes?situacao=CANCELADO&page=0&size=1`,
        { headers: { accept: 'application/json', Authorization: `Bearer ${cfg.token}` } }
      );
      if (!res.ok) return 0;
      const data = await res.json();
      return data?.totalElements ?? 0;
    } catch { return 0; }
  },

  // ── Gympass ──────────────────────────────────────────────────────────────────

  /** Read Gympass access counts from the PACTO official API (/v2-gym-pass). */
  fetchAllGympassData: async (): Promise<{ [key: string]: number }> => {
    const results: { [key: string]: number } = {};
    UNIT_CONFIGS.forEach(u => { results[u.name] = 0; });

    const now = new Date();
    const year  = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    // Date range: first to last day of current month
    const startDate = `${year}-${month}-01`;
    const lastDay   = new Date(year, now.getMonth() + 1, 0).getDate();
    const endDate   = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

    const activeUnits = UNIT_CONFIGS.filter(u => u.token.length > 10);

    for (const unit of activeUnits) {
      try {
        await getRateLimiter(unit.token).waitForNextRequest();
        const res = await fetchWithRetry(
          `${PACTO_API_BASE_URL}/v2-gym-pass`,
          {
            method: 'POST',
            headers: {
              'accept': 'application/json',
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${unit.token}`,
            },
            body: JSON.stringify({
              dataInicio: startDate,
              dataFim: endDate,
            }),
          }
        );

        if (!res.ok) {
          console.warn(`[Gympass] ${unit.name}: HTTP ${res.status}`);
          continue;
        }

        const data = await res.json();
        console.log(`[Gympass RAW] ${unit.name}:`, JSON.stringify(data).slice(0, 300)); // DEBUG LOG

        // Handle all known response shapes from PACTO /v2-gym-pass
        let count = 0;
        if (typeof data === 'number') {
          count = data;
        } else if (Array.isArray(data)) {
          // Each item may represent an access event or a student row
          count = data.length;
        } else if (data?.totalElements !== undefined) {
          count = Number(data.totalElements);
        } else if (data?.total !== undefined) {
          count = Number(data.total);
        } else if (data?.quantidade !== undefined) {
          count = Number(data.quantidade);
        } else if (data?.count !== undefined) {
          count = Number(data.count);
        } else if (data?.content && Array.isArray(data.content)) {
          count = data.totalElements ?? data.content.length;
        } else if (data?.acessos !== undefined) {
          count = Number(data.acessos);
        } else if (data?.alunos !== undefined) {
          count = Array.isArray(data.alunos) ? data.alunos.length : Number(data.alunos);
        }

        results[unit.name] = count;
        console.log(`[Gympass] ${unit.name}: ${count} acessos`);
      } catch (e) {
        console.error(`[Gympass] Erro em ${unit.name}:`, e);
      }
    }

    return results;
  },

  // ── Legacy / Misc ─────────────────────────────────────────────────────────────
  fetchPendingClients: () => Promise.resolve([]),
  fetchGympassAnalytics: async (_unit: string, _start: number, _end: number): Promise<number> => 0,

  getModalidades: async (token: string) => {
    const res = await fetch(`${PACTO_API_BASE_URL}/modalidades`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.json();
  },

  buscarCliente: async (token: string, search: string) => {
    const res = await fetch(`${PACTO_API_BASE_URL}/clientes?nome=${search}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.json();
  },

  getParcelas: async (token: string, userId: number, situacao: string) => {
    const res = await fetch(`${PACTO_API_BASE_URL}/clientes/${userId}/parcelas?situacao=${situacao}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    return res.json();
  },

  createCliente: async (token: string, body: any) => {
    const res = await fetch(`${PACTO_API_BASE_URL}/clientes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    });
    return res.json();
  },
};