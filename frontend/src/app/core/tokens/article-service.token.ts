import { InjectionToken } from '@angular/core';
import type { Article } from '../../features/articles/article.model';

export interface IArticleService {
  getAll(): Promise<Article[]>;
  create(data: Omit<Article, 'id' | 'isArchived'>): Promise<Article>;
  update(id: string, data: Omit<Article, 'id' | 'isArchived'>): Promise<Article>;
  archive(id: string): Promise<void>;
}

export const ARTICLE_SERVICE = new InjectionToken<IArticleService>('ArticleService');
