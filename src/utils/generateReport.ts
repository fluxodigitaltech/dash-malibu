import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SyncData, ProcessedStats } from './pactoSync';
import { format } from 'date-fns';

// Colors
const ORANGE: [number, number, number] = [242, 140, 29];
const DARK: [number, number, number] = [31, 41, 55];
const GREEN: [number, number, number] = [5, 150, 105];
const RED: [number, number, number] = [220, 38, 38];
const PURPLE: [number, number, number] = [124, 58, 237];
const GRAY: [number, number, number] = [107, 114, 128];
const LIGHT_BG: [number, number, number] = [249, 250, 251];
const WHITE: [number, number, number] = [255, 255, 255];
const AMBER_BG: [number, number, number] = [254, 243, 199];
const GREEN_BG: [number, number, number] = [209, 250, 229];

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const fmtNum = (v: number) => v.toLocaleString('pt-BR');

export const generateSyncReport = (data: SyncData, syncErrors: string[]) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentW = pageW - margin * 2;
  let y = 20;

  const addPage = () => { doc.addPage(); y = 20; };

  const checkSpace = (needed: number) => {
    if (y + needed > 275) addPage();
  };

  // ─── Header ───
  doc.setFontSize(22);
  doc.setTextColor(...ORANGE);
  doc.setFont('helvetica', 'bold');
  doc.text('Dashboard BI - Rede Malibu', margin, y);
  y += 8;

  doc.setFontSize(9);
  doc.setTextColor(...GRAY);
  doc.setFont('helvetica', 'normal');
  const dateStr = format(new Date(), 'dd/MM/yyyy HH:mm');
  const monthStr = format(new Date(), 'MMMM/yyyy');
  doc.text(`Relatório de Sincronização  |  ${dateStr}  |  Mês referência: ${monthStr}`, margin, y);
  y += 4;

  // Orange line
  doc.setDrawColor(...ORANGE);
  doc.setLineWidth(0.8);
  doc.line(margin, y, pageW - margin, y);
  y += 12;

  // ─── 1. Resumo Geral ───
  doc.setFontSize(15);
  doc.setTextColor(...DARK);
  doc.setFont('helvetica', 'bold');
  doc.text('1. Resumo Geral', margin, y);
  y += 8;

  const cd = data.clientData;
  const units = cd.clientsByCompany;
  const unitNames = Object.keys(units);
  const totalClientes = Object.values(units).reduce((s, u) => s + u.total, 0);

  const summaryRows = [
    ['Unidades Sincronizadas', `${unitNames.length} de ${unitNames.length}`],
    ['Total de Clientes Carregados', fmtNum(totalClientes)],
    ['Alunos Ativos', fmtNum(cd.activeClients || 0)],
    ['Inadimplentes', fmtNum(cd.delinquentClients || 0)],
    ['Agregadores (Wellhub/Gympass)', fmtNum(cd.gympassClients || 0)],
    ['Faturamento Total', fmtBRL(cd.totalRealRevenue || 0)],
    ['Erros de Sync', syncErrors.length > 0 ? syncErrors.join(', ') : 'Nenhum'],
    ['Status Geral', syncErrors.length === 0 ? 'OPERACIONAL' : 'PARCIAL'],
  ];

  autoTable(doc, {
    startY: y,
    head: [['Métrica', 'Valor']],
    body: summaryRows,
    margin: { left: margin, right: margin },
    headStyles: { fillColor: ORANGE, textColor: WHITE, fontStyle: 'bold', fontSize: 10 },
    bodyStyles: { fontSize: 10, textColor: DARK },
    alternateRowStyles: { fillColor: LIGHT_BG },
    columnStyles: { 1: { halign: 'right' } },
    didParseCell: (data) => {
      // Highlight faturamento row
      if (data.section === 'body' && data.row.index === 5) {
        data.cell.styles.fillColor = AMBER_BG;
        data.cell.styles.fontStyle = 'bold';
      }
      // Status row
      if (data.section === 'body' && data.row.index === 7) {
        data.cell.styles.fillColor = GREEN_BG;
        data.cell.styles.fontStyle = 'bold';
        if (data.column.index === 1) {
          data.cell.styles.textColor = syncErrors.length === 0 ? GREEN : RED;
        }
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 12;

  // ─── 2. Faturamento por Unidade ───
  checkSpace(60);
  doc.setFontSize(15);
  doc.setTextColor(...DARK);
  doc.setFont('helvetica', 'bold');
  doc.text('2. Faturamento por Unidade', margin, y);
  y += 8;

  const revenueRows = unitNames
    .map(name => {
      const s = units[name];
      return {
        name,
        revenue: s.realRevenue,
        prev: s.prevRevenue,
        change: s.prevRevenue > 0 ? ((s.realRevenue - s.prevRevenue) / s.prevRevenue * 100) : null,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);

  const totalRevenue = revenueRows.reduce((s, r) => s + r.revenue, 0);
  const totalPrev = revenueRows.reduce((s, r) => s + r.prev, 0);

  autoTable(doc, {
    startY: y,
    head: [['Unidade', 'Faturamento', 'Mês Anterior', 'Variação', 'Status']],
    body: revenueRows.map(r => [
      r.name,
      fmtBRL(r.revenue),
      r.prev > 0 ? fmtBRL(r.prev) : '—',
      r.change != null ? `${r.change >= 0 ? '+' : ''}${r.change.toFixed(1)}%` : '—',
      r.revenue > 0 ? 'OK' : 'SEM DADOS',
    ]),
    foot: [[
      'TOTAL REDE',
      fmtBRL(totalRevenue),
      totalPrev > 0 ? fmtBRL(totalPrev) : '—',
      totalPrev > 0 ? `${((totalRevenue - totalPrev) / totalPrev * 100).toFixed(1)}%` : '—',
      '',
    ]],
    margin: { left: margin, right: margin },
    headStyles: { fillColor: DARK, textColor: WHITE, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: DARK },
    footStyles: { fillColor: AMBER_BG, textColor: DARK, fontStyle: 'bold', fontSize: 9 },
    alternateRowStyles: { fillColor: LIGHT_BG },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'center' },
      4: { halign: 'center' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 4) {
        const val = data.cell.raw as string;
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.textColor = val === 'OK' ? GREEN : RED;
      }
      if (data.section === 'body' && data.column.index === 3) {
        const val = data.cell.raw as string;
        if (val.startsWith('+')) data.cell.styles.textColor = GREEN;
        else if (val.startsWith('-')) data.cell.styles.textColor = RED;
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 12;

  // ─── 3. Clientes por Unidade ───
  checkSpace(60);
  doc.setFontSize(15);
  doc.setTextColor(...DARK);
  doc.setFont('helvetica', 'bold');
  doc.text('3. Clientes por Unidade', margin, y);
  y += 8;

  const clientRows = unitNames
    .map(name => {
      const s = units[name];
      const total = s.active + s.delinquent;
      const pct = total > 0 ? (s.delinquent / total * 100) : 0;
      return { name, ...s, pct };
    })
    .sort((a, b) => b.active - a.active);

  autoTable(doc, {
    startY: y,
    head: [['Unidade', 'Ativos', 'Gympass', 'Inadimpl.', '% Inadimpl.', 'Visitantes', 'Total']],
    body: clientRows.map(r => [
      r.name,
      fmtNum(r.active),
      fmtNum(r.gympass),
      fmtNum(r.delinquent),
      `${r.pct.toFixed(1)}%`,
      fmtNum(r.visitor),
      fmtNum(r.total),
    ]),
    foot: [[
      'TOTAL REDE',
      fmtNum(cd.activeClients || 0),
      fmtNum(cd.gympassClients || 0),
      fmtNum(cd.delinquentClients || 0),
      cd.activeClients + cd.delinquentClients > 0
        ? `${(cd.delinquentClients / (cd.activeClients + cd.delinquentClients) * 100).toFixed(1)}%`
        : '0%',
      fmtNum(cd.visitorClients || 0),
      fmtNum(totalClientes),
    ]],
    margin: { left: margin, right: margin },
    headStyles: { fillColor: DARK, textColor: WHITE, fontStyle: 'bold', fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: DARK },
    footStyles: { fillColor: AMBER_BG, textColor: DARK, fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: LIGHT_BG },
    columnStyles: {
      1: { halign: 'center' },
      2: { halign: 'center' },
      3: { halign: 'center' },
      4: { halign: 'center' },
      5: { halign: 'center' },
      6: { halign: 'center' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 4) {
        const pctVal = parseFloat(data.cell.raw as string);
        if (pctVal >= 20) {
          data.cell.styles.textColor = RED;
          data.cell.styles.fontStyle = 'bold';
        } else if (pctVal >= 10) {
          data.cell.styles.textColor = [217, 119, 6]; // amber
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 12;

  // ─── 4. Inadimplência por Faixa ───
  checkSpace(60);
  doc.setFontSize(15);
  doc.setTextColor(...DARK);
  doc.setFont('helvetica', 'bold');
  doc.text('4. Inadimplência por Faixa', margin, y);
  y += 8;

  const delinqRows = unitNames
    .filter(name => units[name].delinquent > 0)
    .map(name => {
      const s = units[name];
      return [
        name,
        fmtNum(s.delinquent1Month),
        fmtNum(s.delinquent2Months),
        fmtNum(s.delinquent3Months),
        fmtNum(s.delinquent4PlusMonths),
        fmtNum(s.delinquent),
      ];
    });

  if (delinqRows.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Unidade', '1 Mês', '2 Meses', '3 Meses', '4+ Meses', 'Total']],
      body: delinqRows,
      foot: [[
        'TOTAL',
        fmtNum(cd.delinquent1Month || 0),
        fmtNum(cd.delinquent2Months || 0),
        fmtNum(cd.delinquent3Months || 0),
        fmtNum(cd.delinquent4PlusMonths || 0),
        fmtNum(cd.delinquentClients || 0),
      ]],
      margin: { left: margin, right: margin },
      headStyles: { fillColor: RED, textColor: WHITE, fontStyle: 'bold', fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: DARK },
      footStyles: { fillColor: [254, 242, 242], textColor: RED, fontStyle: 'bold', fontSize: 9 },
      alternateRowStyles: { fillColor: LIGHT_BG },
      columnStyles: {
        1: { halign: 'center' },
        2: { halign: 'center' },
        3: { halign: 'center' },
        4: { halign: 'center' },
        5: { halign: 'center' },
      },
    });
    y = (doc as any).lastAutoTable.finalY + 12;
  } else {
    doc.setFontSize(10);
    doc.setTextColor(...GREEN);
    doc.text('Nenhuma unidade com inadimplência registrada.', margin, y);
    y += 10;
  }

  // ─── 5. Erros de Sync ───
  if (syncErrors.length > 0) {
    checkSpace(30);
    doc.setFontSize(15);
    doc.setTextColor(...DARK);
    doc.setFont('helvetica', 'bold');
    doc.text('5. Erros de Sincronização', margin, y);
    y += 8;

    doc.setFontSize(10);
    doc.setTextColor(...RED);
    doc.setFont('helvetica', 'normal');
    for (const err of syncErrors) {
      doc.text(`• ${err}: falha ao carregar dados`, margin + 4, y);
      y += 6;
    }
    y += 6;
  }

  // ─── Footer ───
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(...GRAY);
    doc.setFont('helvetica', 'normal');
    const footerText = `Gerado em ${dateStr} | Dashboard BI Rede Malibu | Página ${i} de ${pageCount}`;
    doc.text(footerText, pageW / 2, 290, { align: 'center' });

    // Thin line above footer
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.3);
    doc.line(margin, 287, pageW - margin, 287);
  }

  // Save
  doc.save(`Relatorio_Malibu_${format(new Date(), 'yyyy-MM-dd_HHmm')}.pdf`);
};
