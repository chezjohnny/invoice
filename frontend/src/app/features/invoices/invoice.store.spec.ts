import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { I18nService } from '../../core/i18n/i18n.service';
import { Locale } from '../../core/i18n/translations';
import { INVOICE_SERVICE } from '../../core/tokens/invoice-service.token';
import { Page } from '../../core/models/page.model';
import { Invoice, Payment, PaymentMethod } from './invoice.model';
import { InvoiceStore } from './invoice.store';

const BASE: Omit<Invoice, 'id' | 'status'> = {
  customerId: 'cust-1',
  customerName: 'Martin, Alice',
  invoiceNumber: null,
  issueDate: null,
  dueDate: null,
  paidAt: null,
  discountPercent: 0,
  notes: '',
  paymentMethod: null,
  reminders: [],
  lines: [],
};

const INVOICES: Invoice[] = [
  { ...BASE, id: '1', status: 'draft' },
  { ...BASE, id: '2', status: 'issued', invoiceNumber: '2601011', issueDate: '2026-01-01', dueDate: '2026-01-31' },
  { ...BASE, id: '3', status: 'paid', invoiceNumber: '2506011', issueDate: '2025-06-01', dueDate: '2025-06-30' },
  { ...BASE, id: '4', status: 'cancelled' },
];

function makePage(items: Invoice[], params?: { status?: string; page?: number }): Page<Invoice> {
  const filtered = params?.status && params.status !== 'all'
    ? items.filter((i) => i.status === params.status)
    : items;
  const page = params?.page ?? 1;
  return { items: filtered, total: filtered.length, page, perPage: 20, pages: Math.max(1, page) };
}

describe('InvoiceStore', () => {
  let store: InstanceType<typeof InvoiceStore>;
  let invoices: Invoice[];
  let failPay: boolean;
  let pdfLocale: Locale | undefined;
  let lastListParams: { status?: string; customerId?: string; page?: number } | undefined;
  let reminderPdf: { number: number; locale: Locale } | undefined;

  beforeEach(() => {
    invoices = structuredClone(INVOICES);
    failPay = false;
    pdfLocale = undefined;
    reminderPdf = undefined;
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        InvoiceStore,
        {
          provide: INVOICE_SERVICE,
          useValue: {
            list: async (params: { status?: string; customerId?: string; page?: number }) => {
              lastListParams = params;
              return makePage(invoices, params);
            },
            pay: async (id: string, payment: Payment): Promise<Invoice> => {
              if (failPay) throw new Error('already paid');
              const inv = invoices.find((i) => i.id === id)!;
              inv.status = 'paid';
              inv.paidAt = payment.paidAt;
              inv.paymentMethod = payment.paymentMethod;
              return inv;
            },
            updatePaymentDate: async (id: string, paidAt: string): Promise<Invoice> => {
              const inv = invoices.find((i) => i.id === id)!;
              inv.paidAt = paidAt;
              return inv;
            },
            updatePaymentMethod: async (id: string, paymentMethod: PaymentMethod): Promise<Invoice> => {
              const inv = invoices.find((i) => i.id === id)!;
              inv.paymentMethod = paymentMethod;
              return inv;
            },
            cancel: async (id: string): Promise<Invoice> => {
              const inv = invoices.find((i) => i.id === id)!;
              inv.status = 'cancelled';
              return inv;
            },
            delete: async (id: string): Promise<void> => {
              invoices = invoices.filter((i) => i.id !== id);
            },
            createReminder: async (id: string): Promise<Invoice> => {
              const inv = invoices.find((i) => i.id === id)!;
              inv.reminders = [...inv.reminders, {
                number: inv.reminders.length + 1, sentOn: '2026-10-05', dueOn: '2026-10-15',
              }];
              return inv;
            },
            downloadReminderPdf: async (_id: string, number: number, locale: Locale) => {
              reminderPdf = { number, locale };
              return new Blob(['%PDF'], { type: 'application/pdf' });
            },
            downloadPdf: async (_id: string, locale: Locale) => {
              pdfLocale = locale;
              return new Blob(['%PDF'], { type: 'application/pdf' });
            },
          },
        },
      ],
    });
    store = TestBed.inject(InvoiceStore);
  });

  it('loads invoices on init', async () => {
    await store.load();
    expect(store.items().length).toBe(4);
    expect(store.total()).toBe(4);
  });

  it('setStatusFilter resets page and updates filter', async () => {
    await store.load();
    await store.setStatusFilter('draft');
    expect(store.statusFilter()).toBe('draft');
    expect(store.page()).toBe(1);
    expect(store.items().every((i) => i.status === 'draft')).toBe(true);
  });

  it('setStatusFilter issued returns issued invoices', async () => {
    await store.load();
    store.setStatusFilter('issued');
    await store.load();
    expect(store.items().length).toBe(1);
    expect(store.items()[0].invoiceNumber).toBe('2601011');
  });

  it('clears loading when a mutation is rejected', async () => {
    await store.load();
    failPay = true;
    await expect(store.pay('2', { paidAt: '2026-06-25', paymentMethod: 'cash' })).rejects.toThrow();
    expect(store.loading()).toBe(false);
    expect(store.items().length).toBe(4);
  });

  it('pays an issued invoice on the given date and by the given method', async () => {
    await store.load();
    await store.pay('2', { paidAt: '2026-06-20', paymentMethod: 'twint' });
    const inv = store.items().find((i) => i.id === '2')!;
    expect(inv.status).toBe('paid');
    expect(inv.paidAt).toBe('2026-06-20');
    expect(inv.paymentMethod).toBe('twint');
    expect(pdfLocale).toBeUndefined();
  });

  it('prints the receipt once paid when asked', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pdf');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    await store.pay('2', { paidAt: '2026-06-20', paymentMethod: 'iban' }, true);
    expect(pdfLocale).toBeDefined();
  });

  it('updates the payment date of a paid invoice', async () => {
    await store.load();
    await store.setPaymentDate('3', '2025-06-15');
    expect(invoices.find((i) => i.id === '3')?.paidAt).toBe('2025-06-15');
  });

  it('changes the payment method of an issued invoice', async () => {
    await store.setPaymentMethod('2', 'twint');
    expect(store.items().find((i) => i.id === '2')!.paymentMethod).toBe('twint');
  });

  it('cancel transitions invoice to cancelled', async () => {
    await store.load();
    await store.cancel('1');
    expect(invoices.find((i) => i.id === '1')?.status).toBe('cancelled');
  });

  it('delete removes the invoice and reloads the list', async () => {
    await store.load();
    await store.cancel('1');
    await store.delete('1');
    expect(store.items().some((i) => i.id === '1')).toBe(false);
  });

  it('downloads the PDF in the UI language, named after the invoice number', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pdf');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    let filename = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      filename = this.download;
    });
    TestBed.inject(I18nService).locale.set('fr');
    await store.downloadPdf(INVOICES[1]);
    expect(pdfLocale).toBe('fr');
    expect(filename).toBe('2601011.pdf');
  });

  it('creates the next reminder and downloads it', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pdf');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    let filename = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      filename = this.download;
    });
    await store.createReminder('2');
    await store.createReminder('2');
    expect(store.items().find((i) => i.id === '2')!.reminders.map((r) => r.number)).toEqual([1, 2]);
    expect(reminderPdf?.number).toBe(2);
    expect(filename).toBe('2601011-R2.pdf');
  });

  it('shows the invoices of one customer', async () => {
    await store.showCustomer('cust-1');
    expect(store.customerId()).toBe('cust-1');
    expect(lastListParams?.customerId).toBe('cust-1');
  });

  it('steps back a page when deleting its last invoice', async () => {
    invoices = invoices.filter((i) => i.id === '4');
    await store.setPage(2);
    await store.delete('4');
    expect(store.page()).toBe(1);
  });

  it('setPage updates the page signal', () => {
    store.setPage(2);
    expect(store.page()).toBe(2);
  });
});
