import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { EMPTY, Observable, expand, map, reduce } from 'rxjs';
import { ArticleListParams, IArticleService, SalesPeriod } from '../../core/tokens/article-service.token';
import { Page, PageDto, toPage } from '../../core/models/page.model';
import { withSort } from '../../shared/sort';
import { Article, ArticleListItem, ArticleData } from './article.model';

interface ArticleDto {
  id: string;
  name: string;
  description: string;
  unit_price: string;
  vat_rate_override: string | null;
  stock_quantity: number;
  is_archived: boolean;
}

interface ArticleListItemDto extends ArticleDto {
  sold_quantity: number;
  withdrawn_quantity: number;
}


@Injectable()
export class HttpArticleService implements IArticleService {
  private readonly http = inject(HttpClient);

  list(params: ArticleListParams): Observable<Page<ArticleListItem>> {
    let httpParams = new HttpParams()
      .set('search', params.search ?? '')
      .set('archived', String(params.archived ?? false))
      .set('page', String(params.page ?? 1))
      .set('per_page', String(params.perPage ?? 20));
    if (params.salesYear != null) {
      httpParams = httpParams.set('sales_year', String(params.salesYear));
      if (params.salesQuarter != null) {
        httpParams = httpParams.set('sales_quarter', String(params.salesQuarter));
      }
    }
    return this.http.get<PageDto<ArticleListItemDto>>('/api/articles', {
      params: withSort(httpParams, params.sort),
    }).pipe(map((dto) => toPage(dto, (item) => ({
      ...this.toArticle(item), soldQuantity: item.sold_quantity, withdrawnQuantity: item.withdrawn_quantity,
    }))));
  }

  exportCsv(archived: boolean, period: SalesPeriod): Observable<Blob> {
    let params = new HttpParams().set('archived', String(archived));
    if (period.salesYear != null) {
      params = params.set('sales_year', String(period.salesYear));
      if (period.salesQuarter != null) params = params.set('sales_quarter', String(period.salesQuarter));
    }
    return this.http.get('/api/articles/export.csv', { params, responseType: 'blob' });
  }

  salesYears(): Observable<number[]> {
    return this.http.get<number[]>('/api/articles/sales-years');
  }

  getAll(archived = false): Observable<Article[]> {
    const fetch = (page: number) => this.http.get<PageDto<ArticleDto>>('/api/articles', {
      params: new HttpParams().set('archived', String(archived)).set('per_page', '100').set('page', String(page)),
    });
    // per_page is capped at 100 server-side: walk the pages to get every article.
    return fetch(1).pipe(
      expand((dto) => (dto.page < dto.pages ? fetch(dto.page + 1) : EMPTY)),
      reduce((articles: Article[], dto) => [...articles, ...dto.items.map(this.toArticle)], []),
    );
  }

  getById(id: string): Observable<Article> {
    return this.http.get<ArticleDto>(`/api/articles/${id}`).pipe(map(this.toArticle));
  }

  create(data: ArticleData): Observable<Article> {
    return this.http.post<ArticleDto>('/api/articles', this.toDto(data)).pipe(map(this.toArticle));
  }

  update(id: string, data: ArticleData): Observable<Article> {
    return this.http.put<ArticleDto>(`/api/articles/${id}`, this.toDto(data)).pipe(map(this.toArticle));
  }

  archive(id: string): Observable<void> {
    return this.http.patch<void>(`/api/articles/${id}/archive`, {});
  }

  restore(id: string): Observable<void> {
    return this.http.patch<void>(`/api/articles/${id}/restore`, {});
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

  private toDto(data: ArticleData) {
    return {
      name: data.name,
      description: data.description,
      unit_price: data.unitPrice.toFixed(2),
      vat_rate_override: data.vatRateOverride,
      stock_quantity: data.stockQuantity,
    };
  }
}
