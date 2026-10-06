export const STOCK_WITHDRAWAL_REASONS = ['tasting', 'promotion', 'loss', 'other'] as const;
export type StockWithdrawalReason = (typeof STOCK_WITHDRAWAL_REASONS)[number];

/** Articles leaving the stock without being invoiced (tasting, gift, breakage…). */
export interface StockWithdrawal {
  id: string;
  articleId: string;
  articleName: string;
  /** ISO date (YYYY-MM-DD). */
  date: string;
  quantity: number;
  reason: StockWithdrawalReason;
  note: string;
}

export type StockWithdrawalCreate = Omit<StockWithdrawal, 'id' | 'articleName'>;
