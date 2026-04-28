import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Send, PlusCircle, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { evolutionApiClient } from '@/integrations/evolution/client';
import { whatsappInstances, sentMessages, listRows, TABLES } from '@/integrations/nocodb/client';
import { useAuth } from '@/contexts/AuthContext';

interface ClientData {
  nome: string;
  telefone?: string;
  empresa: string;
}

interface WhatsAppInstance {
  id: string;
  user_id: string;
  instance_name: string;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
}

interface SendToAllDialogProps {
  isOpen: boolean;
  onClose: () => void;
  clients: ClientData[];
}

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const SendToAllDialog: React.FC<SendToAllDialogProps> = ({ isOpen, onClose, clients }) => {
  const { user } = useAuth();
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [selectedInstanceName, setSelectedInstanceName] = useState('');
  const [messageVariations, setMessageVariations] = useState(['']);
  const [minDelay, setMinDelay] = useState(5000);
  const [maxDelay, setMaxDelay] = useState(10000);
  const [longDelayInterval, setLongDelayInterval] = useState(10);
  const [longDelayDuration, setLongDelayDuration] = useState(30000);
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0 });
  const [scheduledImageUrl, setScheduledImageUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const clientsWithPhone = useMemo(() => {
    const uniqueNumbers = new Set<string>();
    const filtered: ClientData[] = [];
    clients.forEach(client => {
      if (client.telefone && client.telefone.trim() !== '') {
        let cleanedNumber = String(client.telefone).replace(/\D/g, '');
        if (cleanedNumber.startsWith('55') && cleanedNumber.length === 13) cleanedNumber = cleanedNumber.substring(2);
        if (cleanedNumber.length === 10) cleanedNumber = `${cleanedNumber.substring(0, 2)}9${cleanedNumber.substring(2)}`;
        if (cleanedNumber.length === 11) cleanedNumber = `55${cleanedNumber}`;

        if (cleanedNumber.length === 13 && !uniqueNumbers.has(cleanedNumber)) {
          uniqueNumbers.add(cleanedNumber);
          filtered.push({ ...client, telefone: cleanedNumber });
        }
      }
    });
    return filtered;
  }, [clients]);

  const loadUserInstances = useCallback(async () => {
    if (!user) return;

    const ncInstances = await whatsappInstances.listByUser(user.id);
    if (!ncInstances.length) return;

    const updatedInstancesPromises = ncInstances.map(async (instance) => {
      const mapped: WhatsAppInstance = {
        id: instance.instance_id,
        user_id: instance.user_id,
        instance_name: instance.instance_name,
        status: instance.status as WhatsAppInstance['status'],
      };
      try {
        const apiStatus = await evolutionApiClient.getConnectionState(instance.instance_name);
        if (apiStatus !== instance.status) {
          await whatsappInstances.updateStatus(instance.instance_id, apiStatus);
          return { ...mapped, status: apiStatus as WhatsAppInstance['status'] };
        }
      } catch {}
      return mapped;
    });

    const verifiedInstances = await Promise.all(updatedInstancesPromises);
    setInstances(verifiedInstances);

    if (!selectedInstanceName || !verifiedInstances.some(inst => inst.instance_name === selectedInstanceName && inst.status === 'connected')) {
      const firstConnected = verifiedInstances.find(inst => inst.status === 'connected');
      if (firstConnected) {
        setSelectedInstanceName(firstConnected.instance_name);
      } else {
        setSelectedInstanceName('');
      }
    }
  }, [user, selectedInstanceName]);

  useEffect(() => {
    if (isOpen) {
      loadUserInstances();
      setMessageVariations(['']);
      setMinDelay(5000);
      setMaxDelay(10000);
      setLongDelayInterval(10);
      setLongDelayDuration(30000);
      setScheduledImageUrl(null);
      setSendProgress({ current: 0, total: 0 });
    }
  }, [isOpen, loadUserInstances]);

  const handleMessageChange = (index: number, value: string) => {
    const newVariations = [...messageVariations];
    newVariations[index] = value;
    setMessageVariations(newVariations);
  };

  const addMessageVariation = () => setMessageVariations([...messageVariations, '']);
  const removeMessageVariation = (index: number) => setMessageVariations(messageVariations.filter((_, i) => i !== index));

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || event.target.files.length === 0) return;

    const file = event.target.files[0];
    if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
      showError('Configurações do Cloudinary ausentes. Verifique suas variáveis de ambiente.');
      return;
    }

    setIsUploadingImage(true);
    const toastId = showLoading('Fazendo upload da imagem...');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Falha ao fazer upload para o Cloudinary.');
      }

      const data = await response.json();
      setScheduledImageUrl(data.secure_url);
      showSuccess('Imagem enviada com sucesso!');
    } catch (error: any) {
      showError(error.message || 'Erro ao fazer upload da imagem.');
      setScheduledImageUrl(null);
    } finally {
      dismissToast(toastId);
      setIsUploadingImage(false);
      event.target.value = '';
    }
  };

  const handleSendToAll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      showError('Dados do usuário ausentes.');
      return;
    }
    if (!selectedInstanceName) {
      showError('Selecione uma instância conectada.');
      return;
    }
    if (messageVariations.some(msg => !msg.trim())) {
      showError('Todas as variações de mensagem devem ser preenchida.');
      return;
    }
    if (clientsWithPhone.length === 0) {
      showError('Nenhum cliente com telefone válido encontrado na lista para enviar mensagens.');
      return;
    }
    if (minDelay < 1000 || maxDelay < 1000 || minDelay > maxDelay) {
      showError('Intervalo de atraso inválido. Mínimo de 1000ms e não pode ser maior que o máximo.');
      return;
    }

    setIsSending(true);
    setSendProgress({ current: 0, total: clientsWithPhone.length });

    const sendingToastId = showLoading(`Iniciando envio para ${clientsWithPhone.length} clientes...`);

    try {
      for (let i = 0; i < clientsWithPhone.length; i++) {
        const client = clientsWithPhone[i];
        const variationIndex = i % messageVariations.length;
        const selectedVariation = messageVariations[variationIndex];
        const finalMessage = selectedVariation.replace(/{nome}/gi, client.nome || '');

        let messageStatus: 'sent' | 'failed' = 'failed';
        let errorMessage: string | undefined;
        const sentAt = new Date().toISOString();

        let isFirstMessage = true;
        try {
          const prevResult = await listRows(TABLES.sent_messages, {
            where: `(recipient_phone,eq,${client.telefone!})~and(user_id,eq,${user.id})`,
            limit: 1,
          });
          isFirstMessage = prevResult.pageInfo.totalRows === 0;

          const payload: any = {
            number: client.telefone,
            text: finalMessage,
            options: {
              delay: 0,
              presence: 'composing',
            }
          };

          if (scheduledImageUrl) {
            payload.imageUrl = scheduledImageUrl;
          }

          await evolutionApiClient.sendTextMessage(selectedInstanceName, payload);
          messageStatus = 'sent';
        } catch (error: any) {
          errorMessage = error.message;
          showError(`Falha ao enviar para ${client.nome}: ${error.message}`);
        } finally {
          await sentMessages.insert({
            user_id: user.id,
            instance_name: selectedInstanceName,
            recipient_phone: client.telefone || '',
            message_text: finalMessage,
            status: messageStatus,
          }).catch(() => {});

          setSendProgress({ current: i + 1, total: clientsWithPhone.length });
        }

        if (i < clientsWithPhone.length - 1) {
          const randomDelay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
          await delay(randomDelay);

          if ((i + 1) % longDelayInterval === 0) {
            const pauseToastId = showLoading(`Pausa estratégica de ${longDelayDuration / 1000} segundos...`);
            await delay(longDelayDuration);
            dismissToast(pauseToastId);
          }
        }
      }

      showSuccess(`Envio de mensagens concluído para ${clientsWithPhone.length} clientes!`);
      onClose();
    } catch (error: any) {
      showError(`Erro ao enviar mensagens em massa: ${error.message}`);
    } finally {
      dismissToast(sendingToastId);
      setIsSending(false);
      setSendProgress({ current: 0, total: 0 });
    }
  };

  const connectedInstances = instances.filter(inst => inst.status === 'connected');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] bg-white border border-gray-200 shadow-2xl rounded-xl p-0 max-h-[90vh] overflow-y-auto">
        <div className="bg-gradient-to-r from-malibu-orange to-malibu-gold p-6 rounded-t-xl">
          <DialogHeader className="text-white">
            <DialogTitle className="text-2xl font-bold">
              Enviar Mensagens para Todos os Clientes ({clientsWithPhone.length})
            </DialogTitle>
            <DialogDescription className="text-white/90">
              Configure as mensagens e os atrasos para enviar para todos os clientes selecionados.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-6">
          <form onSubmit={handleSendToAll} className="space-y-6">
            <div className="space-y-2">
              <Label className="text-gray-900 font-medium">Instância do WhatsApp</Label>
              <Select onValueChange={setSelectedInstanceName} value={selectedInstanceName} disabled={isSending || connectedInstances.length === 0}>
                <SelectTrigger className="bg-white border-gray-300 text-gray-900 focus:border-malibu-orange focus:ring-malibu-orange h-12">
                  <SelectValue placeholder="Selecione uma instância conectada" />
                </SelectTrigger>
                <SelectContent className="bg-white border-gray-200">
                  {connectedInstances.map((instance) => (
                    <SelectItem key={instance.id} value={instance.instance_name} className="text-gray-900">
                      {instance.instance_name} (Conectada)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label className="text-gray-900 font-medium">Variações da Mensagem</Label>
              <div className="space-y-3">
                {messageVariations.map((msg, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="flex-1">
                      <Textarea 
                        value={msg} 
                        onChange={(e) => handleMessageChange(index, e.target.value)} 
                        placeholder={`Variação ${index + 1}`} 
                        rows={3} 
                        className="bg-white border-gray-300 text-gray-900 focus:border-malibu-orange focus:ring-malibu-orange resize-none" 
                        disabled={isSending} 
                      />
                    </div>
                    {messageVariations.length > 1 && (
                      <Button 
                        type="button" 
                        variant="outline" 
                        size="icon" 
                        onClick={() => removeMessageVariation(index)} 
                        disabled={isSending}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 border-red-200"
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={addMessageVariation} 
                className="border-malibu-orange text-malibu-orange hover:bg-malibu-orange/10" 
                disabled={isSending}
              >
                <PlusCircle className="h-4 w-4 mr-2" /> Adicionar Variação
              </Button>
            </div>

            <div className="space-y-3">
              <Label htmlFor="image-upload" className="text-gray-900 font-medium">Upload de Imagem (Opcional)</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="flex-1 bg-white border-gray-300 text-gray-900"
                  disabled={isSending || isUploadingImage}
                />
                {isUploadingImage && <Loader2 className="h-5 w-5 animate-spin text-malibu-orange" />}
              </div>
              {scheduledImageUrl && (
                <div className="mt-3 flex items-center gap-3">
                  <img src={scheduledImageUrl} alt="Preview" className="w-20 h-20 object-cover rounded-md border border-gray-300" />
                  <Button variant="outline" size="sm" onClick={() => setScheduledImageUrl(null)} className="text-red-500">
                    Remover
                  </Button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label className="text-gray-900 font-medium">Intervalo de Atraso</Label>
                <div className="grid grid-cols-2 gap-3">
                  <Input type="number" value={minDelay} onChange={(e) => setMinDelay(Math.max(1000, Number(e.target.value)))} min="1000" disabled={isSending} />
                  <Input type="number" value={maxDelay} onChange={(e) => setMaxDelay(Math.max(1000, Number(e.target.value)))} min="1000" disabled={isSending} />
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-gray-900 font-medium">Pausa Longa Estratégica</Label>
                <div className="grid grid-cols-2 gap-3">
                  <Input type="number" value={longDelayInterval} onChange={(e) => setLongDelayInterval(Math.max(1, Number(e.target.value)))} min="1" disabled={isSending} />
                  <Input type="number" value={longDelayDuration} onChange={(e) => setLongDelayDuration(Math.max(1000, Number(e.target.value)))} min="1000" disabled={isSending} />
                </div>
              </div>
            </div>

            {isSending && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-blue-800">Enviando mensagens...</span>
                  <span className="text-sm font-medium text-blue-800">{sendProgress.current} de {sendProgress.total}</span>
                </div>
                <div className="mt-2 w-full bg-blue-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(sendProgress.current / sendProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}

            <Button 
              type="submit" 
              disabled={isSending || !selectedInstanceName || messageVariations.some(msg => !msg.trim()) || clientsWithPhone.length === 0} 
              className="w-full bg-gradient-to-r from-green-600 to-green-700 text-white font-bold shadow-lg hover:shadow-xl py-4 text-lg transition-all duration-300"
            >
              {isSending ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : <Send className="h-5 w-5 mr-2" />} Iniciar Envio para Todos
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SendToAllDialog;