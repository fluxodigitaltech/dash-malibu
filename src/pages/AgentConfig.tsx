import React, { useState, useEffect, useCallback } from 'react';
import { sheetyApiClient, AgentData } from '@/integrations/sheety/client';
import AgentForm, { AgentFormValues } from '@/components/agent/AgentForm';
import { 
  Loader2, 
  Bot, 
  Save, 
  AlertTriangle, 
  Clock, 
  RefreshCw, 
  MessageCircleQuestion,
  Sparkles,
  Activity,
  Command,
  Settings2,
  Cpu
} from 'lucide-react';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

const AgentConfig: React.FC = () => {
  const [agentData, setAgentData] = useState<AgentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveProgress, setSaveProgress] = useState(0);

  const chatUrl = "https://n8n-webhook.2ahbdb.easypanel.host/webhook/adaad4dd-8c0e-4a05-88ab-70341e7ae176/chat";

  const fetchAgentData = useCallback(async () => {
    setLoading(true);
    setSaveProgress(30);
    try {
      const data = await sheetyApiClient.getAgent();
      setAgentData(data);
      setSaveProgress(100);
      setHasChanges(false);
    } catch (error: any) {
      showError(error.message);
    } finally {
      setLoading(false);
      setTimeout(() => setSaveProgress(0), 1000);
    }
  }, []);

  useEffect(() => { fetchAgentData(); }, [fetchAgentData]);

  const handleFormSubmit = async (values: AgentFormValues) => {
    if (!agentData?.id) return;
    setIsSaving(true); setSaveProgress(20);
    const tid = showLoading('Sincronizando Neural...');
    try {
      const updated = await sheetyApiClient.updateAgent(agentData.id, values);
      setAgentData(updated); setHasChanges(false); setSaveProgress(100); showSuccess('Cérebro IA Atualizado!');
    } catch (error: any) { showError(error.message); }
    finally { dismissToast(tid); setIsSaving(false); setTimeout(() => setSaveProgress(0), 1000); }
  };

  const handleQuickSave = () => {
    const form = document.querySelector('form') as HTMLFormElement;
    if (form) form.dispatchEvent(new Event('submit', { cancelable: true }));
  };

  if (loading) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <div className="relative">
            <Cpu className="h-12 w-12 text-primary animate-pulse" />
            <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-ping" />
        </div>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40">Carregando Parâmetros Neurais...</p>
    </div>
  );

  return (
    <div className="space-y-10 p-10 max-w-[1600px] mx-auto animate-in fade-in duration-700">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-primary/20 text-primary shadow-[0_0_15px_rgba(242,140,29,0.3)]">
              <Bot className="h-6 w-6" />
            </div>
            <h1 className="text-4xl font-black tracking-tighter text-white">Agente <span className="text-primary">IA</span></h1>
          </div>
          <div className="flex items-center gap-3">
             <p className="text-muted-foreground/50 font-medium uppercase tracking-[0.2em] text-[10px]">Configuração Central do Cérebro Artificial.</p>
             <Badge variant="outline" className="h-5 px-2 bg-green-500/10 text-green-400 border-green-500/20 text-[8px] font-black uppercase tracking-widest">
                <Activity className="h-2 w-2 mr-1 animate-pulse" /> Sistêmico Ativo
             </Badge>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Button 
            onClick={fetchAgentData}
            variant="ghost" 
            className="h-12 px-6 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold border border-white/5 hover:border-white/10 transition-all flex items-center gap-3"
          >
            <RefreshCw className={cn("h-4 w-4", loading ? 'animate-spin text-primary' : '')} /> 
            Recarregar Dados
          </Button>
        </div>
      </div>

      <main className="space-y-8">
        {saveProgress > 0 && (
            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-primary transition-all duration-500" style={{ width: `${saveProgress}%` }} />
            </div>
        )}
        
        <Tabs defaultValue="config" className="w-full">
          <TabsList className="h-16 bg-white/5 p-2 rounded-[2rem] border border-white/5 gap-2">
            <TabsTrigger value="config" className="h-12 px-10 rounded-[1.5rem] data-[state=active]:bg-primary data-[state=active]:text-white font-black uppercase tracking-widest text-[10px] transition-all">
                <Settings2 className="mr-3 h-4 w-4" /> Configurações
            </TabsTrigger>
            <TabsTrigger value="test" className="h-12 px-10 rounded-[1.5rem] data-[state=active]:bg-primary data-[state=active]:text-white font-black uppercase tracking-widest text-[10px] transition-all">
                <MessageCircleQuestion className="mr-3 h-4 w-4" /> Painel de Testes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="mt-10 outline-none animate-in slide-in-from-bottom-5 duration-500">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3">
                <Command className="text-primary h-6 w-6" />
                Matriz de Comportamento
              </h2>
              {hasChanges && (
                <Badge className="bg-primary/20 text-primary border-primary/20 px-4 py-1.5 rounded-full font-black text-[10px] uppercase tracking-widest animate-pulse">
                    <AlertTriangle className="h-3 w-3 mr-2" /> Alterações não sincronizadas
                </Badge>
              )}
            </div>
            
            {agentData && (
                <div className="glass-card glow-border rounded-[2.5rem] p-8 lg:p-12">
                    <AgentForm 
                        initialData={agentData} 
                        onSubmit={handleFormSubmit} 
                        onCancel={fetchAgentData} 
                        loading={isSaving} 
                        onFormChange={setHasChanges} 
                    />
                </div>
            )}
          </TabsContent>

          <TabsContent value="test" className="mt-10 outline-none animate-in slide-in-from-bottom-5 duration-500">
            <div className="glass-card glow-border rounded-[2.5rem] p-4 lg:p-6 h-[750px] relative overflow-hidden">
                <div className="absolute top-6 left-6 z-20 flex items-center gap-3 bg-[#11111a]/80 backdrop-blur-xl border border-white/5 px-4 py-2 rounded-2xl">
                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    <span className="text-[10px] font-black text-white/50 uppercase tracking-widest leading-none">Simulador de Diálogo IA</span>
                </div>
                <iframe 
                    src={chatUrl} 
                    title="Chat Test Studio" 
                    className="w-full h-full border-none rounded-[2rem] bg-white relative z-10" 
                />
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <Button 
        onClick={handleQuickSave} 
        disabled={!hasChanges || isSaving} 
        className={cn(
            "fixed bottom-12 right-12 h-20 w-20 rounded-full bg-primary shadow-[0_0_30px_rgba(242,140,29,0.4)] hover:shadow-[0_0_50px_rgba(242,140,29,0.6)] transition-all duration-500 z-50 flex items-center justify-center border-4 border-[#0e0d15]",
            !hasChanges && "opacity-0 translate-y-20 pointer-events-none"
        )}
      >
        {isSaving ? <Loader2 className="animate-spin h-8 w-8 text-white" /> : <Save className="h-8 w-8 text-white" />}
      </Button>
    </div>
  );
};

export default AgentConfig;