// src/integrations/sheety/client.ts

const SHEETY_API_BASE_URL = '/api/sheety/d2c4ecf84f2a11c796effcbd102687ad/teste';

export interface AgentData {
  agentName: string;
  personaPresentation: string;
  personaTimezone: string;
  personaTone: string;
  personaForbidden: string;
  templatesGreetingMorning: string;
  templatesGreetingAfternoon: string;
  templatesGreetingNight: string;
  templatesAskNameMale: string;
  templatesAskNameFemale: string;
  templatesAskNameNeutral: string;
  ruleRequireNameBeforeContinue: boolean;
  ruleAlwaysCallTool: boolean;
  ruleAlwaysCallMemory: boolean;
  ruleNeverUseQuotes: boolean;
  endpointCrm: string;
  endpointWaFranquia: string;
  metaRules: string;
  contentBlocks: string;
  bordaoMale: string;
  bordaoFemale: string;
  bordaoRegionalSouth: string;
  bordaoInterior: string;
  bordaoCentralNeutral: string;
  id: number;
}

export const sheetyApiClient = {
  getAgent: async (): Promise<AgentData | null> => {
    try {
      const response = await fetch(`${SHEETY_API_BASE_URL}/nome`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Falha ao buscar dados do agente: ${response.status}`);
      }

      const data = await response.json();
      if (data && data.nome && Array.isArray(data.nome) && data.nome.length > 0) {
        return data.nome[0];
      }
      return null;
    } catch (error: any) {
      console.error('Erro ao buscar agente do Sheety:', error);
      throw error;
    }
  },

  updateAgent: async (agentId: number, updatedData: Partial<AgentData>): Promise<AgentData> => {
    try {
      const response = await fetch(`${SHEETY_API_BASE_URL}/nome/${agentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nome: updatedData }), 
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Falha ao atualizar dados do agente: ${response.status}`);
      }

      const data = await response.json();
      return data.nome;
    } catch (error: any) {
      console.error('Erro ao atualizar agente no Sheety:', error);
      throw error;
    }
  },
};