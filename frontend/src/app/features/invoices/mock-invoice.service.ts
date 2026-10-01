import { Injectable } from '@angular/core';
import { IInvoiceService, InvoiceListParams } from '../../core/tokens/invoice-service.token';
import { Page } from '../../core/models/page.model';
import { sortItems } from '../../shared/sort';
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
    let filtered = [...this.invoices].reverse();
    if (params.customerId) {
      filtered = filtered.filter((i) => i.customerId === params.customerId);
    }
    if (statusFilter && statusFilter !== 'all') {
      filtered = filtered.filter((i) => i.status === statusFilter);
    }
    if (search) {
      const words = search.split(/\s+/).filter(Boolean);
      filtered = filtered.filter((i) => {
        const haystack = [i.invoiceNumber ?? '', i.customerName, ...i.lines.map((l) => l.descriptionSnapshot)]
          .join(' ').toLowerCase();
        return words.every((w) => haystack.includes(w));
      });
    }
    const statusRank = ['draft', 'issued', 'paid', 'cancelled'];
    const sorted = sortItems(filtered, params.sort, {
      number: (i) => i.invoiceNumber,
      customer: (i) => i.customerName.toLowerCase(),
      date: (i) => i.issueDate,
      due: (i) => i.dueDate,
      paid_at: (i) => i.paidAt,
      total: (i) => i.lines.reduce(
        (sum, l) => sum + l.quantity * l.unitPriceSnapshot * (1 + (l.vatRateSnapshot ?? 0)), 0,
      ) * (1 - i.discountPercent / 100),
      status: (i) => statusRank.indexOf(i.status),
    });
    const total = sorted.length;
    const items = sorted.slice((page - 1) * perPage, page * perPage);
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
      paidAt: null,
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
    const stem = `FAC-${today.replaceAll('-', '')}-`;
    const sequence = this.invoices.filter((i) => i.invoiceNumber?.startsWith(stem)).length + 1;
    inv.invoiceNumber = `${stem}${String(sequence).padStart(4, '0')}`;
    return Promise.resolve(inv);
  }

  pay(id: string): Promise<Invoice> {
    const inv = this.invoices.find((i) => i.id === id)!;
    inv.status = 'paid';
    inv.paidAt = new Date().toISOString().slice(0, 10);
    return Promise.resolve(inv);
  }

  updatePaymentDate(id: string, paidAt: string): Promise<Invoice> {
    const inv = this.invoices.find((i) => i.id === id)!;
    inv.paidAt = paidAt;
    return Promise.resolve(inv);
  }

  cancel(id: string): Promise<Invoice> {
    const inv = this.invoices.find((i) => i.id === id)!;
    inv.status = 'cancelled';
    return Promise.resolve(inv);
  }

  delete(id: string): Promise<void> {
    this.invoices = this.invoices.filter((i) => i.id !== id);
    return Promise.resolve();
  }

  downloadPdf(_id: string): Promise<Blob> {
    return Promise.resolve(new Blob(['mock-pdf'], { type: 'application/pdf' }));
  }
}
