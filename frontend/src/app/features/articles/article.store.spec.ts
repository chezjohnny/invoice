import { provideZonelessChangeDetection } from '@angular/core';
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

function makePage(items: Article[], soldQuantity = 0): Page<ArticleListItem> {
  return {
    items: items.map((a) => ({ ...a, soldQuantity, withdrawnQuantity: 0 })),
    total: items.length, page: 1, perPage: 20, pages: 1,
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
            list: async (params: {
              archived?: boolean; salesYear?: number | null; salesQuarter?: number | null; sort?: Sort | null;
            }) => {
              lastSort = params.sort;
              const sold = params.salesYear !== 2025 ? 9 : params.salesQuarter === 2 ? 1 : 4;
              return makePage(articles.filter((a) => a.isArchived === (params.archived ?? false)), sold);
            },
            salesYears: async () => [2026, 2025],
            getAll: async () => [...articles],
            update: async (id: string, data: ArticleData) => {
              const idx = articles.findIndex((a) => a.id === id);
              articles[idx] = { ...articles[idx], ...data };
              return articles[idx];
            },
            exportCsv: async (archived: boolean, period: SalesPeriod) => {
              exportedArchived = archived;
              exportedPeriod = period;
              return new Blob(['name'], { type: 'text/csv' });
            },
            archive: async (id: string) => {
              if (failArchive) throw new Error('server error');
              const a = articles.find((a) => a.id === id);
              if (a) a.isArchived = true;
            },
            restore: async (id: string) => {
              const a = articles.find((a) => a.id === id);
              if (a) a.isArchived = false;
            },
          },
        },
      ],
    });
    store = TestBed.inject(ArticleStore);
  });

  it('toggleSort sends the sort to the API and returns to the first page', async () => {
    await store.setPage(3);
    await store.toggleSort('sold_quantity');
    expect(lastSort).toEqual({ key: 'sold_quantity', order: 'asc' });
    expect(store.page()).toBe(1);
    await store.toggleSort('sold_quantity');
    expect(lastSort).toEqual({ key: 'sold_quantity', order: 'desc' });
    await store.toggleSort('sold_quantity');
    expect(lastSort).toBeNull();
  });

  it('loads the sales years and filters the sold quantity by year', async () => {
    await store.loadSalesYears();
    expect(store.salesYears()).toEqual([2026, 2025]);
    await store.load();
    expect(store.items()[0].soldQuantity).toBe(9);
    await store.setSalesYear(2025);
    expect(store.items()[0].soldQuantity).toBe(4);
    await store.setSalesYear(null);
    expect(store.items()[0].soldQuantity).toBe(9);
  });

  it('filters the sold quantity by quarter and clears it with the year', async () => {
    await store.setSalesYear(2025);
    await store.setSalesQuarter(2);
    expect(store.items()[0].soldQuantity).toBe(1);
    await store.setSalesYear(null);
    expect(store.salesQuarter()).toBeNull();
    expect(store.items()[0].soldQuantity).toBe(9);
  });

  it('loads articles on init', async () => {
    await store.load();
    expect(store.items().length).toBe(2);
    expect(store.total()).toBe(2);
  });

  it('setSearch resets page to 1', async () => {
    await store.load();
    store.setSearch('pinot');
    expect(store.page()).toBe(1);
    expect(store.search()).toBe('pinot');
  });

  it('counts the stock in place, keeping the other fields', async () => {
    await store.load();
    store.setInventoryMode(true);
    await store.countStock(store.items().find((a) => a.id === '1')!, 7);
    expect(store.items().find((a) => a.id === '1')!.stockQuantity).toBe(7);
    expect(articles.find((a) => a.id === '1')!.name).toBe('Pinot Noir');
    expect(store.inventoryMode()).toBe(true);
  });

  it('leaves the inventory when showing the archived articles', async () => {
    store.setInventoryMode(true);
    await store.setArchived(true);
    expect(store.inventoryMode()).toBe(false);
  });

  it('exports what is listed over the selected period, named after it', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:csv');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    let filename = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      filename = this.download;
    });
    await store.setSalesYear(2025);
    await store.setSalesQuarter(2);
    await store.exportCsv();
    expect(exportedArchived).toBe(false);
    expect(exportedPeriod).toEqual({ salesYear: 2025, salesQuarter: 2 });
    expect(filename).toBe('articles-2025-Q2.csv');
    await store.setArchived(true);
    await store.exportCsv();
    expect(exportedArchived).toBe(true);
    expect(filename).toBe('articles-archived-2025-Q2.csv');
  });

  it('leaves the list usable when archiving fails', async () => {
    await store.load();
    failArchive = true;
    await expect(store.archive('1')).rejects.toThrow();
    expect(store.loading()).toBe(false);
    expect(store.items().length).toBe(2);
  });

  it('archive removes article from list', async () => {
    await store.load();
    await store.archive('1');
    expect(store.items().find((a) => a.id === '1')).toBeUndefined();
  });

  it('shows archived articles and restores them to the active list', async () => {
    await store.load();
    await store.archive('1');
    await store.setPage(2);

    await store.setArchived(true);
    expect(store.page()).toBe(1);
    expect(store.items().map((a) => a.id)).toEqual(['1']);

    await store.restore('1');
    expect(store.items()).toEqual([]);

    await store.setArchived(false);
    expect(store.items().some((a) => a.id === '1')).toBe(true);
  });

  it('setPage updates the page signal', () => {
    store.setPage(2);
    expect(store.page()).toBe(2);
  });
});
