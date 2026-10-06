import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Page } from '../../core/models/page.model';
import {
  STOCK_WITHDRAWAL_SERVICE, StockWithdrawalListParams,
} from '../../core/tokens/stock-withdrawal-service.token';
import { StockWithdrawal } from './stock-withdrawal.model';
import { StockWithdrawalStore } from './stock-withdrawal.store';

const WITHDRAWALS: StockWithdrawal[] = [
  { id: '1', articleId: 'a1', articleName: 'Pinot Noir', date: '2026-09-12', quantity: 6, reason: 'tasting', note: '' },
  { id: '2', articleId: 'a2', articleName: 'Chasselas', date: '2026-09-20', quantity: 1, reason: 'loss', note: 'Cassée' },
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
            list: async (params: StockWithdrawalListParams): Promise<Page<StockWithdrawal>> => {
              lastParams = params;
              const items = withdrawals.filter((w) => !params.reason || w.reason === params.reason);
              return { items, total: items.length, page: params.page ?? 1, perPage: 20, pages: 1 };
            },
            delete: async (id: string): Promise<void> => {
              if (failDelete) throw new Error('not found');
              withdrawals = withdrawals.filter((w) => w.id !== id);
            },
          },
        },
      ],
    });
    store = TestBed.inject(StockWithdrawalStore);
  });

  it('loads withdrawals on init', async () => {
    await store.load();
    expect(store.items().length).toBe(2);
    expect(store.total()).toBe(2);
  });

  it('filters by reason from the first page', async () => {
    await store.setPage(2);
    await store.setReasonFilter('loss');
    expect(lastParams.reason).toBe('loss');
    expect(lastParams.page).toBe(1);
    expect(store.items().map((w) => w.id)).toEqual(['2']);
    await store.setReasonFilter(null);
    expect(store.items().length).toBe(2);
  });

  it('deletes a withdrawal and reloads', async () => {
    await store.delete('1');
    expect(store.items().map((w) => w.id)).toEqual(['2']);
  });

  it('clears loading when a mutation is rejected', async () => {
    await store.load();
    failDelete = true;
    await expect(store.delete('1')).rejects.toThrow();
    expect(store.loading()).toBe(false);
  });
});
