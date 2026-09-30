import { Injectable } from '@angular/core';
import { ArticleListParams, IArticleService } from '../../core/tokens/article-service.token';
import { Page } from '../../core/models/page.model';
import { Article, ArticleListItem } from './article.model';

const MOCK_ARTICLES: Article[] = [
  {
    id: '1', name: 'Château Margaux 2018', description: 'Grand cru classé, Médoc',
    unitPrice: 150, vatRateOverride: null, stockQuantity: 12, isArchived: false,
  },
  {
    id: '2', name: 'Pinot Noir Vaudois 2021', description: 'AOC Vaud',
    unitPrice: 28, vatRateOverride: null, stockQuantity: 48, isArchived: false,
  },
  {
    id: '3', name: 'Champagne Brut Nature', description: 'Sans dosage, 0 g/l',
    unitPrice: 45, vatRateOverride: 0.077, stockQuantity: 24, isArchived: false,
  },
  {
    id: '4', name: 'Caisse bois personnalisée', description: 'Gravure incluse',
    unitPrice: 35, vatRateOverride: 0.081, stockQuantity: 10, isArchived: false,
  },
  {
    id: '5', name: 'Chasselas 2019', description: 'Millésime épuisé',
    unitPrice: 18, vatRateOverride: null, stockQuantity: 0, isArchived: true,
  },
];

// Quantity sold per article id and year.
const MOCK_SALES: Record<string, Record<number, number>> = {
  '1': { 2026: 8, 2025: 14 },
  '2': { 2026: 36, 2025: 52 },
  '3': { 2026: 12 },
  '5': { 2025: 60 },
};

@Injectable()
export class MockArticleService implements IArticleService {
  private articles = structuredClone(MOCK_ARTICLES);

  list(params: ArticleListParams): Promise<Page<ArticleListItem>> {
    const search = (params.search ?? '').toLowerCase();
    const page = params.page ?? 1;
    const perPage = params.perPage ?? 20;
    const filtered = this.articles.filter(
      (a) => a.isArchived === (params.archived ?? false) && (!search || a.name.toLowerCase().includes(search))
    ).reverse();
    const total = filtered.length;
    const items = filtered.slice((page - 1) * perPage, page * perPage).map((a) => {
      const sales = MOCK_SALES[a.id] ?? {};
      const soldQuantity = params.salesYear != null
        ? sales[params.salesYear] ?? 0
        : Object.values(sales).reduce((sum, n) => sum + n, 0);
      return { ...a, soldQuantity };
    });
    const pages = Math.max(1, Math.ceil(total / perPage));
    return Promise.resolve({ items, total, page, perPage, pages });
  }

  salesYears(): Promise<number[]> {
    return Promise.resolve([2026, 2025]);
  }

  getAll(): Promise<Article[]> {
    return Promise.resolve(this.articles.filter((a) => !a.isArchived).reverse());
  }

  create(data: Omit<Article, 'id' | 'isArchived'>): Promise<Article> {
    const article: Article = { ...data, id: crypto.randomUUID(), isArchived: false };
    this.articles.push(article);
    return Promise.resolve({ ...article });
  }

  update(id: string, data: Omit<Article, 'id' | 'isArchived'>): Promise<Article> {
    const index = this.articles.findIndex((a) => a.id === id);
    if (index === -1) return Promise.reject(new Error(`Article ${id} not found`));
    this.articles[index] = { ...this.articles[index], ...data };
    return Promise.resolve({ ...this.articles[index] });
  }

  archive(id: string): Promise<void> {
    const article = this.articles.find((a) => a.id === id);
    if (article) article.isArchived = true;
    return Promise.resolve();
  }

  restore(id: string): Promise<void> {
    const article = this.articles.find((a) => a.id === id);
    if (article) article.isArchived = false;
    return Promise.resolve();
  }
}
