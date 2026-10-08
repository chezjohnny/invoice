import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { STOCK_WITHDRAWAL_SERVICE } from '../../core/tokens/stock-withdrawal-service.token';
import { StockWithdrawal } from './stock-withdrawal.model';
import { StockWithdrawalsComponent } from './stock-withdrawals.component';

const WITHDRAWALS: StockWithdrawal[] = [
  {
    id: '1', articleId: 'a1', articleName: 'Pinot Noir', date: '2026-10-02', quantity: 1,
    reason: 'promotion', note: '', invoiceId: 'i1', invoiceNumber: '2610021',
  },
  {
    id: '2', articleId: 'a2', articleName: 'Chasselas', date: '2026-09-20', quantity: 1,
    reason: 'loss', note: 'Cassée', invoiceId: null, invoiceNumber: null,
  },
];

describe('StockWithdrawalsComponent', () => {
  it('links a withdrawal offered on an invoice to it, instead of deleting it', async () => {
    TestBed.configureTestingModule({
      imports: [StockWithdrawalsComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        {
          provide: STOCK_WITHDRAWAL_SERVICE,
          useValue: { list: async () => ({ items: WITHDRAWALS, total: 2, page: 1, perPage: 20, pages: 1 }) },
        },
      ],
    });
    const fixture = TestBed.createComponent(StockWithdrawalsComponent);
    await fixture.whenStable();

    const [offered, lost] = [...(fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr')];
    const link = offered.querySelector('a') as HTMLAnchorElement;
    expect(link.textContent?.trim()).toBe('Facture 2610021');
    expect(link.getAttribute('href')).toBe('/invoices?q=2610021');
    expect(offered.querySelector('button')).toBeNull();
    expect(lost.querySelector('a')).toBeNull();
    expect(lost.querySelector('button')).not.toBeNull();
  });
});
