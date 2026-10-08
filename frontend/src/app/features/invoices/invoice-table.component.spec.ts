import { provideZonelessChangeDetection } from '@angular/core';
import { of } from 'rxjs';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { INVOICE_SERVICE } from '../../core/tokens/invoice-service.token';
import { Invoice } from './invoice.model';
import { InvoiceStore } from './invoice.store';
import { InvoiceTableComponent } from './invoice-table.component';

function invoice(id: string): Invoice {
  return {
    id, customerId: 'c1', customerName: 'Dupont, Jean', invoiceNumber: null, status: 'draft',
    issueDate: null, dueDate: null, paidAt: null, discountPercent: 0, notes: '', paymentMethod: null,
    reminders: [], lines: [],
  };
}

describe('InvoiceTableComponent', () => {
  let fixture: ComponentFixture<InvoiceTableComponent>;
  let store: InstanceType<typeof InvoiceStore>;
  let pages: Invoice[][];
  const arrows = () =>
    [...(fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr.cursor-pointer td:first-child')]
      .map((cell) => cell.textContent?.trim());

  beforeEach(async () => {
    pages = [[invoice('1'), invoice('2')], [invoice('3')]];
    TestBed.configureTestingModule({
      imports: [InvoiceTableComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        InvoiceStore,
        {
          provide: INVOICE_SERVICE,
          useValue: {
            list: ({ page = 1 }: { page?: number }) =>
              of({ items: pages[page - 1], total: 3, page, perPage: 2, pages: 2 }),
          },
        },
      ],
    });
    store = TestBed.inject(InvoiceStore);
    fixture = TestBed.createComponent(InvoiceTableComponent);
    fixture.componentRef.setInput('expandFirst', true);
    store.load();
    await fixture.whenStable();
  });

  it('opens the first invoice of each page, and lets it be closed', async () => {
    expect(arrows()).toEqual(['▲', '▼']);

    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('tbody tr.cursor-pointer')!.click();
    await fixture.whenStable();
    expect(arrows()).toEqual(['▼', '▼']);

    store.setPage(2);
    await fixture.whenStable();
    expect(arrows()).toEqual(['▲']);
  });
});
