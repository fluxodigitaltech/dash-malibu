import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { whatsappInstances, NcWhatsAppInstance } from '@/integrations/nocodb/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { 
    Trash2, 
    RefreshCw, 
    QrCode, 
    AlertCircle, 
    Phone, 
    Copy, 
    MessageSquare, 
    Plus, 
    ChevronRight,
    Smartphone,
    Link2,
    CheckCircle2,
    XCircle,
    Loader2
} from 'lucide-react';
import { StatusBadge } from '@/components/whatsapp/StatusBadge';
import { cn } from '@/lib/utils';
import { uazapiClient } from '@/integrations/uazapi/client';

type WhatsAppInstance = NcWhatsAppInstance & {
  id: string; // alias for instance_id — keep existing code working
};

export const WhatsAppIntegration = () => {
  const { user } = useAuth();
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [selectedInstance, setSelectedInstance] = useState<WhatsAppInstance | null>(null);
  const [instanceName, setInstanceName] = useState('');
  const [qrCodeData, setQrCodeData] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [phoneToConnect, setPhoneToConnect] = useState('');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadUserInstances = useCallback(async () => {
    if (!user) return;
    if (!user) return;
    const data = await whatsappInstances.listByUser(user.id);
    // Map instance_id → id for backward compat with rest of component
    const mapped = data.map(d => ({ ...d, id: d.instance_id })) as WhatsAppInstance[];
    setInstances(mapped);
    if (mapped.length > 0 && !selectedInstance && !isCreatingNew) {
      setSelectedInstance(mapped[0]);
    } else if (mapped.length === 0) {
      setIsCreatingNew(true);
    }
  }, [user, selectedInstance, isCreatingNew]);

  useEffect(() => {
    loadUserInstances();
  }, [loadUserInstances]);

  const handleCreateInstance = async () => {
    const cleanName = instanceName.trim().replace(/\s+/g, '_');
    if (!cleanName) {
      showError('Nome da instância é obrigatório.');
      return;
    }

    setLoading(true);
    const tid = showLoading('Iniciando Rede...');

    try {
      const res = await uazapiClient.initInstance(cleanName);
      await whatsappInstances.create({
        user_id: user?.id || '',
        instance_name: res.name,
        instance_url: 'https://fluxodigitaltech.uazapi.com',
        api_key: res.token,
        status: 'disconnected',
      });

      showSuccess(`Malibu Channel "${res.name}" criado.`);
      setInstanceName('');
      setIsCreatingNew(false);
      await loadUserInstances();
    } catch (e: any) {
      showError(e.message);
    } finally {
      dismissToast(tid);
      setLoading(false);
    }
  };

  const handleStartConnection = async (inst: WhatsAppInstance, usePhone: boolean) => {
    const tid = showLoading('Abrindo Canal Seguro...');
    setQrCodeData(null);
    setPairingCode(null);

    try {
      const res = await uazapiClient.connectInstance(
        inst.instance_name,
        inst.api_key,
        usePhone ? phoneToConnect : undefined
      );

      if (usePhone && res.pairingCode) {
        setPairingCode(res.pairingCode);
        showSuccess('Código gerado com sucesso.');
      } else {
        let base64 = res.instance?.qrcode || res.qrcode || res.base64 || res.qr;
        if (!base64) {
          for (let i = 0; i < 3; i++) {
            try {
              await new Promise(r => setTimeout(r, 2000));
              const fetchQr = await uazapiClient.getQR(inst.instance_name, inst.api_key);
              if (fetchQr) {
                base64 = fetchQr;
                break;
              }
            } catch (err) {}
          }
        }

        if (base64) {
          const formattedQr = base64.startsWith('data:') ? base64 : `data:image/png;base64,${base64}`;
          setQrCodeData(formattedQr);
          showSuccess('QR Code Sincronizado.');
        } else {
          showError('Falha no Sync Visual. Tente novamente.');
        }
      }

      await whatsappInstances.updateStatus(inst.instance_id, 'connecting');
      await loadUserInstances();

    } catch (e: any) {
      showError(e.message);
    } finally {
      dismissToast(tid);
    }
  };

  const handleDeleteInstance = async (id: string, name: string) => {
    if (!confirm(`Remover canal "${name}" permanentemente?`)) return;
    const tid = showLoading('Destruindo Instância...');
    try {
      await uazapiClient.deleteInstance(name);
      await whatsappInstances.delete(id);
      showSuccess('Instância offline.');
      if (selectedInstance?.id === id) setSelectedInstance(null);
      await loadUserInstances();
    } catch (e: any) {
      showError(e.message);
    } finally {
      dismissToast(tid);
    }
  };

  const checkStatus = async (inst: WhatsAppInstance, silent = false) => {
    const tid = !silent ? showLoading('Consultando Status...') : null;
    try {
      const status = await uazapiClient.getInstanceStatus(inst.instance_name, inst.api_key);
      if (status !== inst.status) {
        await whatsappInstances.updateStatus(inst.instance_id, status);
        if (!silent) showSuccess(`Canal: ${status}`);
        await loadUserInstances();
      } else if (!silent) {
        showSuccess(`Canal: ${status}`);
      }
    } catch (e: any) {
      if (!silent) showError('Erro na sincronagem do status.');
    } finally {
      if (tid) dismissToast(tid);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (selectedInstance?.status === 'connecting') {
      interval = setInterval(() => {
        checkStatus(selectedInstance, true);
      }, 5000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [selectedInstance?.status, selectedInstance?.id]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showSuccess('Código Copiado!');
  };

  return (
    <div className="space-y-10 p-10 max-w-[1600px] mx-auto animate-in fade-in duration-700">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-green-500/20 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.3)] border border-green-500/20">
              <MessageSquare className="h-6 w-6" />
            </div>
            <h1 className="text-4xl font-black tracking-tighter text-white">WhatsApp <span className="text-primary">Direct</span></h1>
          </div>
          <p className="text-muted-foreground/50 font-medium uppercase tracking-[0.2em] text-[10px]">Omnichannel Malibu: Gestão de Instâncias e Webhook.</p>
        </div>

        <Button
            variant={isCreatingNew ? "ghost" : "default"}
            onClick={() => { setIsCreatingNew(!isCreatingNew); setSelectedInstance(null); }}
            className={cn(
                "h-14 px-8 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center gap-3",
                isCreatingNew 
                    ? "text-white/40 hover:text-white" 
                    : "bg-primary text-white premium-shadow hover:scale-105 active:scale-95"
            )}
        >
            {isCreatingNew ? <ChevronRight className="rotate-180 h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {isCreatingNew ? "Voltar aos Canais" : "Nova Instância"}
        </Button>
      </div>

      <div className="glass-card glow-border rounded-[2.5rem] overflow-hidden min-h-[700px] flex flex-col md:flex-row">
        {/* Sidebar */}
        <div className="w-full md:w-80 border-r border-white/5 bg-black/20 p-8 flex flex-col gap-6">
          <div className="space-y-1">
             <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 ml-2 mb-4">Seus Canais</h3>
             <div className="space-y-3">
                {instances.map(inst => (
                    <div
                    key={inst.id}
                    onClick={() => { setSelectedInstance(inst); setIsCreatingNew(false); setQrCodeData(null); setPairingCode(null); }}
                    className={cn(
                        "p-5 rounded-3xl cursor-pointer transition-all border group relative flex flex-col gap-2",
                        selectedInstance?.id === inst.id
                        ? "bg-primary/20 border-primary/20 premium-shadow outline outline-1 outline-primary/40"
                        : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10"
                    )}
                    >
                        <div className="flex items-center justify-between gap-2 overflow-hidden">
                            <span className={cn("text-xs font-black truncate uppercase tracking-widest", selectedInstance?.id === inst.id ? "text-primary" : "text-white/70")}>
                                {inst.instance_name}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                                {inst.status === 'connected' ? <CheckCircle2 className="h-3 w-3 text-green-400" /> : <XCircle className="h-3 w-3 text-white/10" />}
                            </div>
                        </div>
                        <div className="flex items-center justify-between">
                             <StatusBadge status={inst.status} />
                             <Button
                                variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 rounded-lg"
                                onClick={(e) => { e.stopPropagation(); handleDeleteInstance(inst.id, inst.instance_name); }}
                            >
                                <Trash2 className="h-3 w-3 text-red-500" />
                            </Button>
                        </div>
                    </div>
                ))}
             </div>
          </div>
          
          <div className="mt-auto p-6 bg-white/5 rounded-3xl border border-white/5 text-[10px] space-y-3">
             <div className="flex items-center gap-2 text-white/50 font-black uppercase">
                <Smartphone className="h-3 w-3 text-primary" /> Multi-Aparelhos Pro
             </div>
             <p className="text-white/30 font-bold leading-relaxed">Conexões protegidas via TLS 1.3 com criptografia de ponta a ponta.</p>
          </div>
        </div>

        {/* Workspace Area */}
        <div className="flex-1 p-8 lg:p-16 flex flex-col bg-white/[0.01]">
          {isCreatingNew ? (
            <div className="max-w-md mx-auto w-full my-auto animate-in zoom-in-95 duration-500">
                <div className="text-center mb-10">
                    <div className="p-4 rounded-3xl bg-primary/10 text-primary inline-block mb-6 border border-primary/10">
                        <Link2 className="h-8 w-8" />
                    </div>
                    <h2 className="text-3xl font-black text-white tracking-tighter mb-2">Novo Canal de Dados</h2>
                    <p className="text-xs font-bold text-white/30 uppercase tracking-[0.2em]">Malibu WhatsApp Network v2.0</p>
                </div>

                <div className="bg-white/5 p-8 rounded-[2.5rem] border border-white/5 space-y-6">
                    <div className="space-y-3">
                      <Label className="text-[10px] font-black uppercase text-white/40 tracking-widest ml-4">Apelido da Instância</Label>
                      <Input
                        placeholder="Ex: Comercial_Sorocaba" 
                        value={instanceName}
                        onChange={e => setInstanceName(e.target.value)}
                        className="h-14 rounded-2xl bg-[#0e0d15]/50 border-white/5 px-8 font-black text-white focus:border-primary/50 transition-all uppercase placeholder:italic"
                      />
                    </div>
                    <Button 
                        className="w-full h-14 bg-primary text-white font-black rounded-2xl uppercase tracking-widest text-xs premium-shadow hover:scale-105 active:scale-95" 
                        onClick={handleCreateInstance} 
                        disabled={loading}
                    >
                      {loading ? <Loader2 className="animate-spin h-5 w-5" /> : "Ativar Novo Malibu Channel"}
                    </Button>
                </div>
            </div>
          ) : selectedInstance ? (
            <div className="h-full flex flex-col animate-in fade-in duration-500">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 border-b border-white/5 pb-10 mb-10">
                <div>
                    <h3 className="text-4xl font-black text-white tracking-tighter mb-1 uppercase">{selectedInstance.instance_name}</h3>
                    <div className="flex items-center gap-4">
                        <StatusBadge status={selectedInstance.status} />
                        <span className="text-white/20 text-[10px] font-bold uppercase tracking-widest">{selectedInstance.api_key.slice(0, 12)}...</span>
                    </div>
                </div>
                <Button 
                    variant="ghost" 
                    className="h-12 px-6 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 text-white font-black uppercase tracking-widest text-[10px] flex items-center gap-2" 
                    onClick={() => checkStatus(selectedInstance)}
                >
                  <RefreshCw className="h-3 w-3" /> Resincronizar Canal
                </Button>
              </div>

              <div className="grid lg:grid-cols-2 gap-12 flex-1">
                {/* Métodos de Conexão */}
                <div className="space-y-8 my-auto">
                  <div className="bg-white/5 p-8 rounded-[2rem] border border-white/5 space-y-4 hover:bg-white/[0.08] transition-all group">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-xl bg-primary/20 text-primary">
                            <Smartphone className="h-5 w-5" />
                        </div>
                        <Label className="text-sm font-black text-white uppercase tracking-widest cursor-pointer">Pareamento via Código</Label>
                    </div>
                    <Input
                      placeholder="Ex: 5511999999999"
                      value={phoneToConnect}
                      onChange={e => setPhoneToConnect(e.target.value)}
                      className="h-14 rounded-2xl bg-black/40 border-white/5 px-8 font-black text-white tracking-widest"
                    />
                    <Button
                      className="w-full h-14 bg-white text-black hover:bg-slate-200 font-black rounded-2xl text-[10px] uppercase tracking-widest transition-transform active:scale-95"
                      onClick={() => handleStartConnection(selectedInstance, true)}
                    >
                      Gerar Código de 8 Dígitos
                    </Button>
                    <p className="text-[9px] text-white/20 font-bold uppercase tracking-widest text-center mt-2 group-hover:text-white/40 transition-colors">Formato Internacional Exigido (DDI + DDD + Num)</p>
                  </div>

                  <div className="bg-white/5 p-8 rounded-[2rem] border border-white/5 space-y-6 hover:bg-white/[0.08] transition-all">
                    <div className="flex items-center gap-3">
                         <div className="p-2 rounded-xl bg-primary/20 text-primary">
                            <QrCode className="h-5 w-5" />
                        </div>
                        <Label className="text-sm font-black text-white uppercase tracking-widest">Sincronização Visual</Label>
                    </div>
                    <Button
                      variant="ghost" 
                      className="w-full h-14 bg-white/5 border border-white/5 hover:bg-primary hover:text-white text-white/70 font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all"
                      onClick={() => handleStartConnection(selectedInstance, false)}
                    >
                       Abrir Gateway de QR Code
                    </Button>
                  </div>
                </div>

                {/* Display Area (QR/Code) */}
                <div className="flex items-center justify-center p-12 bg-black/40 border-2 border-dashed border-white/5 rounded-[3rem] min-h-[450px] relative overflow-hidden my-auto group">
                  <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  {selectedInstance.status === 'connected' ? (
                    <div className="text-center space-y-4 animate-in zoom-in duration-500 z-10">
                      <div className="h-20 w-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto border border-green-500/20 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
                         <CheckCircle2 className="h-10 w-10 text-green-400" />
                      </div>
                      <p className="font-black text-2xl text-white tracking-widest uppercase">Canal Sintonizado</p>
                      <p className="text-[10px] text-green-400/50 font-black uppercase tracking-[0.2em]">Tráfego de mensagens liberado</p>
                    </div>
                  ) : pairingCode ? (
                    <div className="text-center space-y-8 animate-in zoom-in duration-300 z-10 w-full px-4">
                      <h4 className="font-black text-white/30 uppercase text-[10px] tracking-[0.3em] mb-4">Código de Autenticação</h4>
                      <div
                        className="bg-white/90 text-black text-5xl font-mono font-black p-10 rounded-[2rem] cursor-copy hover:bg-white transition-all transform hover:scale-105 shadow-2xl flex items-center justify-center gap-6"
                        onClick={() => copyToClipboard(pairingCode)}
                      >
                        {pairingCode}
                        <Copy className="h-8 w-8 text-black/20" />
                      </div>
                      <div className="text-[9px] text-white/30 uppercase font-black tracking-widest grid grid-cols-2 gap-4 text-left">
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5">1. Aparelhos Conectados</div>
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5">2. Conectar Aparelho</div>
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5">3. Usar número de telefone</div>
                        <div className="p-4 bg-white/5 rounded-2xl border border-white/5">4. Digitar Código</div>
                      </div>
                    </div>
                  ) : qrCodeData ? (
                    <div className="text-center space-y-6 animate-in zoom-in duration-500 z-10">
                      <div className="bg-white p-8 rounded-[2.5rem] inline-block shadow-2xl shadow-primary/20">
                        <img src={qrCodeData} alt="Malibu QR Network" className="w-64 h-64" />
                      </div>
                      <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em] animate-pulse">Aguardando Escaneamento...</p>
                    </div>
                  ) : (
                    <div className="text-center text-white/10 space-y-4 z-10">
                      <Smartphone className="h-16 w-16 mx-auto opacity-20" />
                      <p className="text-[10px] font-black uppercase tracking-[0.3em]">Neural Link Offline</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-white/10 space-y-4 my-auto">
               <Smartphone className="h-20 w-20" />
               <p className="font-black uppercase tracking-[0.4em] text-xs">Selecione uma Estação de Trabalho</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};