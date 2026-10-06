import { InvoiceLine, invoiceTotal, isOverdue } from './invoice.model';

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
