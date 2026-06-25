import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ARTICLE_SERVICE } from '../../core/tokens/article-service.token';
import { Page } from '../../core/models/page.model';
import { Article } from './article.model';
import { ArticleStore } from './article.store';

const ARTICLES: Article[] = [
  { id: '1', name: 'Pinot Noir', description: '', unitPrice: 20, vatRateOverride: null, stockQuantity: 10, isArchived: false },
  { id: '2', name: 'Chardonnay', description: '', unitPrice: 30, vatRateOverride: null, stockQuantity: 5, isArchived: false },
];

function makePage(items: Article[]): Page<Article> {
  return { items, total: items.length, page: 1, perPage: 20, pages: 1 };
}

describe('ArticleStore', () => {
  let store: InstanceType<typeof ArticleStore>;
  let articles: Article[];

  beforeEach(() => {
    articles = structuredClone(ARTICLES);
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        ArticleStore,
        {
          provide: ARTICLE_SERVICE,
          useValue: {
            list: async () => makePage(articles.filter((a) => !a.isArchived)),
            getAll: async () => [...articles],
            create: async (data: Omit<Article, 'id' | 'isArchived'>) => {
              const a = { ...data, id: 'new-id', isArchived: false };
              articles.push(a);
              return a;
            },
            update: async (id: string, data: Omit<Article, 'id' | 'isArchived'>) => {
              const idx = articles.findIndex((a) => a.id === id);
              articles[idx] = { ...articles[idx], ...data };
              return articles[idx];
            },
            archive: async (id: string) => {
              const a = articles.find((a) => a.id === id);
              if (a) a.isArchived = true;
            },
          },
        },
      ],
    });
    store = TestBed.inject(ArticleStore);
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

  it('createArticle reloads the list', async () => {
    await store.load();
    await store.createArticle({ name: 'New Wine', description: '', unitPrice: 25, vatRateOverride: null, stockQuantity: 6 });
    expect(store.items().some((a) => a.id === 'new-id')).toBe(true);
  });

  it('updateArticle reflects changes after reload', async () => {
    await store.load();
    await store.updateArticle('1', { name: 'Updated Pinot', description: '', unitPrice: 22, vatRateOverride: null, stockQuantity: 10 });
    expect(store.items().find((a) => a.id === '1')?.name).toBe('Updated Pinot');
  });

  it('archive removes article from list', async () => {
    await store.load();
    await store.archive('1');
    expect(store.items().find((a) => a.id === '1')).toBeUndefined();
  });

  it('setPage updates the page signal', () => {
    store.setPage(2);
    expect(store.page()).toBe(2);
  });
});
