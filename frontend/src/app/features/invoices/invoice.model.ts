import { localIsoDate } from '../../shared/dates';

export const INVOICE_STATUSES = ['draft', 'issued', 'paid', 'cancelled'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const PAYMENT_METHODS = ['cash', 'twint', 'iban'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface InvoiceLine {
  id: string;
  invoiceId: string;
  articleId: string | null;
  descriptionSnapshot: string;
  quantity: number;
  unitPriceSnapshot: number;
  vatRateSnapshot: number | null;
}

/** A payment reminder sent for an overdue invoice: 1st, 2nd… */
export interface InvoiceReminder {
  number: number;
  /** ISO dates: when it was sent, and the new deadline it gives. */
  sentOn: string;
  dueOn: string;
}

export interface Invoice {
  id: string;
  customerId: string;
  customerName: string;
  invoiceNumber: string | null;
  status: InvoiceStatus;
  issueDate: string | null;
  dueDate: string | null;
  paidAt: string | null;
  discountPercent: number;
  notes: string;
  paymentMethod: PaymentMethod | null;
  lines: InvoiceLine[];
  reminders: InvoiceReminder[];
}

export interface InvoiceLineCreate {
  articleId: string | null;
  descriptionSnapshot: string;
  quantity: number;
  unitPriceSnapshot: number;
  vatRateSnapshot: number | null;
}

export interface InvoiceCreate {
  customerId: string;
  discountPercent: number;
  notes: string;
  paymentMethod: PaymentMethod | null;
  lines: InvoiceLineCreate[];
}

export type InvoiceUpdate = InvoiceCreate;

/** A payment received: when, and how. */
export interface Payment {
  paidAt: string;
  paymentMethod: PaymentMethod;
}

/** File name of a reminder's PDF: the invoice number, then R and its number. */
export function reminderPdfName(invoice: Pick<Invoice, 'invoiceNumber'>, number: number): string {
  return `${invoice.invoiceNumber}-R${number}.pdf`;
}

/** A draft has no number yet: its PDF falls back to a generic name. */
export function invoicePdfName(invoice: Pick<Invoice, 'invoiceNumber'>): string {
  return `${invoice.invoiceNumber ?? 'invoice'}.pdf`;
}

/** Total including VAT: the discount applies to every line before its VAT. */
export function invoiceTotal(invoice: {
  discountPercent: number;
  lines: Pick<InvoiceLine, 'quantity' | 'unitPriceSnapshot' | 'vatRateSnapshot'>[];
}): number {
  const factor = 1 - invoice.discountPercent / 100;
  return invoice.lines.reduce(
    (sum, l) => sum + l.quantity * l.unitPriceSnapshot * factor * (1 + (l.vatRateSnapshot ?? 0)),
    0,
  );
}

/** Issued and past its due date; the due date itself is still on time. */
export function isOverdue(invoice: Pick<Invoice, 'status' | 'dueDate'>, today = new Date()): boolean {
  if (invoice.status !== 'issued' || !invoice.dueDate) return false;
  return invoice.dueDate < localIsoDate(today);
}

/** The confirmation before the next reminder of an invoice: fills {n} and {number}. */
export function nextReminderMessage(
  template: string, invoice: { invoiceNumber: string | null }, sentSoFar: number,
): string {
  return template.replace('{n}', String(sentSoFar + 1)).replace('{number}', invoice.invoiceNumber ?? '');
}
