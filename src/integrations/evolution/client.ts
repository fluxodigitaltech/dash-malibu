// src/integrations/evolution/client.ts
const API_BASE_URL = 'https://evolution.2ahbdb.easypanel.host';
const API_TOKEN = import.meta.env.VITE_EVOLUTION_API_TOKEN; // Usando variável de ambiente

interface SendTextMessagePayload {
  number: string;
  text: string;
  imageUrl?: string; // Adicionado para suportar envio de imagem
  options?: { // 'options' agora é um objeto opcional
    delay?: number;
    presence?: 'composing' | 'paused';
    linkPreview?: boolean;
    quoted?: any; // Simplified for now, can be expanded
    // 'mentions' é omitido se não for explicitamente adicionado
  };
}

// Sistema de rate limit para Evolution API
class RateLimiter {
  private requestTimestamps: number[] = []; // Stores timestamps of recent requests
  private readonly maxRequestsPerMinute: number;
  private readonly windowMs: number = 60 * 1000; // 1 minute window

  constructor(maxRequestsPerMinute: number) {
    if (maxRequestsPerMinute <= 0) {
      throw new Error("maxRequestsPerMinute must be positive");
    }
    this.maxRequestsPerMinute = maxRequestsPerMinute;
  }

  async waitForNextRequest(): Promise<void> {
    const now = Date.now();

    // Remove timestamps older than the window
    this.requestTimestamps = this.requestTimestamps.filter(
      (timestamp) => now - timestamp < this.windowMs
    );

    // If we've hit the limit within the window, wait
    if (this.requestTimestamps.length >= this.maxRequestsPerMinute) {
      const oldestRequestTime = this.requestTimestamps[0];
      const timeToWait = this.windowMs - (now - oldestRequestTime) + 100; // Add a small buffer
      
      if (timeToWait > 0) {
        // console.warn(`Evolution API Rate limit hit. Waiting for ${timeToWait}ms.`); // Removed console.warn
        await new Promise(resolve => setTimeout(resolve, timeToWait));
      }
      // After waiting, re-filter in case more time passed
      this.requestTimestamps = this.requestTimestamps.filter(
        (timestamp) => Date.now() - timestamp < this.windowMs
      );
    }
    
    // Add current request timestamp
    this.requestTimestamps.push(Date.now());
    this.requestTimestamps.sort((a, b) => a - b); // Keep sorted to easily find oldest
  }
}

const EVOLUTION_RPM = 20; // Conservative rate limit for Evolution API
const evolutionRateLimiter = new RateLimiter(EVOLUTION_RPM);

// Função de retry com atraso exponencial
async function retry<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  delayMs: number = 1000,
  factor: number = 2
): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries > 0 && (error.message.includes('Failed to fetch') || error.message.includes('timed out') || error.message.includes('500'))) {
      // console.warn(`Tentativa falhou. ${retries} restantes. Retentando em ${delayMs}ms. Erro: ${error.message}`); // Removed console.warn
      await new Promise(res => setTimeout(res, delayMs));
      return retry(fn, retries - 1, delayMs * factor, factor);
    }
    throw error; // Re-throw if no retries left or not a retryable error
  }
}

export const evolutionApiClient = {
  sendTextMessage: async (instanceName: string, payload: SendTextMessagePayload) => {
    if (!API_TOKEN) {
      throw new Error('EVOLUTION_API_TOKEN não configurado. Verifique seu arquivo .env.');
    }
    await evolutionRateLimiter.waitForNextRequest(); // Apply rate limit
    // Codifica o nome da instância para a URL
    const encodedInstanceName = encodeURIComponent(instanceName);

    return retry(async () => {
      const response = await fetch(`${API_BASE_URL}/message/sendText/${encodedInstanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': API_TOKEN,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Failed to send message via Evolution API for instance ${instanceName}`);
      }

      return response.json();
    });
  },

  getConnectionState: async (instanceName: string): Promise<'connected' | 'disconnected' | 'connecting' | 'error'> => {
    if (!API_TOKEN) {
      return 'error';
    }
    try {
      await evolutionRateLimiter.waitForNextRequest(); // Apply rate limit
      // Codifica o nome da instância para a URL
      const encodedInstanceName = encodeURIComponent(instanceName);
      
      return retry(async () => {
        const response = await fetch(`${API_BASE_URL}/instance/connectionState/${encodedInstanceName}`, {
          headers: { 'apikey': API_TOKEN }
        });
        
        if (response.ok) {
          const data = await response.json();
          const connectionState = data.instance?.state;
          if (connectionState === 'open') return 'connected';
          if (connectionState === 'close') return 'disconnected';
          return 'disconnected'; // Default for other states or if 'state' is missing
        }
        
        // Se a resposta for 404, a instância não existe mais na Evolution API. Tratar como desconectada.
        if (response.status === 404) {
          return 'disconnected';
        }
        
        // Se a resposta não for OK, lançar um erro para o retry tentar novamente
        throw new Error(`API connectionState respondeu com status: ${response.status}`);
      }, 3, 2000); // 3 retries, starting with 2 seconds delay

    } catch (error) {
      // console.error('Error in getConnectionState:', error); // Removed console.error
      return 'error'; // Network error or other exception
    }
  },

  getGroups: async (instanceName: string): Promise<any[]> => {
    if (!API_TOKEN) {
      throw new Error('EVOLUTION_API_TOKEN não configurado. Verifique seu arquivo .env.');
    }
    await evolutionRateLimiter.waitForNextRequest(); // Apply rate limit
    const encodedInstanceName = encodeURIComponent(instanceName);
    
    return retry(async () => {
      const response = await fetch(`${API_BASE_URL}/group/fetchAllGroups/${encodedInstanceName}?getParticipants=true`, {
        headers: { 'apikey': API_TOKEN }
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao carregar grupos da API: ${errorText}`);
      }
      return response.json();
    });
  }
};