import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { IInvoiceService, InvoiceListParams } from '../../core/tokens/invoice-service.token';
import { Page, PageDto, toPage } from '../../core/models/page.model';
import { withSort } from '../../shared/sort';
import { Locale } from '../../core/i18n/translations';
import { Invoice, InvoiceCreate, InvoiceLine, InvoiceUpdate, Payment, PaymentMethod } from './invoice.model';

interface InvoiceLineDto {
  id: string;
  invoice_id: string;
  article_id: string | null;
  description_snapshot: string;
  quantity: number;
  unit_price_snapshot: string;
  vat_rate_snapshot: string | null;
}

interface InvoiceDto {
  id: string;
  customer_id: string;
  customer_name: string;
  invoice_number: string | null;
  status: string;
  issue_date: string | null;
  due_date: string | null;
  paid_at: string | null;
  discount_percent: string;
  notes: string;
  payment_method: PaymentMethod | null;
  lines: InvoiceLineDto[];
  reminders: { number: number; sent_on: string; due_on: string }[];
}


@Injectable()
export class HttpInvoiceService implements IInvoiceService {
  private readonly http = inject(HttpClient);

  list(params: InvoiceListParams): Promise<Page<Invoice>> {
    let httpParams = new HttpParams()
      .set('search', params.search ?? '')
      .set('page', String(params.page ?? 1))
      .set('per_page', String(params.perPage ?? 20));
    if (params.status) {
      httpParams = httpParams.set('status', params.status);
    }
    if (params.customerId) {
      httpParams = httpParams.set('customer_id', params.customerId);
    }
    return firstValueFrom(
      this.http.get<PageDto<InvoiceDto>>('/api/invoices', {
        params: withSort(httpParams, params.sort),
      })
    ).then((dto) => toPage(dto, this.toInvoice));
  }

  getById(id: string): Promise<Invoice> {
    return firstValueFrom(this.http.get<InvoiceDto>(`/api/invoices/${id}`)).then(this.toInvoice);
  }

  create(data: InvoiceCreate): Promise<Invoice> {
    return firstValueFrom(
      this.http.post<InvoiceDto>('/api/invoices', this.toDto(data))
    ).then(this.toInvoice);
  }

  update(id: string, data: InvoiceUpdate): Promise<Invoice> {
    return firstValueFrom(
      this.http.put<InvoiceDto>(`/api/invoices/${id}`, this.toDto(data))
    ).then(this.toInvoice);
  }

  issue(id: string): Promise<Invoice> {
    return firstValueFrom(
      this.http.post<InvoiceDto>(`/api/invoices/${id}/issue`, {})
    ).then(this.toInvoice);
  }

  pay(id: string, payment?: Payment): Promise<Invoice> {
    const body = payment ? { paid_at: payment.paidAt, payment_method: payment.paymentMethod } : {};
    return firstValueFrom(
      this.http.post<InvoiceDto>(`/api/invoices/${id}/pay`, body)
    ).then(this.toInvoice);
  }

  updatePaymentDate(id: string, paidAt: string): Promise<Invoice> {
    return firstValueFrom(
      this.http.patch<InvoiceDto>(`/api/invoices/${id}/payment-date`, { paid_at: paidAt })
    ).then(this.toInvoice);
  }

  updatePaymentMethod(id: string, paymentMethod: PaymentMethod): Promise<Invoice> {
    return firstValueFrom(
      this.http.patch<InvoiceDto>(`/api/invoices/${id}/payment-method`, { payment_method: paymentMethod })
    ).then(this.toInvoice);
  }

  cancel(id: string): Promise<Invoice> {
    return firstValueFrom(
      this.http.post<InvoiceDto>(`/api/invoices/${id}/cancel`, {})
    ).then(this.toInvoice);
  }

  delete(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/invoices/${id}`));
  }

  createReminder(id: string): Promise<Invoice> {
    return firstValueFrom(
      this.http.post<InvoiceDto>(`/api/invoices/${id}/reminders`, {})
    ).then(this.toInvoice);
  }

  downloadReminderPdf(id: string, number: number, locale: Locale): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`/api/invoices/${id}/reminders/${number}/pdf`, {
        params: new HttpParams().set('lang', locale),
        responseType: 'blob',
      })
    );
  }

  downloadPdf(id: string, locale: Locale): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`/api/invoices/${id}/pdf`, {
        params: new HttpParams().set('lang', locale),
        responseType: 'blob',
      })
    );
  }

  private toInvoice(dto: InvoiceDto): Invoice {
    return {
      id: dto.id,
      customerId: dto.customer_id,
      customerName: dto.customer_name ?? '',
      invoiceNumber: dto.invoice_number,
      status: dto.status as Invoice['status'],
      issueDate: dto.issue_date,
      dueDate: dto.due_date,
      paidAt: dto.paid_at,
      discountPercent: parseFloat(dto.discount_percent),
      notes: dto.notes,
      paymentMethod: dto.payment_method,
      lines: dto.lines.map(
        (l): InvoiceLine => ({
          id: l.id,
          invoiceId: l.invoice_id,
          articleId: l.article_id,
          descriptionSnapshot: l.description_snapshot,
          quantity: l.quantity,
          unitPriceSnapshot: parseFloat(l.unit_price_snapshot),
          vatRateSnapshot: l.vat_rate_snapshot != null ? parseFloat(l.vat_rate_snapshot) : null,
        })
      ),
      reminders: dto.reminders.map((r) => ({ number: r.number, sentOn: r.sent_on, dueOn: r.due_on })),
    };
  }

  private toDto(data: InvoiceCreate) {
    return {
      customer_id: data.customerId,
      discount_percent: data.discountPercent.toFixed(2),
      notes: data.notes,
      payment_method: data.paymentMethod,
      lines: data.lines.map((l) => ({
        article_id: l.articleId,
        description_snapshot: l.descriptionSnapshot,
        quantity: l.quantity,
        unit_price_snapshot: l.unitPriceSnapshot.toFixed(2),
        vat_rate_snapshot: l.vatRateSnapshot,
      })),
    };
  }
}
