import { provideZonelessChangeDetection } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { Page } from '../../core/models/page.model';
import {
  STOCK_WITHDRAWAL_SERVICE, StockWithdrawalListParams,
} from '../../core/tokens/stock-withdrawal-service.token';
import { StockWithdrawal } from './stock-withdrawal.model';
import { StockWithdrawalStore } from './stock-withdrawal.store';

const WITHDRAWALS: StockWithdrawal[] = [
  { id: '1', articleId: 'a1', articleName: 'Pinot Noir', date: '2026-09-12', quantity: 6, reason: 'tasting', note: '', invoiceId: null, invoiceNumber: null },
  { id: '2', articleId: 'a2', articleName: 'Chasselas', date: '2026-09-20', quantity: 1, reason: 'loss', note: 'Cassée', invoiceId: null, invoiceNumber: null },
];

describe('StockWithdrawalStore', () => {
  let store: InstanceType<typeof StockWithdrawalStore>;
  let withdrawals: StockWithdrawal[];
  let lastParams: StockWithdrawalListParams;
  let failDelete: boolean;

  beforeEach(() => {
    withdrawals = structuredClone(WITHDRAWALS);
    failDelete = false;
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        StockWithdrawalStore,
        {
          provide: STOCK_WITHDRAWAL_SERVICE,
          useValue: {
            list: (params: StockWithdrawalListParams): Observable<Page<StockWithdrawal>> => {
              lastParams = params;
              const items = withdrawals.filter((w) => !params.reason || w.reason === params.reason);
              return of({ items, total: items.length, page: params.page ?? 1, perPage: 20, pages: 1 });
            },
            delete: (id: string): Observable<void> => {
              if (failDelete) return throwError(() => new Error('not found'));
              withdrawals = withdrawals.filter((w) => w.id !== id);
              return of(undefined);
            },
          },
        },
      ],
    });
    store = TestBed.inject(StockWithdrawalStore);
  });

  it('loads withdrawals on init', () => {
    store.load();
    expect(store.items().length).toBe(2);
    expect(store.total()).toBe(2);
  });

  it('filters by reason from the first page', () => {
    store.setPage(2);
    store.setReasonFilter('loss');
    expect(lastParams.reason).toBe('loss');
    expect(lastParams.page).toBe(1);
    expect(store.items().map((w) => w.id)).toEqual(['2']);
    store.setReasonFilter(null);
    expect(store.items().length).toBe(2);
  });

  it('deletes a withdrawal and reloads', () => {
    store.delete('1');
    expect(store.items().map((w) => w.id)).toEqual(['2']);
  });

  it('clears loading when a mutation is rejected', () => {
    store.load();
    failDelete = true;
    store.delete('1');
    expect(store.loading()).toBe(false);
  });
});
