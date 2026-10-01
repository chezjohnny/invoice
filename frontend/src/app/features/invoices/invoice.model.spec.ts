import { InvoiceLine, invoiceTotal } from './invoice.model';

function line(quantity: number, unitPriceSnapshot: number, vatRateSnapshot: number | null): InvoiceLine {
  return {
    id: 'l', invoiceId: 'i', articleId: null, descriptionSnapshot: '',
    quantity, unitPriceSnapshot, vatRateSnapshot,
  };
}

describe('invoiceTotal', () => {
  it('adds each line VAT after the discount', () => {
    const lines = [line(2, 50, 0.081), line(1, 100, null)];
    // (100 * 1.081 + 100) * 0.9
    expect(invoiceTotal({ lines, discountPercent: 10 })).toBeCloseTo(187.29, 2);
  });

  it('is zero without lines', () => {
    expect(invoiceTotal({ lines: [], discountPercent: 0 })).toBe(0);
  });
});
