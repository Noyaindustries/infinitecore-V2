import { doc, onSnapshot, runTransaction, setDoc } from '@/lib/mongoFirestore';
import { db } from '@/lib/clientSdk';
import {
  type InvoicePdfSettings,
  DEFAULT_INVOICE_SETTINGS,
  loadInvoiceSettings,
} from '../lib/invoicePdf';

const COL = 'admin_config';
const DOC_SETTINGS = 'invoice_pdf';
const DOC_SEQUENCE = 'invoice_sequence';

function normalizeLines(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [...DEFAULT_INVOICE_SETTINGS.companyAddressLines];
  const lines = raw.filter((l): l is string => typeof l === 'string' && l.trim().length > 0);
  return lines.length ? lines : [...DEFAULT_INVOICE_SETTINGS.companyAddressLines];
}

/** Fusionne un document Firestore avec les valeurs par défaut. */
export function invoiceSettingsFromFirestore(data: Record<string, unknown> | undefined): InvoicePdfSettings {
  if (!data) return { ...DEFAULT_INVOICE_SETTINGS, companyAddressLines: [...DEFAULT_INVOICE_SETTINGS.companyAddressLines] };
  const prefix =
    typeof data.invoiceNumberPrefix === 'string' && data.invoiceNumberPrefix.trim()
      ? data.invoiceNumberPrefix.trim()
      : DEFAULT_INVOICE_SETTINGS.invoiceNumberPrefix;
  return {
    ...DEFAULT_INVOICE_SETTINGS,
    companyName: typeof data.companyName === 'string' ? data.companyName : DEFAULT_INVOICE_SETTINGS.companyName,
    companyAddressLines: normalizeLines(data.companyAddressLines),
    companyEmail: typeof data.companyEmail === 'string' ? data.companyEmail : DEFAULT_INVOICE_SETTINGS.companyEmail,
    companyPhone: typeof data.companyPhone === 'string' ? data.companyPhone : DEFAULT_INVOICE_SETTINGS.companyPhone,
    legalFooter: typeof data.legalFooter === 'string' ? data.legalFooter : DEFAULT_INVOICE_SETTINGS.legalFooter,
    currencyLabel: typeof data.currencyLabel === 'string' ? data.currencyLabel : DEFAULT_INVOICE_SETTINGS.currencyLabel,
    showVat: typeof data.showVat === 'boolean' ? data.showVat : DEFAULT_INVOICE_SETTINGS.showVat,
    vatRatePercent:
      typeof data.vatRatePercent === 'number' && !Number.isNaN(data.vatRatePercent)
        ? data.vatRatePercent
        : DEFAULT_INVOICE_SETTINGS.vatRatePercent,
    invoiceTitle: typeof data.invoiceTitle === 'string' ? data.invoiceTitle : DEFAULT_INVOICE_SETTINGS.invoiceTitle,
    invoiceNumberPrefix: prefix,
  };
}

export function invoiceSettingsToFirestore(s: InvoicePdfSettings): Record<string, unknown> {
  return {
    companyName: s.companyName,
    companyAddressLines: s.companyAddressLines,
    companyEmail: s.companyEmail,
    companyPhone: s.companyPhone,
    legalFooter: s.legalFooter,
    currencyLabel: s.currencyLabel,
    showVat: s.showVat,
    vatRatePercent: s.vatRatePercent,
    invoiceTitle: s.invoiceTitle,
    invoiceNumberPrefix: s.invoiceNumberPrefix,
    updatedAt: new Date().toISOString(),
  };
}

export function subscribeRemoteInvoiceSettings(callback: (settings: InvoicePdfSettings) => void): () => void {
  return onSnapshot(
    doc(db, COL, DOC_SETTINGS),
    (snap) => {
      if (!snap.exists()) {
        callback(loadInvoiceSettings());
        return;
      }
      callback(invoiceSettingsFromFirestore(snap.data() as Record<string, unknown>));
    },
    () => {
      callback(loadInvoiceSettings());
    }
  );
}

export async function persistRemoteInvoiceSettings(settings: InvoicePdfSettings): Promise<void> {
  await setDoc(doc(db, COL, DOC_SETTINGS), invoiceSettingsToFirestore(settings), { merge: true });
}

/**
 * Attribue un numéro de facture au paiement (transaction : compteur + mise à jour document).
 * Si le paiement a déjà un numéro, le retourne sans incrémenter.
 */
export async function ensurePaymentInvoiceNumber(
  paymentId: string,
  numberPrefix: string
): Promise<{ invoiceNumber: string; invoiceIssuedAt: string }> {
  const year = new Date().getFullYear();
  return runTransaction(db, async (transaction) => {
    const payRef = doc(db, 'payments', paymentId);
    const paySnap = await transaction.get(payRef);
    if (!paySnap.exists()) {
      throw new Error('Paiement introuvable.');
    }
    const data = paySnap.data() as Record<string, unknown>;
    const existing =
      typeof data.invoiceNumber === 'string' && data.invoiceNumber.trim() ? data.invoiceNumber.trim() : '';
    if (existing) {
      const issued =
        typeof data.invoiceIssuedAt === 'string' && data.invoiceIssuedAt
          ? data.invoiceIssuedAt
          : new Date().toISOString();
      return { invoiceNumber: existing, invoiceIssuedAt: issued };
    }

    const seqRef = doc(db, COL, DOC_SEQUENCE);
    const seqSnap = await transaction.get(seqRef);
    const last = seqSnap.exists() ? Number(seqSnap.data()?.lastNumber) || 0 : 0;
    const next = last + 1;
    const issuedAt = new Date().toISOString();
    const safePrefix = (numberPrefix || 'FAC').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 12) || 'FAC';
    const invoiceNumber = `${safePrefix}-${year}-${String(next).padStart(5, '0')}`;

    transaction.set(seqRef, { lastNumber: next, updatedAt: issuedAt }, { merge: true });
    transaction.update(payRef, {
      invoiceNumber,
      invoiceIssuedAt: issuedAt,
      factureEtape: 'paiement_en_cours',
    });

    return { invoiceNumber, invoiceIssuedAt: issuedAt };
  });
}
