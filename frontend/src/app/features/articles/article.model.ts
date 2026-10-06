export interface Article {
  id: string;
  name: string;
  description: string;
  unitPrice: number;
  vatRateOverride: number | null;
  stockQuantity: number;
  isArchived: boolean;
}

export interface ArticleListItem extends Article {
  /** Sold on issued and paid invoices, over `salesYear` or all time. */
  soldQuantity: number;
  /** Left the stock unbilled (tasting, gift, loss…), over the same period. */
  withdrawnQuantity: number;
}

/** What a form edits: everything but the id and the archived flag. */
export type ArticleData = Omit<Article, 'id' | 'isArchived'>;
