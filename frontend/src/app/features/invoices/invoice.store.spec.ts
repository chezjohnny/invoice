import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { INVOICE_SERVICE } from '../../core/tokens/invoice-service.token';
import { Invoice, InvoiceCreate, InvoiceUpdate } from './invoice.model';
import { InvoiceStore } from './invoice.store';

const INVOICE_BASE = {
  tenantId: 'tenant-1',
  customerId: 'cust-1',
  invoiceNumber: null,
  issueDate: null,
  dueDate: null,
  currency: 'CHF',
  discountPercent: 0,
  notes: '',
  pdfUrl: null,
  lines: [],
};

const INVOICES: Invoice[] = [
  { ...INVOICE_BASE, id: '1', status: 'draft' },
  { ...INVOICE_BASE, id: '2', status: 'issued', invoiceNumber: 'INV-2026-0001', issueDate: '2026-01-01', dueDate: '2026-01-31' },
  { ...INVOICE_BASE, id: '3', status: 'paid', invoiceNumber: 'INV-2025-0001', issueDate: '2025-06-01', dueDate: '2025-06-30' },
  { ...INVOICE_BASE, id: '4', status: 'cancelled' },
];

describe('InvoiceStore', () => {
  let store: InstanceType<typeof InvoiceStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        InvoiceStore,
        {
          provide: INVOICE_SERVICE,
          useValue: {
            getAll: async () => structuredClone(INVOICES),
            create: async (data: InvoiceCreate): Promise<Invoice> => ({
              ...INVOICE_BASE, ...data, id: 'new-id', status: 'draft',
            }),
            update: async (id: string, data: InvoiceUpdate): Promise<Invoice> => ({
              ...INVOICE_BASE, ...data, id, status: 'draft',
            }),
            issue: async (id: string): Promise<Invoice> => ({
              ...INVOICE_BASE, id, status: 'issued',
              invoiceNumber: 'INV-2026-0002', issueDate: '2026-06-25', dueDate: '2026-07-25',
            }),
            pay: async (id: string): Promise<Invoice> => ({
              ...INVOICE_BASE, id, status: 'paid',
              invoiceNumber: 'INV-2026-0001', issueDate: '2026-01-01', dueDate: '2026-01-31',
            }),
            cancel: async (id: string): Promise<Invoice> => ({
              ...INVOICE_BASE, id, status: 'cancelled',
            }),
            downloadPdf: async () => new Blob(['%PDF'], { type: 'application/pdf' }),
          },
        },
      ],
    });
    store = TestBed.inject(InvoiceStore);
  });

  it('loads all invoices', async () => {
    await store.load();
    expect(store.entities().length).toBe(4);
  });

  it('filteredInvoices returns all by default', async () => {
    await store.load();
    expect(store.filteredInvoices().length).toBe(4);
  });

  it('filteredInvoices filters by status', async () => {
    await store.load();
    store.setStatusFilter('draft');
    expect(store.filteredInvoices().length).toBe(1);
    expect(store.filteredInvoices()[0].status).toBe('draft');
  });

  it('filteredInvoices returns issued invoices', async () => {
    await store.load();
    store.setStatusFilter('issued');
    expect(store.filteredInvoices().length).toBe(1);
    expect(store.filteredInvoices()[0].invoiceNumber).toBe('INV-2026-0001');
  });

  it('createInvoice adds a new draft', async () => {
    await store.load();
    await store.createInvoice({
      customerId: 'cust-2', currency: 'CHF', discountPercent: 0, notes: '', lines: [],
    });
    store.setStatusFilter('all');
    expect(store.filteredInvoices().some((i) => i.id === 'new-id')).toBe(true);
  });

  it('issue transitions draft to issued', async () => {
    await store.load();
    await store.issue('1');
    const inv = store.entities().find((i) => i.id === '1');
    expect(inv?.status).toBe('issued');
    expect(inv?.invoiceNumber).toBe('INV-2026-0002');
  });

  it('pay transitions issued to paid', async () => {
    await store.load();
    await store.pay('2');
    expect(store.entities().find((i) => i.id === '2')?.status).toBe('paid');
  });

  it('cancel transitions invoice to cancelled', async () => {
    await store.load();
    await store.cancel('1');
    expect(store.entities().find((i) => i.id === '1')?.status).toBe('cancelled');
  });

  it('setStatusFilter updates the filter', async () => {
    await store.load();
    store.setStatusFilter('paid');
    expect(store.filteredInvoices().every((i) => i.status === 'paid')).toBe(true);
  });
});
