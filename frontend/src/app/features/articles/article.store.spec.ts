import { provideZonelessChangeDetection } from '@angular/core';
import { Subject, of, throwError } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { ARTICLE_SERVICE, SalesPeriod } from '../../core/tokens/article-service.token';
import { Page } from '../../core/models/page.model';
import { Sort } from '../../shared/sort';
import { Article, ArticleListItem, ArticleData } from './article.model';
import { ArticleStore } from './article.store';

const ARTICLES: Article[] = [
  { id: '1', name: 'Pinot Noir', description: '', unitPrice: 20, vatRateOverride: null, stockQuantity: 10, isArchived: false },
  { id: '2', name: 'Chardonnay', description: '', unitPrice: 30, vatRateOverride: null, stockQuantity: 5, isArchived: false },
];

function makePage(items: Article[], soldQuantity = 0, page = 1): Page<ArticleListItem> {
  return {
    items: items.map((a) => ({ ...a, soldQuantity, withdrawnQuantity: 0 })),
    total: items.length, page, perPage: 20, pages: Math.max(page, 1),
  };
}

describe('ArticleStore', () => {
  let store: InstanceType<typeof ArticleStore>;
  let articles: Article[];
  let lastSort: Sort | null | undefined;
  let exportedPeriod: SalesPeriod | undefined;
  let exportedArchived: boolean | undefined;
  let failArchive: boolean;

  beforeEach(() => {
    articles = structuredClone(ARTICLES);
    failArchive = false;
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        ArticleStore,
        {
          provide: ARTICLE_SERVICE,
          useValue: {
            list: (params: {
              archived?: boolean; salesYear?: number | null; salesQuarter?: number | null; sort?: Sort | null;
              page?: number;
            }) => {
              lastSort = params.sort;
              const sold = params.salesYear !== 2025 ? 9 : params.salesQuarter === 2 ? 1 : 4;
              return of(makePage(articles.filter((a) => a.isArchived === (params.archived ?? false)), sold, params.page));
            },
            salesYears: () => of([2026, 2025]),
            getAll: () => of([...articles]),
            update: (id: string, data: ArticleData) => {
              const idx = articles.findIndex((a) => a.id === id);
              articles[idx] = { ...articles[idx], ...data };
              return of(articles[idx]);
            },
            exportCsv: (archived: boolean, period: SalesPeriod) => {
              exportedArchived = archived;
              exportedPeriod = period;
              return of(new Blob(['name'], { type: 'text/csv' }));
            },
            archive: (id: string) => {
              if (failArchive) return throwError(() => new Error('server error'));
              const a = articles.find((a) => a.id === id);
              if (a) a.isArchived = true;
              return of(undefined);
            },
            restore: (id: string) => {
              const a = articles.find((a) => a.id === id);
              if (a) a.isArchived = false;
              return of(undefined);
            },
          },
        },
      ],
    });
    store = TestBed.inject(ArticleStore);
  });

  it('toggleSort sends the sort to the API and returns to the first page', () => {
    store.setPage(3);
    store.toggleSort('sold_quantity');
    expect(lastSort).toEqual({ key: 'sold_quantity', order: 'asc' });
    expect(store.page()).toBe(1);
    store.toggleSort('sold_quantity');
    expect(lastSort).toEqual({ key: 'sold_quantity', order: 'desc' });
    store.toggleSort('sold_quantity');
    expect(lastSort).toBeNull();
  });

  it('loads the sales years and filters the sold quantity by year', () => {
    store.loadSalesYears();
    expect(store.salesYears()).toEqual([2026, 2025]);
    store.load();
    expect(store.items()[0].soldQuantity).toBe(9);
    store.setSalesYear(2025);
    expect(store.items()[0].soldQuantity).toBe(4);
    store.setSalesYear(null);
    expect(store.items()[0].soldQuantity).toBe(9);
  });

  it('filters the sold quantity by quarter and clears it with the year', () => {
    store.setSalesYear(2025);
    store.setSalesQuarter(2);
    expect(store.items()[0].soldQuantity).toBe(1);
    store.setSalesYear(null);
    expect(store.salesQuarter()).toBeNull();
    expect(store.items()[0].soldQuantity).toBe(9);
  });

  it('loads articles on init', () => {
    store.load();
    expect(store.items().length).toBe(2);
    expect(store.total()).toBe(2);
  });

  it('setSearch resets page to 1', () => {
    store.load();
    store.setSearch('pinot');
    expect(store.page()).toBe(1);
    expect(store.search()).toBe('pinot');
  });

  it('counts the stock in place, keeping the other fields', () => {
    store.load();
    store.setInventoryMode(true);
    store.countStock({ article: store.items().find((a) => a.id === '1')!, quantity: 7 });
    expect(store.items().find((a) => a.id === '1')!.stockQuantity).toBe(7);
    expect(articles.find((a) => a.id === '1')!.name).toBe('Pinot Noir');
    expect(store.inventoryMode()).toBe(true);
    expect(store.counted()).toEqual(['1']);
  });

  it('leaves the inventory when showing the archived articles', () => {
    store.setInventoryMode(true);
    store.setArchived(true);
    expect(store.inventoryMode()).toBe(false);
  });

  it('exports what is listed over the selected period, named after it', () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:csv');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    let filename = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      filename = this.download;
    });
    store.setSalesYear(2025);
    store.setSalesQuarter(2);
    store.exportCsv();
    expect(exportedArchived).toBe(false);
    expect(exportedPeriod).toEqual({ salesYear: 2025, salesQuarter: 2 });
    expect(filename).toBe('articles-2025-Q2.csv');
    store.setArchived(true);
    store.exportCsv();
    expect(exportedArchived).toBe(true);
    expect(filename).toBe('articles-archived-2025-Q2.csv');
  });

  it('leaves the list usable when archiving fails', () => {
    store.load();
    failArchive = true;
    store.archive('1');
    expect(store.loading()).toBe(false);
    expect(store.items().length).toBe(2);
  });

  it('archive removes article from list', () => {
    store.load();
    store.archive('1');
    expect(store.items().find((a) => a.id === '1')).toBeUndefined();
  });

  it('shows archived articles and restores them to the active list', () => {
    store.load();
    store.archive('1');
    store.setPage(2);

    store.setArchived(true);
    expect(store.page()).toBe(1);
    expect(store.items().map((a) => a.id)).toEqual(['1']);

    store.restore('1');
    expect(store.items()).toEqual([]);

    store.setArchived(false);
    expect(store.items().some((a) => a.id === '1')).toBe(true);
  });

  it('setPage updates the page signal', () => {
    store.setPage(2);
    expect(store.page()).toBe(2);
  });
});

describe('ArticleStore searching', () => {
  it('drops the answer of a search typed over: a slow "pin" never replaces "pinot"', () => {
    const answers = new Map<string, Subject<Page<ArticleListItem>>>();
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        ArticleStore,
        {
          provide: ARTICLE_SERVICE,
          useValue: {
            list: (params: { search?: string }) => {
              const answer = new Subject<Page<ArticleListItem>>();
              answers.set(params.search ?? '', answer);
              return answer;
            },
            salesYears: () => of([]),
          },
        },
      ],
    });
    const store = TestBed.inject(ArticleStore);
    const reply = (search: string, name: string) => {
      answers.get(search)!.next(makePage([{ ...ARTICLES[0], name }]));
      answers.get(search)!.complete();
    };

    store.setSearch('pin');
    store.setSearch('pinot');
    reply('pinot', 'Pinot Noir');
    reply('pin', 'Pinte de bière');

    expect(store.items().map((a) => a.name)).toEqual(['Pinot Noir']);
    expect(store.loading()).toBe(false);
  });
});
