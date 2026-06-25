import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { IArticleService } from '../../core/tokens/article-service.token';
import { Article } from './article.model';

interface ArticleDto {
  id: string;
  tenant_id: string;
  name: string;
  description: string;
  unit_price: string;
  vat_rate_override: string | null;
  stock_quantity: number;
  is_archived: boolean;
}

@Injectable()
export class HttpArticleService implements IArticleService {
  private readonly http = inject(HttpClient);

  getAll(): Promise<Article[]> {
    return firstValueFrom(
      this.http.get<ArticleDto[]>('/api/articles')
    ).then((dtos) => dtos.map(this.toArticle));
  }

  create(data: Omit<Article, 'id' | 'isArchived'>): Promise<Article> {
    return firstValueFrom(
      this.http.post<ArticleDto>('/api/articles', this.toDto(data))
    ).then(this.toArticle);
  }

  update(id: string, data: Omit<Article, 'id' | 'isArchived'>): Promise<Article> {
    return firstValueFrom(
      this.http.put<ArticleDto>(`/api/articles/${id}`, this.toDto(data))
    ).then(this.toArticle);
  }

  archive(id: string): Promise<void> {
    return firstValueFrom(
      this.http.patch<void>(`/api/articles/${id}/archive`, {})
    );
  }

  private toArticle(dto: ArticleDto): Article {
    return {
      id: dto.id,
      name: dto.name,
      description: dto.description,
      unitPrice: parseFloat(dto.unit_price),
      vatRateOverride: dto.vat_rate_override != null ? parseFloat(dto.vat_rate_override) : null,
      stockQuantity: dto.stock_quantity,
      isArchived: dto.is_archived,
    };
  }

  private toDto(data: Omit<Article, 'id' | 'isArchived'>) {
    return {
      name: data.name,
      description: data.description,
      unit_price: data.unitPrice.toFixed(2),
      vat_rate_override: data.vatRateOverride,
      stock_quantity: data.stockQuantity,
    };
  }
}
