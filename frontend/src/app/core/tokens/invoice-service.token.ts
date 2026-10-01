import { InjectionToken } from '@angular/core';
import type { Invoice, InvoiceCreate, InvoiceUpdate } from '../../features/invoices/invoice.model';
import type { Page } from '../models/page.model';
import type { Locale } from '../i18n/translations';
import type { Sort } from '../../shared/sort';

export interface InvoiceListParams {
  search?: string;
  status?: string;
  customerId?: string;
  sort?: Sort | null;
  page?: number;
  perPage?: number;
}

export interface IInvoiceService {
  list(params: InvoiceListParams): Promise<Page<Invoice>>;
  create(data: InvoiceCreate): Promise<Invoice>;
  update(id: string, data: InvoiceUpdate): Promise<Invoice>;
  issue(id: string): Promise<Invoice>;
  pay(id: string): Promise<Invoice>;
  updatePaymentDate(id: string, paidAt: string): Promise<Invoice>;
  cancel(id: string): Promise<Invoice>;
  delete(id: string): Promise<void>;
  downloadPdf(id: string, locale: Locale): Promise<Blob>;
}

export const INVOICE_SERVICE = new InjectionToken<IInvoiceService>('InvoiceService');
