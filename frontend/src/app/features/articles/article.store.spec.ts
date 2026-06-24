import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ARTICLE_SERVICE } from '../../core/tokens/article-service.token';
import { Article } from './article.model';
import { ArticleStore } from './article.store';

const ARTICLES: Article[] = [
  { id: '1', name: 'Pinot Noir', description: '', unitPrice: 20, vatRateOverride: null, stockQuantity: 10, isArchived: false },
  { id: '2', name: 'Chardonnay', description: '', unitPrice: 30, vatRateOverride: null, stockQuantity: 5, isArchived: false },
  { id: '3', name: 'Old Vintage', description: '', unitPrice: 80, vatRateOverride: null, stockQuantity: 2, isArchived: true },
];

describe('ArticleStore', () => {
  let store: InstanceType<typeof ArticleStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        ArticleStore,
        {
          provide: ARTICLE_SERVICE,
          useValue: {
            getAll: async () => structuredClone(ARTICLES),
            create: async (data: Omit<Article, 'id' | 'isArchived'>) => ({
              ...data, id: 'new-id', isArchived: false,
            }),
            update: async (id: string, data: Omit<Article, 'id' | 'isArchived'>) => ({
              ...data, id, isArchived: false,
            }),
            archive: async () => {},
          },
        },
      ],
    });
    store = TestBed.inject(ArticleStore);
  });

  it('loads all articles', async () => {
    await store.load();
    expect(store.entities().length).toBe(3);
  });

  it('filteredArticles excludes archived', async () => {
    await store.load();
    expect(store.filteredArticles().length).toBe(2);
  });

  it('filters by name case-insensitively', async () => {
    await store.load();
    store.setFilter('pinot');
    expect(store.filteredArticles().length).toBe(1);
    expect(store.filteredArticles()[0].name).toBe('Pinot Noir');
  });

  it('archive removes article from filtered list', async () => {
    await store.load();
    await store.archive('1');
    expect(store.filteredArticles().find((a) => a.id === '1')).toBeUndefined();
    expect(store.entities().find((a) => a.id === '1')?.isArchived).toBe(true);
  });

  it('createArticle adds a new entity', async () => {
    await store.load();
    await store.createArticle({ name: 'New Wine', description: '', unitPrice: 25, vatRateOverride: null, stockQuantity: 6 });
    expect(store.filteredArticles().some((a) => a.name === 'New Wine')).toBe(true);
  });

  it('updateArticle updates an existing entity', async () => {
    await store.load();
    await store.updateArticle('1', { name: 'Updated Pinot', description: '', unitPrice: 22, vatRateOverride: null, stockQuantity: 10 });
    expect(store.entities().find((a) => a.id === '1')?.name).toBe('Updated Pinot');
  });
});
