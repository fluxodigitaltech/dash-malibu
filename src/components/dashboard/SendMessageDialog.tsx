import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Send } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { uazapiClient } from '@/integrations/uazapi/client';
import { whatsappInstances } from '@/integrations/nocodb/client';
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
  status: string;
  api_key: string; 
}

interface SendMessageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  client: ClientData | null;
}

const SendMessageDialog: React.FC<SendMessageDialogProps> = ({ isOpen, onClose, client }) => {
  const { user } = useAuth();
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState('');
  const [messageVariations, setMessageVariations] = useState(['Olá {nome}, tudo bem?']);
  const [isSending, setIsSending] = useState(false);

  const loadUserInstances = useCallback(async () => {
    if (!user) return;
    const all = await whatsappInstances.listByUser(user.id);
    const data = all.filter(i => i.status === 'connected').map(d => ({ ...d, id: d.instance_id }));
    setInstances(data);
    if (data.length > 0) setSelectedInstanceId(data[0].id);
  }, [user]);

  useEffect(() => {
    if (isOpen) {
      loadUserInstances();
      setMessageVariations(['Olá {nome}, tudo bem?']);
    }
  }, [isOpen, loadUserInstances]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client?.telefone || !selectedInstanceId) return;

    const instance = instances.find(i => i.id === selectedInstanceId);
    if (!instance) return;

    setIsSending(true);
    const tid = showLoading(`Enviando para ${client.nome}...`);

    try {
      const msg = messageVariations[0].replace(/{nome}/gi, client.nome);
      await uazapiClient.sendText(instance.api_key, client.telefone, msg);
      
      showSuccess('Mensagem enviada via uazapi!');
      onClose();
    } catch (error: any) {
      showError(error.message);
    } finally {
      setIsSending(false);
      dismissToast(tid);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-white rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-malibu-orange">Enviar WhatsApp</DialogTitle>
          <DialogDescription>Para: {client?.nome} ({client?.telefone})</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSendMessage} className="space-y-4 mt-4">
          <div className="space-y-2">
            <Label>Canal de Envio (Instância)</Label>
            <Select onValueChange={setSelectedInstanceId} value={selectedInstanceId}>
              <SelectTrigger className="bg-white"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent className="bg-white">
                {instances.map(inst => (
                  <SelectItem key={inst.id} value={inst.id}>{inst.instance_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Mensagem</Label>
            <Textarea 
              value={messageVariations[0]} 
              onChange={e => setMessageVariations([e.target.value])}
              rows={4}
              className="bg-white"
            />
          </div>
          <Button type="submit" className="w-full bg-malibu-orange hover:bg-malibu-gold" disabled={isSending || !selectedInstanceId}>
            {isSending ? <Loader2 className="animate-spin mr-2" /> : <Send className="mr-2" />}
            Enviar Agora
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SendMessageDialog;