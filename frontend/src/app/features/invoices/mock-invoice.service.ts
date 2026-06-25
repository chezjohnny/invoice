import { Injectable } from '@angular/core';
import { IInvoiceService, InvoiceListParams } from '../../core/tokens/invoice-service.token';
import { Page } from '../../core/models/page.model';
import { Invoice, InvoiceCreate, InvoiceUpdate } from './invoice.model';

@Injectable()
export class MockInvoiceService implements IInvoiceService {
  private invoices: Invoice[] = [];
  private nextNum = 1;

  list(params: InvoiceListParams): Promise<Page<Invoice>> {
    const search = (params.search ?? '').toLowerCase();
    const statusFilter = params.status ?? '';
    const page = params.page ?? 1;
    const perPage = params.perPage ?? 20;
    let filtered = [...this.invoices];
    if (params.customerId) {
      filtered = filtered.filter((i) => i.customerId === params.customerId);
    }
    if (statusFilter && statusFilter !== 'all') {
      filtered = filtered.filter((i) => i.status === statusFilter);
    }
    if (search) {
      filtered = filtered.filter((i) =>
        i.invoiceNumber?.toLowerCase().includes(search) ?? false
      );
    }
    const total = filtered.length;
    const items = filtered.slice((page - 1) * perPage, page * perPage);
    const pages = Math.max(1, Math.ceil(total / perPage));
    return Promise.resolve({ items, total, page, perPage, pages });
  }

  create(data: InvoiceCreate): Promise<Invoice> {
    const invoice: Invoice = {
      id: String(this.nextNum++),
      tenantId: 'mock-tenant',
      customerId: data.customerId,
      customerName: '',
      invoiceNumber: null,
      status: 'draft',
      issueDate: null,
      dueDate: null,
      discountPercent: data.discountPercent,
      notes: data.notes,
      pdfUrl: null,
      lines: data.lines.map((l, i) => ({
        id: `line-${this.nextNum}-${i}`,
        invoiceId: String(this.nextNum - 1),
        articleId: l.articleId,
        descriptionSnapshot: l.descriptionSnapshot,
        quantity: l.quantity,
        unitPriceSnapshot: l.unitPriceSnapshot,
        vatRateSnapshot: l.vatRateSnapshot,
      })),
    };
    this.invoices.push(invoice);
    return Promise.resolve(invoice);
  }

  update(id: string, data: InvoiceUpdate): Promise<Invoice> {
    const idx = this.invoices.findIndex((i) => i.id === id);
    this.invoices[idx] = {
      ...this.invoices[idx],
      customerId: data.customerId,
      discountPercent: data.discountPercent,
      notes: data.notes,
      lines: data.lines.map((l, i) => ({
        id: `line-${id}-${i}`,
        invoiceId: id,
        articleId: l.articleId,
        descriptionSnapshot: l.descriptionSnapshot,
        quantity: l.quantity,
        unitPriceSnapshot: l.unitPriceSnapshot,
        vatRateSnapshot: l.vatRateSnapshot,
      })),
    };
    return Promise.resolve(this.invoices[idx]);
  }

  issue(id: string): Promise<Invoice> {
    const inv = this.invoices.find((i) => i.id === id)!;
    const today = new Date().toISOString().slice(0, 10);
    inv.status = 'issued';
    inv.issueDate = today;
    inv.invoiceNumber = `INV-${new Date().getFullYear()}-${String(this.nextNum).padStart(4, '0')}`;
    return Promise.resolve(inv);
  }

  pay(id: string): Promise<Invoice> {
    const inv = this.invoices.find((i) => i.id === id)!;
    inv.status = 'paid';
    return Promise.resolve(inv);
  }

  cancel(id: string): Promise<Invoice> {
    const inv = this.invoices.find((i) => i.id === id)!;
    inv.status = 'cancelled';
    return Promise.resolve(inv);
  }

  downloadPdf(_id: string): Promise<Blob> {
    return Promise.resolve(new Blob(['mock-pdf'], { type: 'application/pdf' }));
  }
}
