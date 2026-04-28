import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import Papa from 'papaparse';
import { MessageStatus } from '@/components/message-sender/MessageStatusDisplay';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const exportToCsv = (data: any[], filename: string, columns: { header: string, key: string }[]) => {
  if (!data || data.length === 0) return;
  const header = columns.map(col => col.header).join(',');
  const rows = data.map(row =>
    columns.map(col => {
      const value = row[col.key];
      if (value === null || value === undefined) return '';
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    }).join(',')
  );
  const csvContent = [header, ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportMessageReportToCsv = (messages: MessageStatus[], filename: string) => {
  if (!messages || messages.length === 0) return;
  const allOriginalKeys = new Set<string>();
  messages.forEach(msg => {
    if (msg.originalData) Object.keys(msg.originalData).forEach(key => allOriginalKeys.add(key));
  });
  const originalColumns = Array.from(allOriginalKeys).sort();
  const reportColumns = [
    { header: 'Linha Original CSV', key: 'originalRowIndex' },
    { header: 'Número Enviado', key: 'number' },
    { header: 'Nome do Contato', key: 'name' },
    ...originalColumns.map(key => ({ header: key, key: `originalData.${key}` })),
    { header: 'Status do Envio', key: 'status' },
    { header: 'Mensagem de Erro', key: 'errorMessage' },
  ];
  const reportData = messages.map(msg => {
    const row: { [key: string]: any } = {
      originalRowIndex: msg.originalRowIndex,
      number: msg.number,
      name: msg.name,
      status: msg.status === 'sent' ? 'Enviado' : msg.status === 'failed' ? 'Falhou' : 'Pendente',
      errorMessage: msg.errorMessage || '',
    };
    originalColumns.forEach(key => { row[`originalData.${key}`] = msg.originalData?.[key] || ''; });
    return row;
  });
  const csv = Papa.unparse(reportData, { header: true, columns: reportColumns.map(col => col.key), quotes: true });
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};