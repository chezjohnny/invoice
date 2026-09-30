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
}
