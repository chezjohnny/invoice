import { InjectionToken } from '@angular/core';
import type { Article, ArticleListItem } from '../../features/articles/article.model';
import type { Page } from '../models/page.model';

export interface ArticleListParams {
  search?: string;
  archived?: boolean;
  salesYear?: number | null;
  page?: number;
  perPage?: number;
}

export interface IArticleService {
  list(params: ArticleListParams): Promise<Page<ArticleListItem>>;
  salesYears(): Promise<number[]>;
  getAll(): Promise<Article[]>;
  create(data: Omit<Article, 'id' | 'isArchived'>): Promise<Article>;
  update(id: string, data: Omit<Article, 'id' | 'isArchived'>): Promise<Article>;
  archive(id: string): Promise<void>;
  restore(id: string): Promise<void>;
}

export const ARTICLE_SERVICE = new InjectionToken<IArticleService>('ArticleService');
