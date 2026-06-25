import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { IInvoiceService } from '../../core/tokens/invoice-service.token';
import { Invoice, InvoiceCreate, InvoiceLine, InvoiceUpdate } from './invoice.model';

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
  tenant_id: string;
  customer_id: string;
  invoice_number: string | null;
  status: string;
  issue_date: string | null;
  due_date: string | null;
  currency: string;
  discount_percent: string;
  notes: string;
  pdf_url: string | null;
  lines: InvoiceLineDto[];
}

@Injectable()
export class HttpInvoiceService implements IInvoiceService {
  private readonly http = inject(HttpClient);

  getAll(): Promise<Invoice[]> {
    return firstValueFrom(this.http.get<InvoiceDto[]>('/api/invoices')).then((dtos) =>
      dtos.map(this.toInvoice)
    );
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

  pay(id: string): Promise<Invoice> {
    return firstValueFrom(
      this.http.post<InvoiceDto>(`/api/invoices/${id}/pay`, {})
    ).then(this.toInvoice);
  }

  cancel(id: string): Promise<Invoice> {
    return firstValueFrom(
      this.http.post<InvoiceDto>(`/api/invoices/${id}/cancel`, {})
    ).then(this.toInvoice);
  }

  downloadPdf(id: string): Promise<Blob> {
    return firstValueFrom(
      this.http.get(`/api/invoices/${id}/pdf`, { responseType: 'blob' })
    );
  }

  private toInvoice(dto: InvoiceDto): Invoice {
    return {
      id: dto.id,
      tenantId: dto.tenant_id,
      customerId: dto.customer_id,
      invoiceNumber: dto.invoice_number,
      status: dto.status as Invoice['status'],
      issueDate: dto.issue_date,
      dueDate: dto.due_date,
      currency: dto.currency,
      discountPercent: parseFloat(dto.discount_percent),
      notes: dto.notes,
      pdfUrl: dto.pdf_url,
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
    };
  }

  private toDto(data: InvoiceCreate) {
    return {
      customer_id: data.customerId,
      currency: data.currency,
      discount_percent: data.discountPercent.toFixed(2),
      notes: data.notes,
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
