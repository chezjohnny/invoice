import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  IStockWithdrawalService, StockWithdrawalListParams,
} from '../../core/tokens/stock-withdrawal-service.token';
import { Page, PageDto, toPage } from '../../core/models/page.model';
import { withSort } from '../../shared/sort';
import { StockWithdrawal, StockWithdrawalCreate, StockWithdrawalReason } from './stock-withdrawal.model';

interface StockWithdrawalDto {
  id: string;
  article_id: string;
  article_name: string;
  date: string;
  quantity: number;
  reason: StockWithdrawalReason;
  note: string;
  invoice_id: string | null;
  invoice_number: string | null;
}


@Injectable()
export class HttpStockWithdrawalService implements IStockWithdrawalService {
  private readonly http = inject(HttpClient);

  list(params: StockWithdrawalListParams): Promise<Page<StockWithdrawal>> {
    let httpParams = new HttpParams()
      .set('search', params.search ?? '')
      .set('page', String(params.page ?? 1))
      .set('per_page', String(params.perPage ?? 20));
    if (params.reason) httpParams = httpParams.set('reason', params.reason);
    return firstValueFrom(
      this.http.get<PageDto<StockWithdrawalDto>>('/api/stock-withdrawals', {
        params: withSort(httpParams, params.sort),
      })
    ).then((dto) => toPage(dto, this.toStockWithdrawal));
  }

  create(data: StockWithdrawalCreate): Promise<StockWithdrawal> {
    return firstValueFrom(
      this.http.post<StockWithdrawalDto>('/api/stock-withdrawals', {
        article_id: data.articleId,
        date: data.date,
        quantity: data.quantity,
        reason: data.reason,
        note: data.note,
      })
    ).then(this.toStockWithdrawal);
  }

  delete(id: string): Promise<void> {
    return firstValueFrom(this.http.delete<void>(`/api/stock-withdrawals/${id}`));
  }

  private toStockWithdrawal(dto: StockWithdrawalDto): StockWithdrawal {
    return {
      id: dto.id,
      articleId: dto.article_id,
      articleName: dto.article_name,
      date: dto.date,
      quantity: dto.quantity,
      reason: dto.reason,
      note: dto.note,
      invoiceId: dto.invoice_id,
      invoiceNumber: dto.invoice_number,
    };
  }
}
