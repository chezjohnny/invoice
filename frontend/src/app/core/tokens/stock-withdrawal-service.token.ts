import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';
import type {
  StockWithdrawal, StockWithdrawalCreate, StockWithdrawalReason,
} from '../../features/stock-withdrawals/stock-withdrawal.model';
import type { Page } from '../models/page.model';
import type { Sort } from '../../shared/sort';

export interface StockWithdrawalListParams {
  search?: string;
  /** null = every reason. */
  reason?: StockWithdrawalReason | null;
  sort?: Sort | null;
  page?: number;
  perPage?: number;
}

export interface IStockWithdrawalService {
  list(params: StockWithdrawalListParams): Observable<Page<StockWithdrawal>>;
  create(data: StockWithdrawalCreate): Observable<StockWithdrawal>;
  delete(id: string): Observable<void>;
}

export const STOCK_WITHDRAWAL_SERVICE = new InjectionToken<IStockWithdrawalService>('StockWithdrawalService');
