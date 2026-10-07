import { Injectable } from '@angular/core';
import { ArticleListParams, IArticleService } from '../../core/tokens/article-service.token';
import { Page } from '../../core/models/page.model';
import { sortItems } from '../../shared/sort';
import { Article, ArticleListItem, ArticleData } from './article.model';

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

// Quantity sold per article id, year and quarter (Q1–Q4).
const MOCK_SALES: Record<string, Record<number, number[]>> = {
  '1': { 2026: [3, 5, 0, 0], 2025: [2, 4, 3, 5] },
  '2': { 2026: [10, 14, 12, 0], 2025: [8, 12, 10, 22] },
  '3': { 2026: [0, 12, 0, 0] },
  '5': { 2025: [15, 15, 10, 20] },
};

// Quantity withdrawn per article id, the same for every period (matches MockStockWithdrawalService).
const MOCK_WITHDRAWN: Record<string, number> = { '1': 2, '2': 6, '3': 1 };

const sum = (values: number[]) => values.reduce((total, n) => total + n, 0);

@Injectable()
export class MockArticleService implements IArticleService {
  private articles = structuredClone(MOCK_ARTICLES);

  list(params: ArticleListParams): Promise<Page<ArticleListItem>> {
    const search = (params.search ?? '').toLowerCase();
    const page = params.page ?? 1;
    const perPage = params.perPage ?? 20;
    const filtered = this.articles.filter(
      (a) => a.isArchived === (params.archived ?? false) && (!search || a.name.toLowerCase().includes(search))
    ).reverse().map((a) => {
      const sales = MOCK_SALES[a.id] ?? {};
      const year = params.salesYear != null ? sales[params.salesYear] ?? [] : null;
      const soldQuantity = year === null
        ? sum(Object.values(sales).flat())
        : params.salesQuarter != null ? year[params.salesQuarter - 1] ?? 0 : sum(year);
      return { ...a, soldQuantity, withdrawnQuantity: MOCK_WITHDRAWN[a.id] ?? 0 };
    });
    const sorted = sortItems(filtered, params.sort, {
      name: (a) => a.name.toLowerCase(),
      description: (a) => a.description.toLowerCase(),
      unit_price: (a) => a.unitPrice,
      vat_rate_override: (a) => a.vatRateOverride,
      stock_quantity: (a) => a.stockQuantity,
      sold_quantity: (a) => a.soldQuantity,
      withdrawn_quantity: (a) => a.withdrawnQuantity,
    });
    const total = sorted.length;
    const items = sorted.slice((page - 1) * perPage, page * perPage);
    const pages = Math.max(1, Math.ceil(total / perPage));
    return Promise.resolve({ items, total, page, perPage, pages });
  }

  exportCsv(archived: boolean): Promise<Blob> {
    const lines = ['name,description,unit_price,vat_rate,stock_quantity,sold_quantity,withdrawn_quantity'];
    for (const a of this.articles.filter((a) => a.isArchived === archived)) {
      lines.push(`${a.name},${a.description},${a.unitPrice},${a.vatRateOverride ?? ''},${a.stockQuantity},0,0`);
    }
    return Promise.resolve(new Blob([lines.join('\n')], { type: 'text/csv' }));
  }

  salesYears(): Promise<number[]> {
    return Promise.resolve([2026, 2025]);
  }

  getAll(archived = false): Promise<Article[]> {
    return Promise.resolve(this.articles.filter((a) => a.isArchived === archived).reverse());
  }

  getById(id: string): Promise<Article> {
    return Promise.resolve({ ...this.articles.find((a) => a.id === id)! });
  }

  create(data: ArticleData): Promise<Article> {
    const article: Article = { ...data, id: crypto.randomUUID(), isArchived: false };
    this.articles.push(article);
    return Promise.resolve({ ...article });
  }

  update(id: string, data: ArticleData): Promise<Article> {
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
