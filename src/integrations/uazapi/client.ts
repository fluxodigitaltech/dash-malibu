// src/integrations/uazapi/client.ts

const API_BASE_URL = '/api/uazapi';
const ADMIN_TOKEN = 'ZmzuasZIDxIrV6anLYs6GUKyBwQAjcpXLWPrhWdvRbmb4R2pnV';

export interface UazapiInstanceResponse {
  name: string;
  token: string;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
}

export const uazapiClient = {
  // Criar Instância no servidor
  initInstance: async (name: string): Promise<UazapiInstanceResponse> => {
    try {
      const response = await fetch(`${API_BASE_URL}/instance/init`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'admintoken': ADMIN_TOKEN,
        },
        body: JSON.stringify({
          name,
          systemName: "MalibuDash",
          adminField01: "Malibu-System",
          fingerprintProfile: "chrome",
          browser: "chrome"
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Erro ${response.status}: Falha ao criar instância.`);
      }

      return response.json();
    } catch (error: any) {
      console.error('uazapi init error:', error);
      throw error;
    }
  },

  // Iniciar conexão (Gera QR ou Pairing Code)
  connectInstance: async (_instanceName: string, token: string, phone?: string) => {
    // A documentação indica que não precisa de ?name= na URL, pois o token já identifica a instância
    const response = await fetch(`${API_BASE_URL}/instance/connect`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'token': token,
      },
      // Se tiver phone, manda { phone: "..." }, senão {} (para gerar QR)
      body: phone ? JSON.stringify({ phone: phone.replace(/\D/g, '') }) : JSON.stringify({}),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Falha ao iniciar processo de conexão.');
    }

    return response.json();
  },

  // Obter QR Code (caso o connect não retorne a imagem diretamente)
  getQR: async (instanceName: string, token: string) => {
    // Tentativa com query param (padrão)
    const response = await fetch(`${API_BASE_URL}/instance/qr?name=${instanceName}`, {
      headers: {
        'Accept': 'application/json',
        'token': token
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Não foi possível gerar o QR Code.');
    }

    const data = await response.json();
    return data.base64 || (typeof data === 'string' ? data : null);
  },

  // Status da Instância
  getInstanceStatus: async (_instanceName: string, token: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/instance/status`, {
        headers: { 'token': token }
      });
      if (response.ok) {
        const data = await response.json();
        const rawStatus = data.instance?.status || data.instance?.state || data.status || 'disconnected';

        // Normalizar status
        if (rawStatus === 'open') return 'connected';
        if (rawStatus === 'close') return 'disconnected';
        return rawStatus;
      }
      return 'disconnected';
    } catch (e) {
      return 'disconnected';
    }
  },

  // Deletar/Desconectar Instância (logout)
  deleteInstance: async (_instanceName: string, token?: string) => {
    // 405 em DELETE sugere que o servidor não aceita. Vamos tentar Logout via POST.
    // Isso desconecta o WhatsApp. Para deletar de fato a instância, precisaria do DELETE.
    // Se o user quiser deletar, chamamos logout.
    if (!token) return true; // Se não tem token, assume deletado localmente
    
    // Tenta DELETE primeiro (ignora resposta pois pode falhar em alguns gateways)
    await fetch(`${API_BASE_URL}/instance/logout`, {
      method: 'DELETE', 
    });

    // Tentativa com POST logout
    const resLogout = await fetch(`${API_BASE_URL}/instance/logout`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'token': token
      }
    });
    return resLogout.ok;
  },

  // Enviar Mensagem de Texto
  sendText: async (token: string, number: string, text: string) => {
    const response = await fetch(`${API_BASE_URL}/send/text`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'token': token,
      },
      body: JSON.stringify({
        number: number.replace(/\D/g, ''),
        text: text
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Erro ao enviar mensagem.');
    }

    return response.json();
  }
};