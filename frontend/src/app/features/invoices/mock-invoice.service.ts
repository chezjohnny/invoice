import { Injectable, inject } from '@angular/core';
import { CUSTOMER_SERVICE } from '../../core/tokens/customer-service.token';
import { IInvoiceService, InvoiceListParams } from '../../core/tokens/invoice-service.token';
import { Page } from '../../core/models/page.model';
import { sortItems } from '../../shared/sort';
import { customerDisplayName } from '../customers/customer.model';
import { Invoice, InvoiceCreate, InvoiceUpdate, Payment, PaymentMethod, invoiceTotal } from './invoice.model';
import { localIsoDate } from '../../shared/dates';

@Injectable()
export class MockInvoiceService implements IInvoiceService {
  private readonly customers = inject(CUSTOMER_SERVICE);
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
    if (statusFilter) {
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
      total: invoiceTotal,
      status: (i) => statusRank.indexOf(i.status),
    });
    const total = sorted.length;
    const items = sorted.slice((page - 1) * perPage, page * perPage);
    const pages = Math.max(1, Math.ceil(total / perPage));
    return Promise.resolve({ items, total, page, perPage, pages });
  }

  getById(id: string): Promise<Invoice> {
    return Promise.resolve(structuredClone(this.invoices.find((i) => i.id === id)!));
  }

  async create(data: InvoiceCreate): Promise<Invoice> {
    const customerName = await this.customerName(data.customerId);
    const invoice: Invoice = {
      id: String(this.nextNum++),
      customerId: data.customerId,
      customerName,
      invoiceNumber: null,
      status: 'draft',
      issueDate: null,
      dueDate: null,
      paidAt: null,
      discountPercent: data.discountPercent,
      notes: data.notes,
      paymentMethod: data.paymentMethod,
      reminders: [],
      lines: data.lines.map((l, i) => ({ ...l, id: `line-${this.nextNum}-${i}` })),
    };
    this.invoices.push(invoice);
    return invoice;
  }

  async update(id: string, data: InvoiceUpdate): Promise<Invoice> {
    const customerName = await this.customerName(data.customerId);
    const idx = this.invoices.findIndex((i) => i.id === id);
    this.invoices[idx] = {
      ...this.invoices[idx],
      customerId: data.customerId,
      customerName,
      discountPercent: data.discountPercent,
      notes: data.notes,
      paymentMethod: data.paymentMethod,
      lines: data.lines.map((l, i) => ({ ...l, id: `line-${id}-${i}` })),
    };
    return this.invoices[idx];
  }

  /** The API joins it in; here, from the customers' mock. */
  private async customerName(customerId: string): Promise<string> {
    return customerDisplayName(await this.customers.getById(customerId));
  }

  issue(id: string): Promise<Invoice> {
    const inv = this.invoices.find((i) => i.id === id)!;
    const today = localIsoDate();
    inv.status = 'issued';
    inv.issueDate = today;
    // Same shape as the API: YYMMDD then the unpadded sequence of the day, e.g. 2610051.
    const stem = today.slice(2).replaceAll('-', '');
    const sequence = this.invoices.filter((i) => i.invoiceNumber?.startsWith(stem)).length + 1;
    inv.invoiceNumber = `${stem}${sequence}`;
    return Promise.resolve(inv);
  }

  pay(id: string, payment?: Payment): Promise<Invoice> {
    const inv = this.invoices.find((i) => i.id === id)!;
    inv.status = 'paid';
    inv.paidAt = payment?.paidAt ?? localIsoDate();
    if (payment) inv.paymentMethod = payment.paymentMethod;
    return Promise.resolve(inv);
  }

  updatePaymentDate(id: string, paidAt: string): Promise<Invoice> {
    const inv = this.invoices.find((i) => i.id === id)!;
    inv.paidAt = paidAt;
    return Promise.resolve(inv);
  }

  updatePaymentMethod(id: string, paymentMethod: PaymentMethod): Promise<Invoice> {
    const inv = this.invoices.find((i) => i.id === id)!;
    inv.paymentMethod = paymentMethod;
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

  createReminder(id: string): Promise<Invoice> {
    const inv = this.invoices.find((i) => i.id === id)!;
    const today = new Date();
    const due = new Date(today);
    due.setDate(today.getDate() + 10);
    inv.reminders.push({
      number: inv.reminders.length + 1, sentOn: localIsoDate(today), dueOn: localIsoDate(due),
    });
    return Promise.resolve(inv);
  }

  downloadReminderPdf(): Promise<Blob> {
    return Promise.resolve(new Blob(['mock-pdf'], { type: 'application/pdf' }));
  }

  downloadPdf(): Promise<Blob> {
    return Promise.resolve(new Blob(['mock-pdf'], { type: 'application/pdf' }));
  }
}
