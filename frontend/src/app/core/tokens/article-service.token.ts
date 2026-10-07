import { InjectionToken } from '@angular/core';
import type { Article, ArticleListItem, ArticleData } from '../../features/articles/article.model';
import type { Page } from '../models/page.model';
import type { Sort } from '../../shared/sort';

export interface ArticleListParams {
  search?: string;
  archived?: boolean;
  salesYear?: number | null;
  /** 1–4, only with `salesYear`. */
  salesQuarter?: number | null;
  sort?: Sort | null;
  page?: number;
  perPage?: number;
}

export interface SalesPeriod {
  salesYear: number | null;
  /** 1–4, only with `salesYear`. */
  salesQuarter: number | null;
}

export interface IArticleService {
  list(params: ArticleListParams): Promise<Page<ArticleListItem>>;
  salesYears(): Promise<number[]>;
  /** The active (or archived) articles, with their sales and withdrawals over the period. */
  exportCsv(archived: boolean, period: SalesPeriod): Promise<Blob>;
  /** Every active article, or with `archived` every archived one. */
  getAll(archived?: boolean): Promise<Article[]>;
  getById(id: string): Promise<Article>;
  create(data: ArticleData): Promise<Article>;
  update(id: string, data: ArticleData): Promise<Article>;
  archive(id: string): Promise<void>;
  restore(id: string): Promise<void>;
}

export const ARTICLE_SERVICE = new InjectionToken<IArticleService>('ArticleService');
