import { InjectionToken } from '@angular/core';
import type { Invoice, InvoiceCreate, InvoiceUpdate } from '../../features/invoices/invoice.model';
import type { Page } from '../models/page.model';

export interface InvoiceListParams {
  search?: string;
  status?: string;
  page?: number;
  perPage?: number;
}

export interface IInvoiceService {
  list(params: InvoiceListParams): Promise<Page<Invoice>>;
  create(data: InvoiceCreate): Promise<Invoice>;
  update(id: string, data: InvoiceUpdate): Promise<Invoice>;
  issue(id: string): Promise<Invoice>;
  pay(id: string): Promise<Invoice>;
  cancel(id: string): Promise<Invoice>;
  downloadPdf(id: string): Promise<Blob>;
}

export const INVOICE_SERVICE = new InjectionToken<IInvoiceService>('InvoiceService');
