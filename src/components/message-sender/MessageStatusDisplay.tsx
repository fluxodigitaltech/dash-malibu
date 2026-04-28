// src/components/message-sender/MessageStatusDisplay.tsx
import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';

export interface MessageStatus {
  id: string;
  number: string;
  name?: string;
  status: 'pending' | 'sent' | 'failed' | 'sending';
  errorMessage?: string;
  originalRowIndex: number; // Adicionado para rastrear a linha original do CSV
  originalData: any; // Para manter os dados originais da linha
}

interface MessageStatusDisplayProps {
  messages: MessageStatus[];
}

const MessageStatusDisplay: React.FC<MessageStatusDisplayProps> = ({ messages }) => {
  const getStatusBadge = (status: MessageStatus['status']) => {
    switch (status) {
      case 'sent':
        return <Badge variant="default" className="bg-green-500 hover:bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" /> Enviado</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> Falhou</Badge>;
      case 'sending':
        return <Badge variant="secondary" className="bg-blue-500 hover:bg-blue-500 text-white"><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Enviando...</Badge>;
      case 'pending':
      default:
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" /> Pendente</Badge>;
    }
  };

  return (
    <div className="max-h-96 overflow-y-auto border rounded-lg shadow-sm">
      <Table>
        <TableHeader className="sticky top-0 bg-malibu-light-gray/20 z-10">
          <TableRow>
            <TableHead>Contato</TableHead>
            <TableHead>Linha CSV</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Detalhes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {messages.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-malibu-gray py-8">
                Nenhuma mensagem na fila.
              </TableCell>
            </TableRow>
          ) : (
            messages.map((msg) => (
              <TableRow key={msg.id}>
                <TableCell className="font-medium text-malibu-black">
                  <div>{msg.name || 'Sem nome'}</div>
                  <div className="text-xs text-malibu-gray">{msg.number}</div>
                </TableCell>
                <TableCell className="text-sm text-malibu-gray">{msg.originalRowIndex}</TableCell>
                <TableCell>{getStatusBadge(msg.status)}</TableCell>
                <TableCell className="text-sm text-malibu-gray">
                  {msg.errorMessage || (msg.status === 'sent' ? 'Mensagem enviada com sucesso.' : '')}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default MessageStatusDisplay;