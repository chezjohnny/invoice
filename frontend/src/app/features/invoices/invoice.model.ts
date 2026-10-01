export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'cancelled';

export interface InvoiceLine {
  id: string;
  invoiceId: string;
  articleId: string | null;
  descriptionSnapshot: string;
  quantity: number;
  unitPriceSnapshot: number;
  vatRateSnapshot: number | null;
}

export interface Invoice {
  id: string;
  tenantId: string;
  customerId: string;
  customerName: string;
  invoiceNumber: string | null;
  status: InvoiceStatus;
  issueDate: string | null;
  dueDate: string | null;
  paidAt: string | null;
  discountPercent: number;
  notes: string;
  pdfUrl: string | null;
  lines: InvoiceLine[];
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
  lines: InvoiceLineCreate[];
}

export type InvoiceUpdate = InvoiceCreate;

/** A draft has no number yet: its PDF falls back to a generic name. */
export function invoicePdfName(invoice: Pick<Invoice, 'invoiceNumber'>): string {
  return `${invoice.invoiceNumber ?? 'invoice'}.pdf`;
}
