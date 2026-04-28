import { createContext, useContext, useState, ReactNode, useCallback, useEffect, useRef } from 'react';
import { SyncData, fetchAllUnitsDataSequence } from '@/utils/pactoSync';
import { dashboardSync } from '@/integrations/nocodb/client';

interface PactoDataContextType {
  data: SyncData | null;
  setData: (data: SyncData) => void;
  lastUpdated: number | null;
  setLastUpdated: (timestamp: number) => void;
  isDataFresh: () => boolean;
  syncing: boolean;
  syncError: string | null;
  syncPactoData: (force?: boolean) => Promise<void>;
  syncProgress: number;
}

const CACHE_KEY      = 'dashboard_processed_v3';
const CACHE_TS_KEY   = 'dashboard_last_updated_v3';
const DATA_FRESHNESS_TTL = 6 * 60 * 60 * 1000; // 6 horas

/** Returns true if the timestamp is from a different calendar day than today */
const isNewDay = (ts: number): boolean => {
  const last  = new Date(ts);
  const today = new Date();
  return (
    last.getFullYear() !== today.getFullYear() ||
    last.getMonth()    !== today.getMonth()    ||
    last.getDate()     !== today.getDate()
  );
};

const PactoDataContext = createContext<PactoDataContextType | undefined>(undefined);

export const PactoDataProvider = ({ children }: { children: ReactNode }) => {
  const [data, setData] = useState<SyncData | null>(() => {
    try {
      const saved = localStorage.getItem(CACHE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Erro ao carregar cache do dashboard', e);
    }
    return null;
  });

  const [lastUpdated, setLastUpdated] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem(CACHE_TS_KEY);
      if (saved) return Number(saved);
    } catch (e) { }
    return null;
  });

  const [syncing, setSyncing]       = useState(false);
  const [syncError, setSyncError]   = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState(0);

  // Guard against multiple concurrent syncs (survives re-renders)
  const syncingRef = useRef(false);

  useEffect(() => {
    if (data) localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    if (lastUpdated) localStorage.setItem(CACHE_TS_KEY, String(lastUpdated));
  }, [lastUpdated]);

  const isDataFresh = useCallback(() => {
    if (!lastUpdated) return false;
    return Date.now() - lastUpdated <= DATA_FRESHNESS_TTL;
  }, [lastUpdated]);

  const syncPactoData = useCallback(async (force = false) => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    setSyncError(null);
    setSyncProgress(0);
    try {
      // 1. Tentar pegar do NocoDB primeiro (Sincronizado via Vercel Cron)
      if (!force) {
        console.log('[PactoSync] Buscando cache centralizado no NocoDB...');
        try {
          const cache = await dashboardSync.getLatest();

          if (cache) {
            const cacheAge = Date.now() - new Date(cache.last_updated).getTime();
            const parsed = JSON.parse(cache.data);
            const cbc = parsed?.clientData?.clientsByCompany;
            const isValidFormat = cbc != null;
            const hasDelinquencyData = isValidFormat && Object.values(cbc as Record<string, any>)
              .some((s: any) => (s.delinquent ?? 0) > 0 || (s.visitor ?? 0) > 0 || (s.expired ?? 0) > 0);
            if (cacheAge < DATA_FRESHNESS_TTL && isValidFormat && hasDelinquencyData) {
              console.log('[PactoSync] ✅ Cache centralizado recuperado via NocoDB.');
              setData(parsed);
              setLastUpdated(new Date(cache.last_updated).getTime());
              setSyncing(false);
              syncingRef.current = false;
              return;
            }
            if (!isValidFormat) {
              console.warn('[PactoSync] Cache NocoDB com formato inválido — rodando sync local.');
            } else if (!hasDelinquencyData) {
              console.warn('[PactoSync] Cache NocoDB sem dados de inadimplência — rodando sync local.');
            }
          }
        } catch (e) {
          console.warn('[PactoSync] Erro ao buscar cache NocoDB — rodando sync local:', e);
        }
      }

      // 2. Se forçado ou cache central estragado, rodar o sync no browser
      console.log('[PactoSync] Rodando sincronização local via browser...');
      const processed = await fetchAllUnitsDataSequence(force, (p) => setSyncProgress(p));
      setData(processed);
      setLastUpdated(Date.now());
      
      console.log(
        `[PactoSync] Sincronização concluída: ${processed.clientData.activeClients} ativos` +
        ` | ${processed.clientData.delinquentClients} inadimplentes` +
        ` em ${processed.companyOptions.length} unidades.`
      );
    } catch (e: any) {
      setSyncError(e.message || 'Erro desconhecido na sincronização');
    } finally {
      setSyncing(false);
      syncingRef.current = false;
      setSyncProgress(0);
    }
  }, []); // empty deps — uses ref to guard concurrency

  // Background sync on mount — tries NocoDB cache (populated by Vercel cron) first,
  // falls back to browser sync only if NocoDB data is also stale
  useEffect(() => {
    const ts = localStorage.getItem(CACHE_TS_KEY);
    if (!ts) { syncPactoData(false); return; }
    const age     = Date.now() - Number(ts);
    const stale   = age > DATA_FRESHNESS_TTL;
    const newDay  = isNewDay(Number(ts));
    if (stale || newDay) syncPactoData(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Midnight watcher — if tab is open, syncs automatically when the date changes
  useEffect(() => {
    const id = setInterval(() => {
      if (syncingRef.current) return;
      const ts = localStorage.getItem(CACHE_TS_KEY);
      if (ts && isNewDay(Number(ts))) {
        console.log('[PactoSync] 🌙 Novo dia detectado — sincronização automática iniciando...');
        syncPactoData(true);
      }
    }, 60_000); // checks every minute
    return () => clearInterval(id);
  }, [syncPactoData]);

  return (
    <PactoDataContext.Provider value={{
      data, setData, lastUpdated, setLastUpdated, isDataFresh,
      syncing, syncError, syncPactoData, syncProgress
    }}>
      {children}
    </PactoDataContext.Provider>
  );
};

export const usePactoData = () => {
  const context = useContext(PactoDataContext);
  if (context === undefined) {
    throw new Error('usePactoData must be used within a PactoDataProvider');
  }
  return context;
};
