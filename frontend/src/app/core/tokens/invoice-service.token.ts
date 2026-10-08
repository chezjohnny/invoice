import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';
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
  list(params: InvoiceListParams): Observable<Page<Invoice>>;
  getById(id: string): Observable<Invoice>;
  create(data: InvoiceCreate): Observable<Invoice>;
  update(id: string, data: InvoiceUpdate): Observable<Invoice>;
  issue(id: string): Observable<Invoice>;
  /** Without `payment`: paid today, with the payment method planned on the invoice. */
  pay(id: string, payment?: Payment): Observable<Invoice>;
  updatePaymentDate(id: string, paidAt: string): Observable<Invoice>;
  updatePaymentMethod(id: string, paymentMethod: PaymentMethod): Observable<Invoice>;
  cancel(id: string): Observable<Invoice>;
  delete(id: string): Observable<void>;
  /** Records the next reminder of an overdue invoice, dated today. */
  createReminder(id: string): Observable<Invoice>;
  downloadReminderPdf(id: string, number: number, locale: Locale): Observable<Blob>;
  downloadPdf(id: string, locale: Locale): Observable<Blob>;
}

export const INVOICE_SERVICE = new InjectionToken<IInvoiceService>('InvoiceService');
