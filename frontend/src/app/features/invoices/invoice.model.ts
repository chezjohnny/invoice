import { localIsoDate } from '../../shared/dates';

export const INVOICE_STATUSES = ['draft', 'issued', 'paid', 'cancelled'] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const PAYMENT_METHODS = ['cash', 'twint', 'iban'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface InvoiceLine {
  id: string;
  articleId: string | null;
  descriptionSnapshot: string;
  quantity: number;
  unitPriceSnapshot: number;
  vatRateSnapshot: number | null;
}

/** A payment reminder sent for an overdue invoice: 1st, 2nd… */
interface InvoiceReminder {
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

interface InvoiceLineCreate {
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
export interface InvoiceAmounts {
  subtotal: number;
  discount: number;
  /** Per rate, ascending. */
  vat: { rate: number; amount: number }[];
  total: number;
}

interface AmountsInput {
  discountPercent: number;
  lines: Pick<InvoiceLine, 'quantity' | 'unitPriceSnapshot' | 'vatRateSnapshot'>[];
}

/** n / d rounded half away from zero, in exact integers. */
function divRound(n: bigint, d: bigint): bigint {
  const q = (2n * (n < 0n ? -n : n) + d) / (2n * d);
  return n < 0n ? -q : q;
}

/**
 * The backend's invoice_amounts(), to the cent: the discount and each rate's VAT
 * (on the discounted lines) rounded once. In integers, as floats would round
 * 5.405 down where the PDF and the QR-bill round it up.
 */
export function invoiceAmounts({ discountPercent, lines }: AmountsInput): InvoiceAmounts {
  const cents = (l: AmountsInput['lines'][number]) =>
    BigInt(l.quantity) * BigInt(Math.round(l.unitPriceSnapshot * 100));
  const percent = BigInt(Math.round(discountPercent * 100)); // hundredths of a percent
  const subtotal = lines.reduce((sum, l) => sum + cents(l), 0n);
  const nets = new Map<number, bigint>();
  for (const l of lines) {
    if (l.vatRateSnapshot != null) nets.set(l.vatRateSnapshot, (nets.get(l.vatRateSnapshot) ?? 0n) + cents(l));
  }
  const vat = [...nets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([rate, net]) => ({
      rate,
      amount: divRound(net * (10000n - percent) * BigInt(Math.round(rate * 10000)), 10000n * 10000n),
    }));
  const discount = divRound(subtotal * percent, 10000n);
  const total = subtotal - discount + vat.reduce((sum, v) => sum + v.amount, 0n);
  const chf = (c: bigint) => Number(c) / 100;
  return {
    subtotal: chf(subtotal),
    discount: chf(discount),
    vat: vat.map((v) => ({ rate: v.rate, amount: chf(v.amount) })),
    total: chf(total),
  };
}

export function invoiceTotal(invoice: AmountsInput): number {
  return invoiceAmounts(invoice).total;
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
