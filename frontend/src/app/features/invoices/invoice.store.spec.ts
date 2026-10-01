import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { I18nService } from '../../core/i18n/i18n.service';
import { Locale } from '../../core/i18n/translations';
import { INVOICE_SERVICE } from '../../core/tokens/invoice-service.token';
import { Page } from '../../core/models/page.model';
import { Invoice, InvoiceCreate, InvoiceUpdate } from './invoice.model';
import { InvoiceStore } from './invoice.store';

const BASE: Omit<Invoice, 'id' | 'status'> = {
  tenantId: 'tenant-1',
  customerId: 'cust-1',
  customerName: 'Martin, Alice',
  invoiceNumber: null,
  issueDate: null,
  dueDate: null,
  paidAt: null,
  discountPercent: 0,
  notes: '',
  pdfUrl: null,
  lines: [],
};

const INVOICES: Invoice[] = [
  { ...BASE, id: '1', status: 'draft' },
  { ...BASE, id: '2', status: 'issued', invoiceNumber: 'FAC-20260101-0001', issueDate: '2026-01-01', dueDate: '2026-01-31' },
  { ...BASE, id: '3', status: 'paid', invoiceNumber: 'FAC-20250601-0001', issueDate: '2025-06-01', dueDate: '2025-06-30' },
  { ...BASE, id: '4', status: 'cancelled' },
];

function makePage(items: Invoice[], params?: { status?: string }): Page<Invoice> {
  const filtered = params?.status && params.status !== 'all'
    ? items.filter((i) => i.status === params.status)
    : items;
  return { items: filtered, total: filtered.length, page: 1, perPage: 20, pages: 1 };
}

describe('InvoiceStore', () => {
  let store: InstanceType<typeof InvoiceStore>;
  let invoices: Invoice[];
  let failIssue: boolean;
  let pdfLocale: Locale | undefined;

  beforeEach(() => {
    invoices = structuredClone(INVOICES);
    failIssue = false;
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        InvoiceStore,
        {
          provide: INVOICE_SERVICE,
          useValue: {
            list: async (params: { status?: string }) =>
              makePage(invoices, params),
            create: async (data: InvoiceCreate): Promise<Invoice> => {
              const inv: Invoice = {
                ...BASE, ...data, id: 'new-id', status: 'draft',
                lines: data.lines.map((l, i) => ({ ...l, id: `new-line-${i}`, invoiceId: 'new-id' })),
              };
              invoices.push(inv);
              return inv;
            },
            update: async (id: string, data: InvoiceUpdate): Promise<Invoice> => {
              const idx = invoices.findIndex((i) => i.id === id);
              invoices[idx] = {
                ...invoices[idx], ...data,
                lines: data.lines.map((l, i) => ({ ...l, id: `${id}-line-${i}`, invoiceId: id })),
              };
              return invoices[idx];
            },
            issue: async (id: string): Promise<Invoice> => {
              if (failIssue) throw new Error('incomplete company profile');
              const inv = invoices.find((i) => i.id === id)!;
              inv.status = 'issued';
              inv.invoiceNumber = 'FAC-20260101-0002';
              inv.issueDate = '2026-06-25';
              inv.dueDate = '2026-07-25';
              return inv;
            },
            pay: async (id: string): Promise<Invoice> => {
              const inv = invoices.find((i) => i.id === id)!;
              inv.status = 'paid';
              inv.paidAt = '2026-06-25';
              return inv;
            },
            updatePaymentDate: async (id: string, paidAt: string): Promise<Invoice> => {
              const inv = invoices.find((i) => i.id === id)!;
              inv.paidAt = paidAt;
              return inv;
            },
            cancel: async (id: string): Promise<Invoice> => {
              const inv = invoices.find((i) => i.id === id)!;
              inv.status = 'cancelled';
              return inv;
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
    expect(store.items()[0].invoiceNumber).toBe('FAC-20260101-0001');
  });

  it('createInvoice adds a new draft and reloads', async () => {
    await store.load();
    await store.createInvoice({
      customerId: 'cust-2', discountPercent: 0, notes: '', lines: [],
    });
    expect(store.items().some((i) => i.id === 'new-id')).toBe(true);
  });

  it('issue transitions draft to issued', async () => {
    await store.load();
    await store.issue('1');
    const inv = invoices.find((i) => i.id === '1');
    expect(inv?.status).toBe('issued');
    expect(inv?.invoiceNumber).toBe('FAC-20260101-0002');
  });

  it('clears loading when a mutation is rejected', async () => {
    await store.load();
    failIssue = true;
    await expect(store.issue('1')).rejects.toThrow();
    expect(store.loading()).toBe(false);
    expect(store.items().length).toBe(4);
  });

  it('pay transitions issued to paid', async () => {
    await store.load();
    await store.pay('2');
    expect(invoices.find((i) => i.id === '2')?.status).toBe('paid');
    expect(invoices.find((i) => i.id === '2')?.paidAt).toBe('2026-06-25');
  });

  it('updates the payment date of a paid invoice', async () => {
    await store.load();
    await store.setPaymentDate('3', '2025-06-15');
    expect(invoices.find((i) => i.id === '3')?.paidAt).toBe('2025-06-15');
  });

  it('cancel transitions invoice to cancelled', async () => {
    await store.load();
    await store.cancel('1');
    expect(invoices.find((i) => i.id === '1')?.status).toBe('cancelled');
  });

  it('downloads the PDF in the UI language', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pdf');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    TestBed.inject(I18nService).locale.set('fr');
    await store.downloadPdf('2');
    expect(pdfLocale).toBe('fr');
  });

  it('setPage updates the page signal', () => {
    store.setPage(2);
    expect(store.page()).toBe(2);
  });
});
