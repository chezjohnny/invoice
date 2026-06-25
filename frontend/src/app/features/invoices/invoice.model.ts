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
  invoiceNumber: string | null;
  status: InvoiceStatus;
  issueDate: string | null;
  dueDate: string | null;
  currency: string;
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
  currency: string;
  discountPercent: number;
  notes: string;
  lines: InvoiceLineCreate[];
}

export type InvoiceUpdate = InvoiceCreate;
