import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
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
  discountPercent: 0,
  notes: '',
  pdfUrl: null,
  lines: [],
};

const INVOICES: Invoice[] = [
  { ...BASE, id: '1', status: 'draft' },
  { ...BASE, id: '2', status: 'issued', invoiceNumber: 'INV-2026-0001', issueDate: '2026-01-01', dueDate: '2026-01-31' },
  { ...BASE, id: '3', status: 'paid', invoiceNumber: 'INV-2025-0001', issueDate: '2025-06-01', dueDate: '2025-06-30' },
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

  beforeEach(() => {
    invoices = structuredClone(INVOICES);
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
              const inv = { ...BASE, ...data, id: 'new-id', status: 'draft' as const };
              invoices.push(inv);
              return inv;
            },
            update: async (id: string, data: InvoiceUpdate): Promise<Invoice> => {
              const idx = invoices.findIndex((i) => i.id === id);
              invoices[idx] = { ...invoices[idx], ...data };
              return invoices[idx];
            },
            issue: async (id: string): Promise<Invoice> => {
              const inv = invoices.find((i) => i.id === id)!;
              inv.status = 'issued';
              inv.invoiceNumber = 'INV-2026-0002';
              inv.issueDate = '2026-06-25';
              inv.dueDate = '2026-07-25';
              return inv;
            },
            pay: async (id: string): Promise<Invoice> => {
              const inv = invoices.find((i) => i.id === id)!;
              inv.status = 'paid';
              return inv;
            },
            cancel: async (id: string): Promise<Invoice> => {
              const inv = invoices.find((i) => i.id === id)!;
              inv.status = 'cancelled';
              return inv;
            },
            downloadPdf: async () => new Blob(['%PDF'], { type: 'application/pdf' }),
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
    expect(store.items()[0].invoiceNumber).toBe('INV-2026-0001');
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
    expect(inv?.invoiceNumber).toBe('INV-2026-0002');
  });

  it('pay transitions issued to paid', async () => {
    await store.load();
    await store.pay('2');
    expect(invoices.find((i) => i.id === '2')?.status).toBe('paid');
  });

  it('cancel transitions invoice to cancelled', async () => {
    await store.load();
    await store.cancel('1');
    expect(invoices.find((i) => i.id === '1')?.status).toBe('cancelled');
  });

  it('setPage updates the page signal', () => {
    store.setPage(2);
    expect(store.page()).toBe(2);
  });
});
