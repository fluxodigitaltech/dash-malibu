// src/pages/MessageSender.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { whatsappInstances, sentMessages } from '@/integrations/nocodb/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download } from 'lucide-react';
import MessageSenderForm, { Contact } from '@/components/message-sender/MessageSenderForm';
import MessageStatusDisplay, { MessageStatus } from '@/components/message-sender/MessageStatusDisplay';
import { showSuccess, showError, showLoading, dismissToast } from '@/utils/toast';
import { uazapiClient } from '@/integrations/uazapi/client';
import { exportMessageReportToCsv } from '@/utils/export';
import { Button } from '@/components/ui/button';

interface WhatsAppInstance {
  id: string;
  user_id: string;
  instance_name: string;
  status: string;
  api_key: string; // Token da uazapi
}

const MessageSender: React.FC = () => {
  const { user } = useAuth();
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [messageQueue, setMessageQueue] = useState<MessageStatus[]>([]);
  const [reportReady, setReportReady] = useState(false);

  const loadUserInstances = useCallback(async () => {
    if (!user) return;
    const data = await whatsappInstances.listByUser(user.id);
    setInstances(data.map(d => ({ ...d, id: d.instance_id })));
  }, [user]);

  useEffect(() => { loadUserInstances(); }, [loadUserInstances]);

  const handleSendMessage = async (
    instanceName: string, 
    messageVariations: string[], 
    contacts: Contact[], 
    minDelay: number, 
    maxDelay: number,
    longDelayInterval: number, 
    longDelayDuration: number 
  ) => {
    if (!user) return;
    const instance = instances.find(i => i.instance_name === instanceName);
    if (!instance) { showError('Instância não encontrada'); return; }

    setIsSending(true); setReportReady(false);
    const initialQueue: MessageStatus[] = contacts.map((c, i) => ({ id: `${c.number}-${i}-${Date.now()}`, number: c.number, name: c.name, status: 'pending', originalRowIndex: c.originalRowIndex, originalData: c.originalData }));
    setMessageQueue(initialQueue);
    const tid = showLoading(`Iniciando envio via uazapi...`);
    const updatedQueue: MessageStatus[] = [];

    for (let i = 0; i < contacts.length; i++) {
      const contact = contacts[i]; 
      const messageId = initialQueue[i].id;
      setMessageQueue(prev => prev.map(msg => msg.id === messageId ? { ...msg, status: 'sending' } : msg));
      
      const msg = messageVariations[i % messageVariations.length].replace(/{nome}/gi, contact.name || '');
      let status: 'sent' | 'failed' = 'failed'; 
      let error: string | undefined;

      try {
        await uazapiClient.sendText(instance.api_key, contact.number, msg);
        status = 'sent';
        setMessageQueue(prev => prev.map(m => m.id === messageId ? { ...m, status: 'sent' } : m));
      } catch (e: any) {
        error = e.message;
        setMessageQueue(prev => prev.map(m => m.id === messageId ? { ...m, status: 'failed', errorMessage: e.message } : m));
        showError(`Falha em ${contact.name}: ${e.message}`);
      } finally {
        await sentMessages.insert({
          user_id: user.id,
          instance_name: instanceName,
          recipient_phone: contact.number,
          message_text: msg,
          status,
        }).catch(() => {}); // Non-critical — don't block send flow
        updatedQueue.push({ ...contact, id: messageId, status, errorMessage: error });
      }

      if (i < contacts.length - 1) {
        const d = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;
        await new Promise(r => setTimeout(r, d));
        
        if ((i + 1) % longDelayInterval === 0) {
          const pauseTid = showLoading('Pausa estratégica...');
          await new Promise(r => setTimeout(r, longDelayDuration));
          dismissToast(pauseTid);
        }
      }
    }
    dismissToast(tid); showSuccess('Envio concluído!'); setIsSending(false); setReportReady(true); setMessageQueue(updatedQueue);
  };

  return (
    <div className="p-4 bg-slate-900 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-8">
        <Card className="bg-slate-800 border-slate-700 text-white"><CardHeader><CardTitle>Disparador uazapi</CardTitle></CardHeader></Card>
        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="bg-slate-800 border-slate-700"><CardContent className="pt-6"><MessageSenderForm instances={instances} onSendMessage={handleSendMessage} loading={isSending} /></CardContent></Card>
          <Card className="bg-slate-800 border-slate-700"><CardHeader><CardTitle className="text-white">Status da Fila</CardTitle></CardHeader><CardContent>
            <MessageStatusDisplay messages={messageQueue} />
            {reportReady && <Button onClick={() => exportMessageReportToCsv(messageQueue, 'relatorio_envio.csv')} className="w-full mt-4"><Download className="mr-2" /> Baixar Relatório</Button>}
          </CardContent></Card>
        </div>
      </div>
    </div>
  );
};

export default MessageSender;