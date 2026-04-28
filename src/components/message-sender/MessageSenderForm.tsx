// src/components/message-sender/MessageSenderForm.tsx
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Send, PlusCircle, XCircle } from 'lucide-react';
import { parseCsvFile } from '@/utils/csv';
import { showError } from '@/utils/toast';

export interface Contact {
  number: string;
  name?: string;
  originalRowIndex: number;
  originalData: any;
}

interface MessageSenderFormProps {
  instances: { id: string; instance_name: string; status: string }[];
  onSendMessage: (
    instanceName: string, 
    messageVariations: string[], 
    contacts: Contact[], 
    minDelay: number, 
    maxDelay: number,
    longDelayInterval: number,
    longDelayDuration: number
  ) => void;
  loading: boolean;
}

const MessageSenderForm: React.FC<MessageSenderFormProps> = ({ instances, onSendMessage, loading }) => {
  const [selectedInstanceName, setSelectedInstanceName] = useState('');
  const [messageVariations, setMessageVariations] = useState(['']);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [minDelay, setMinDelay] = useState(5000);
  const [maxDelay, setMaxDelay] = useState(10000);
  const [isParsingCsv, setIsParsingCsv] = useState(false);
  const [longDelayInterval] = useState(10);
  const [longDelayDuration] = useState(30000);
  const [rawData, setRawData] = useState<any[]>([]);
  const [filterOptions, setFilterOptions] = useState<string[]>([]);
  const [filterColumnKey, setFilterColumnKey] = useState<string>('');
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);

  const connectedInstances = instances.filter(inst => inst.status === 'connected');

  useEffect(() => {
    if (connectedInstances.length > 0 && !selectedInstanceName) {
      setSelectedInstanceName(connectedInstances[0].instance_name);
    } else if (connectedInstances.length === 0) {
      setSelectedInstanceName('');
    }
  }, [instances, connectedInstances, selectedInstanceName]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setCsvFile(file || null);
    setRawData([]);
    setFilterOptions([]);
    setFilterColumnKey('');
    setSelectedFilter('all');
    setFilteredContacts([]);

    if (file) {
      setIsParsingCsv(true);
      try {
        const data = await parseCsvFile(file);
        if (data.length === 0 || !data[0]) {
          showError('A planilha está vazia.');
          return;
        }
        setRawData(data);
      } catch (error: any) {
        showError(`Erro ao ler CSV: ${error.message}`);
      } finally {
        setIsParsingCsv(false);
      }
    }
  };

  useEffect(() => {
    if (rawData.length === 0) {
      setFilteredContacts([]);
      return;
    }

    const keys = Object.keys(rawData[0]);
    const findKey = (keywords: string[]) => {
        for (const keyword of keywords) {
            const exactMatch = keys.find(key => key.trim().toLowerCase() === keyword.toLowerCase());
            if (exactMatch) return exactMatch;
        }
        for (const keyword of keywords) {
            const partialMatch = keys.find(key => key.trim().toLowerCase().includes(keyword.toLowerCase()));
            if (partialMatch) return partialMatch;
        }
        return undefined;
    };
    
    const numberKey = findKey(['whatsapp', 'número', 'telefone', 'phone']);
    const nameKey = findKey(['nome', 'name']);
    const foundFilterKey = findKey(['Column 1', 'lote', 'turma']);

    if (foundFilterKey && filterOptions.length === 0) {
      const options = [...new Set(rawData.map(row => String(row[foundFilterKey] || '').trim()).filter(Boolean))];
      setFilterOptions(options.sort());
      setFilterColumnKey(foundFilterKey);
    }

    if (!numberKey) {
      showError('Coluna de número não encontrada.');
      setFilteredContacts([]);
      return;
    }

    const dataToProcess =
      filterColumnKey && selectedFilter !== 'all'
        ? rawData.filter(row => String(row[filterColumnKey] || '').trim() === selectedFilter)
        : rawData;

    const uniqueNumbers = new Set<string>();
    const contacts: Contact[] = [];

    dataToProcess.forEach((row) => {
        const rawNumber = row[numberKey];
        if (!rawNumber) return;

        let cleaned = String(rawNumber).replace(/\D/g, '');
        if (cleaned.startsWith('55') && cleaned.length === 13) cleaned = cleaned.substring(2);
        if (cleaned.length === 10) cleaned = `${cleaned.substring(0, 2)}9${cleaned.substring(2)}`;
        if (cleaned.length === 11) cleaned = `55${cleaned}`;
        
        if (cleaned.length !== 13) return;

        if (!uniqueNumbers.has(cleaned)) {
          uniqueNumbers.add(cleaned);
          contacts.push({
            number: cleaned,
            name: nameKey ? String(row[nameKey]).trim() : undefined,
            originalRowIndex: rawData.indexOf(row) + 2,
            originalData: row,
          });
        }
      });

    setFilteredContacts(contacts);
  }, [rawData, selectedFilter, filterColumnKey, filterOptions.length]);

  const handleMessageChange = (index: number, value: string) => {
    const newVariations = [...messageVariations];
    newVariations[index] = value;
    setMessageVariations(newVariations);
  };

  const addMessageVariation = () => setMessageVariations([...messageVariations, '']);
  const removeMessageVariation = (index: number) => setMessageVariations(messageVariations.filter((_, i) => i !== index));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInstanceName || messageVariations.some(msg => !msg.trim()) || filteredContacts.length === 0) return;
    onSendMessage(selectedInstanceName, messageVariations, filteredContacts, minDelay, maxDelay, longDelayInterval, longDelayDuration);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label htmlFor="instance-select">Instância</Label>
        <Select onValueChange={setSelectedInstanceName} value={selectedInstanceName} disabled={loading || connectedInstances.length === 0}>
          <SelectTrigger id="instance-select"><SelectValue placeholder="Selecione uma instância" /></SelectTrigger>
          <SelectContent>{connectedInstances.map((instance) => (<SelectItem key={instance.id} value={instance.instance_name}>{instance.instance_name}</SelectItem>))}</SelectContent>
        </Select>
      </div>
      <div><Label>Planilha (CSV)</Label><Input type="file" accept=".csv" onChange={handleFileChange} disabled={loading || isParsingCsv} /></div>
      {filterOptions.length > 0 && (
        <div><Label>Filtrar por Lote</Label><Select onValueChange={setSelectedFilter} value={selectedFilter} disabled={loading}>
          <SelectTrigger><SelectValue placeholder="Filtrar..." /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos ({rawData.length})</SelectItem>{filterOptions.map(o => (<SelectItem key={o} value={o}>{o}</SelectItem>))}</SelectContent>
        </Select></div>
      )}
      {csvFile && <p className="text-sm">{csvFile.name} | {filteredContacts.length} contatos</p>}
      <div className="space-y-2">
        <Label>Mensagens</Label>
        {messageVariations.map((msg, index) => (
          <div key={index} className="flex gap-2">
            <Textarea value={msg} onChange={(e) => handleMessageChange(index, e.target.value)} rows={3} className="flex-1" disabled={loading} />
            {messageVariations.length > 1 && <Button type="button" variant="ghost" size="icon" onClick={() => removeMessageVariation(index)} disabled={loading}><XCircle className="text-red-500" /></Button>}
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addMessageVariation} disabled={loading}><PlusCircle className="mr-2" /> Adicionar</Button>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Min Delay (ms)</Label><Input type="number" value={minDelay} onChange={(e) => setMinDelay(Math.max(1000, Number(e.target.value)))} disabled={loading} /></div>
        <div><Label>Max Delay (ms)</Label><Input type="number" value={maxDelay} onChange={(e) => setMaxDelay(Math.max(1000, Number(e.target.value)))} disabled={loading} /></div>
      </div>
      <Button type="submit" disabled={loading || !selectedInstanceName || filteredContacts.length === 0} className="w-full">
        {loading ? <Loader2 className="animate-spin" /> : <Send className="mr-2" />} Enviar
      </Button>
    </form>
  );
};

export default MessageSenderForm;