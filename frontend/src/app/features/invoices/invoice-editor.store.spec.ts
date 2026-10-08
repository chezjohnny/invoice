import { provideZonelessChangeDetection } from '@angular/core';
import { Observable, firstValueFrom, of, throwError } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { ARTICLE_SERVICE } from '../../core/tokens/article-service.token';
import { CUSTOMER_SERVICE } from '../../core/tokens/customer-service.token';
import { INVOICE_SERVICE } from '../../core/tokens/invoice-service.token';
import { Customer } from '../customers/customer.model';
import { Invoice, InvoiceCreate } from './invoice.model';
import { InvoiceEditorStore } from './invoice-editor.store';

const CUSTOMER: Customer = {
  id: 'cust-1', firstName: 'Alice', lastName: 'Martin', addressLine1: 'Rue 1', addressLine2: null,
  postalCode: '1110', city: 'Morges', country: 'CH', email: null, phones: [], isArchived: false,
};

const DRAFT: Invoice = {
  id: 'inv-1', customerId: 'cust-1', customerName: 'Martin, Alice',
  invoiceNumber: null, status: 'draft', issueDate: null, dueDate: null, paidAt: null,
  discountPercent: 0, notes: '', paymentMethod: 'twint', reminders: [], lines: [],
};

const DATA: InvoiceCreate = {
  customerId: 'cust-1', discountPercent: 0, notes: '', paymentMethod: 'cash', lines: [],
};

describe('InvoiceEditorStore', () => {
  let store: InstanceType<typeof InvoiceEditorStore>;
  let invoices: Invoice[];
  let created: number;
  let failIssue: boolean;

  beforeEach(() => {
    invoices = [structuredClone(DRAFT)];
    created = 0;
    failIssue = false;
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:pdf');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    const find = (id: string) => invoices.find((i) => i.id === id)!;
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        InvoiceEditorStore,
        { provide: CUSTOMER_SERVICE, useValue: { getById: () => of(CUSTOMER) } },
        { provide: ARTICLE_SERVICE, useValue: { getAll: () => of([]) } },
        {
          provide: INVOICE_SERVICE,
          useValue: {
            getById: (id: string) => of(find(id)),
            create: (data: InvoiceCreate): Observable<Invoice> => {
              const inv: Invoice = { ...DRAFT, ...data, id: `new-${++created}`, lines: [] };
              invoices.push(inv);
              return of(inv);
            },
            update: (id: string, data: InvoiceCreate): Observable<Invoice> =>
              of(Object.assign(find(id), { notes: data.notes, paymentMethod: data.paymentMethod })),
            issue: (id: string): Observable<Invoice> => {
              if (failIssue) return throwError(() => new Error('incomplete company profile'));
              return of(Object.assign(find(id), { status: 'issued', invoiceNumber: '2610051' }));
            },
            pay: (id: string): Observable<Invoice> =>
              of(Object.assign(find(id), { status: 'paid', paidAt: '2026-10-05' })),
            downloadPdf: () => of(new Blob(['%PDF'])),
          },
        },
      ],
    });
    store = TestBed.inject(InvoiceEditorStore);
  });

  it('loads a draft with its customer', async () => {
    store.load({ invoiceId: 'inv-1' });
    expect(store.invoice()?.id).toBe('inv-1');
    expect(store.customer()?.id).toBe('cust-1');
    expect(store.loading()).toBe(false);
  });

  it('creates the draft once, then updates it', async () => {
    store.load({ customerId: 'cust-1' });
    expect(store.invoice()).toBeNull();
    await firstValueFrom(store.saveDraft(DATA));
    await firstValueFrom(store.saveDraft({ ...DATA, notes: 'Livraison' }));
    expect(created).toBe(1);
    expect(store.invoice()?.notes).toBe('Livraison');
  });

  it('marks a cash invoice paid before printing it', async () => {
    store.load({ invoiceId: 'inv-1' });
    await firstValueFrom(store.issueAndPrint(DATA));
    expect(store.invoice()?.status).toBe('paid');
    expect(store.invoice()?.paidAt).toBe('2026-10-05');
  });

  it('leaves a non-cash invoice issued', async () => {
    store.load({ invoiceId: 'inv-1' });
    await firstValueFrom(store.issueAndPrint({ ...DATA, paymentMethod: 'twint' }));
    expect(store.invoice()?.status).toBe('issued');
  });

  it('does not create a second draft when a failed issue is retried', async () => {
    store.load({ customerId: 'cust-1' });
    failIssue = true;
    await expect(firstValueFrom(store.issueAndPrint(DATA))).rejects.toThrow();
    failIssue = false;
    await firstValueFrom(store.issueAndPrint(DATA));
    expect(created).toBe(1);
  });
});
