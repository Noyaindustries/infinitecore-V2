import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface InvoicePdfSettings {
  companyName: string;
  companyAddressLines: string[];
  companyEmail: string;
  companyPhone: string;
  legalFooter: string;
  currencyLabel: string;
  showVat: boolean;
  vatRatePercent: number;
  invoiceTitle: string;
  /** Préfixe pour la numérotation (ex. FAC → FAC-2026-00001) */
  invoiceNumberPrefix: string;
}

const STORAGE_KEY = 'infinitecore_invoice_pdf_settings_v1';

export const DEFAULT_INVOICE_SETTINGS: InvoicePdfSettings = {
  companyName: 'Infinite Core',
  companyAddressLines: ['Abidjan, Côte d’Ivoire'],
  companyEmail: 'contact@infinitecore.ci',
  companyPhone: '',
  legalFooter:
    'Paiement sous 30 jours sauf mention contraire. En cas de retard, pénalités de retard au taux légal en vigueur.',
  currencyLabel: 'FCFA',
  showVat: false,
  vatRatePercent: 18,
  invoiceTitle: 'FACTURE',
  invoiceNumberPrefix: 'FAC',
};

export function loadInvoiceSettings(): InvoicePdfSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_INVOICE_SETTINGS, companyAddressLines: [...DEFAULT_INVOICE_SETTINGS.companyAddressLines] };
    const parsed = JSON.parse(raw) as Partial<InvoicePdfSettings>;
    const lines = Array.isArray(parsed.companyAddressLines)
      ? parsed.companyAddressLines.filter((l): l is string => typeof l === 'string')
      : DEFAULT_INVOICE_SETTINGS.companyAddressLines;
    const prefix =
      typeof parsed.invoiceNumberPrefix === 'string' && parsed.invoiceNumberPrefix.trim()
        ? parsed.invoiceNumberPrefix.trim()
        : DEFAULT_INVOICE_SETTINGS.invoiceNumberPrefix;
    return {
      ...DEFAULT_INVOICE_SETTINGS,
      ...parsed,
      invoiceNumberPrefix: prefix,
      companyAddressLines: lines.length ? lines : DEFAULT_INVOICE_SETTINGS.companyAddressLines,
    };
  } catch {
    return { ...DEFAULT_INVOICE_SETTINGS, companyAddressLines: [...DEFAULT_INVOICE_SETTINGS.companyAddressLines] };
  }
}

export function saveInvoiceSettings(s: InvoicePdfSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export interface InvoicePaymentInput {
  id: string;
  amount: number;
  currency?: string;
  description?: string;
  createdAt: string;
  clientId?: string;
  clientEmail?: string;
  userId?: string;
  status?: string;
}

/** Métadonnées d’émission (numéro officiel, date affichée, brouillon). */
export interface InvoicePdfBuildMeta {
  invoiceNumber: string;
  /** ISO ou texte ; sinon date du paiement */
  documentDate?: string;
  isDraft?: boolean;
}

function formatMoney(n: number): string {
  return Math.round(n).toLocaleString('fr-FR', { maximumFractionDigits: 0 });
}

function formatDisplayDate(isoOrText: string | undefined, fallbackIso: string): string {
  if (!isoOrText) return new Date(fallbackIso).toLocaleDateString('fr-FR', { dateStyle: 'long' });
  const d = new Date(isoOrText);
  if (!Number.isNaN(d.getTime())) return d.toLocaleDateString('fr-FR', { dateStyle: 'long' });
  return isoOrText;
}

/**
 * Construit un PDF facture (A4) à partir d’un paiement / ligne journal et des paramètres d’en-tête.
 * @param meta Si fourni : numéro de facture officiel et date d’émission (workflow équipe).
 */
export function buildInvoicePdf(
  payment: InvoicePaymentInput,
  clientName: string,
  settings: InvoicePdfSettings,
  meta?: InvoicePdfBuildMeta
): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 16;
  let y = margin;

  doc.setFillColor(10, 16, 32);
  doc.rect(0, 0, pageW, 26, 'F');
  doc.setTextColor(242, 244, 248);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text(settings.invoiceTitle.toUpperCase(), margin, 17);

  doc.setTextColor(30, 41, 59);
  y = 34;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(settings.companyName, margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  y += 5;
  settings.companyAddressLines.forEach((line) => {
    doc.text(line, margin, y);
    y += 4.5;
  });
  if (settings.companyEmail) {
    doc.text(settings.companyEmail, margin, y);
    y += 4.5;
  }
  if (settings.companyPhone) {
    doc.text(settings.companyPhone, margin, y);
    y += 4.5;
  }

  const rightAlign = pageW - margin;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  if (meta?.invoiceNumber) {
    doc.text('N° facture', rightAlign, 34, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text(meta.invoiceNumber, rightAlign, 39, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text('Réf. mouvement', rightAlign, 45, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text(payment.id.substring(0, 18).toUpperCase(), rightAlign, 50, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text('Date', rightAlign, 56, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text(formatDisplayDate(meta.documentDate, payment.createdAt), rightAlign, 61, { align: 'right' });
  } else {
    doc.text('N° pièce', rightAlign, 34, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text(payment.id.substring(0, 14).toUpperCase(), rightAlign, 39, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text('Date', rightAlign, 45, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text(new Date(payment.createdAt).toLocaleDateString('fr-FR', { dateStyle: 'long' }), rightAlign, 50, { align: 'right' });
  }

  y = Math.max(y + 6, meta?.invoiceNumber ? 66 : 58);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Facturé à', margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.text(clientName || 'Client', margin, y);
  y += 4.5;
  const mail = payment.clientEmail || '';
  if (mail) {
    doc.text(mail, margin, y);
    y += 4.5;
  }

  const amount = Number(payment.amount) || 0;
  const desc = (payment.description || 'Prestation').trim() || 'Prestation';
  const cur = settings.currencyLabel;

  let unitHt = amount;
  let lineHt = amount;
  let tva = 0;
  let ttc = amount;

  if (settings.showVat && settings.vatRatePercent > 0) {
    ttc = amount;
    unitHt = ttc / (1 + settings.vatRatePercent / 100);
    lineHt = unitHt;
    tva = ttc - unitHt;
  }

  y += 8;
  autoTable(doc, {
    startY: y,
    head: [['Désignation', 'Qté', `PU HT (${cur})`, `Total HT (${cur})`]],
    body: [[desc, '1', formatMoney(unitHt), formatMoney(lineHt)]],
    theme: 'striped',
    headStyles: { fillColor: [201, 169, 98], textColor: [10, 16, 32], fontStyle: 'bold' },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 0: { cellWidth: 85 } },
  });

  const tableEnd = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  let sumY = tableEnd + 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  if (settings.showVat && settings.vatRatePercent > 0) {
    doc.text(`Total HT : ${formatMoney(unitHt)} ${cur}`, margin, sumY);
    sumY += 6;
    doc.text(`TVA (${settings.vatRatePercent} %) : ${formatMoney(tva)} ${cur}`, margin, sumY);
    sumY += 6;
    doc.setFont('helvetica', 'bold');
    doc.text(`Total TTC : ${formatMoney(ttc)} ${cur}`, margin, sumY);
  } else {
    doc.setFont('helvetica', 'bold');
    doc.text(`Total TTC : ${formatMoney(amount)} ${cur}`, margin, sumY);
  }

  sumY += 10;
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  const footer = settings.legalFooter.trim();
  if (footer) {
    const lines = doc.splitTextToSize(footer, pageW - 2 * margin);
    doc.text(lines, margin, sumY);
  }

  if (meta?.isDraft) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(52);
    doc.setTextColor(230, 230, 230);
    doc.text('APERÇU', pageW / 2, pageH / 2, { align: 'center', angle: 35 });
    doc.setTextColor(30, 41, 59);
  }

  return doc;
}

export function downloadInvoicePdf(
  payment: InvoicePaymentInput,
  clientName: string,
  settings: InvoicePdfSettings,
  meta?: InvoicePdfBuildMeta
): void {
  const doc = buildInvoicePdf(payment, clientName, settings, meta);
  const safeName = meta?.invoiceNumber
    ? meta.invoiceNumber.replace(/[^\w.-]+/g, '_')
    : payment.id.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 24);
  doc.save(`facture_${safeName}.pdf`);
}

/** Ouvre un aperçu dans un nouvel onglet (sans téléchargement automatique). */
export function openInvoicePdfPreview(
  payment: InvoicePaymentInput,
  clientName: string,
  settings: InvoicePdfSettings,
  meta?: InvoicePdfBuildMeta
): boolean {
  const doc = buildInvoicePdf(payment, clientName, settings, meta);
  const url = doc.output('bloburl') as string;
  const w = window.open(url, '_blank', 'noopener,noreferrer');
  return Boolean(w);
}
