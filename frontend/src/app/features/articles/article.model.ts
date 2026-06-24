export interface Article {
  id: string;
  name: string;
  description: string;
  unitPrice: number;
  vatRateOverride: number | null;
  stockQuantity: number;
  isArchived: boolean;
}
