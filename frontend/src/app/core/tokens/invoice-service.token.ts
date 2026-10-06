import { InjectionToken } from '@angular/core';
import type { Invoice, InvoiceCreate, InvoiceUpdate, Payment, PaymentMethod } from '../../features/invoices/invoice.model';
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
  getById(id: string): Promise<Invoice>;
  create(data: InvoiceCreate): Promise<Invoice>;
  update(id: string, data: InvoiceUpdate): Promise<Invoice>;
  issue(id: string): Promise<Invoice>;
  /** Without `payment`: paid today, with the payment method planned on the invoice. */
  pay(id: string, payment?: Payment): Promise<Invoice>;
  updatePaymentDate(id: string, paidAt: string): Promise<Invoice>;
  updatePaymentMethod(id: string, paymentMethod: PaymentMethod): Promise<Invoice>;
  cancel(id: string): Promise<Invoice>;
  delete(id: string): Promise<void>;
  /** Records the next reminder of an overdue invoice, dated today. */
  createReminder(id: string): Promise<Invoice>;
  downloadReminderPdf(id: string, number: number, locale: Locale): Promise<Blob>;
  downloadPdf(id: string, locale: Locale): Promise<Blob>;
}

export const INVOICE_SERVICE = new InjectionToken<IInvoiceService>('InvoiceService');
