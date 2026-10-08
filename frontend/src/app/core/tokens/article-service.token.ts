import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';
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
  list(params: ArticleListParams): Observable<Page<ArticleListItem>>;
  salesYears(): Observable<number[]>;
  /** The active (or archived) articles, with their sales and withdrawals over the period. */
  exportCsv(archived: boolean, period: SalesPeriod): Observable<Blob>;
  /** Every active article, or with `archived` every archived one. */
  getAll(archived?: boolean): Observable<Article[]>;
  getById(id: string): Observable<Article>;
  create(data: ArticleData): Observable<Article>;
  update(id: string, data: ArticleData): Observable<Article>;
  archive(id: string): Observable<void>;
  restore(id: string): Observable<void>;
}

export const ARTICLE_SERVICE = new InjectionToken<IArticleService>('ArticleService');
