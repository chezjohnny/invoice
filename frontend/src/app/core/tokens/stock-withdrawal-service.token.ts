import { InjectionToken } from '@angular/core';
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
  list(params: StockWithdrawalListParams): Promise<Page<StockWithdrawal>>;
  create(data: StockWithdrawalCreate): Promise<StockWithdrawal>;
  delete(id: string): Promise<void>;
}

export const STOCK_WITHDRAWAL_SERVICE = new InjectionToken<IStockWithdrawalService>('StockWithdrawalService');
