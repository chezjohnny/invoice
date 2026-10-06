import { InvoiceLine, invoiceAmounts, invoiceTotal, isOverdue } from './invoice.model';

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

// The same cases as the backend's test_amounts_*: both sides must agree to the cent.
describe('invoiceAmounts', () => {
  it('rounds each rate once to the cent, half up', () => {
    // 5.00 + 8.1 % is 5.405: floats would make it 5.40, the PDF and QR-bill say 5.41.
    const amounts = invoiceAmounts({ lines: [line(1, 5, 0.081)], discountPercent: 0 });
    expect(amounts.vat).toEqual([{ rate: 0.081, amount: 0.41 }]);
    expect(amounts.total).toBe(5.41);
  });

  it('takes the VAT on the discounted lines', () => {
    const lines = [line(2, 50, 0.081), line(1, 100, null), line(3, 9.9, 0.026)];
    const amounts = invoiceAmounts({ lines, discountPercent: 10 });
    expect(amounts.subtotal).toBe(229.7);
    expect(amounts.discount).toBe(22.97);
    expect(amounts.vat).toEqual([{ rate: 0.026, amount: 0.69 }, { rate: 0.081, amount: 7.29 }]);
    expect(amounts.total).toBe(214.71);
  });
});

describe('isOverdue', () => {
  const today = new Date(2026, 9, 5);

  it('flags an issued invoice from the day after its due date', () => {
    expect(isOverdue({ status: 'issued', dueDate: '2026-10-04' }, today)).toBe(true);
    expect(isOverdue({ status: 'issued', dueDate: '2026-10-05' }, today)).toBe(false);
  });

  it('ignores invoices that are not awaiting payment', () => {
    expect(isOverdue({ status: 'paid', dueDate: '2026-09-01' }, today)).toBe(false);
    expect(isOverdue({ status: 'cancelled', dueDate: '2026-09-01' }, today)).toBe(false);
    expect(isOverdue({ status: 'draft', dueDate: null }, today)).toBe(false);
  });
});
