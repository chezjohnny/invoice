import { Injectable } from '@angular/core';
import { IInvoiceService } from '../../core/tokens/invoice-service.token';
import { Invoice, InvoiceCreate, InvoiceUpdate } from './invoice.model';

@Injectable()
export class MockInvoiceService implements IInvoiceService {
  private invoices: Invoice[] = [];
  private nextNum = 1;

  getAll(): Promise<Invoice[]> {
    return Promise.resolve([...this.invoices]);
  }

  create(data: InvoiceCreate): Promise<Invoice> {
    const invoice: Invoice = {
      id: String(this.nextNum++),
      tenantId: 'mock-tenant',
      customerId: data.customerId,
      invoiceNumber: null,
      status: 'draft',
      issueDate: null,
      dueDate: null,
      currency: data.currency,
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
      currency: data.currency,
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
