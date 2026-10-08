import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CUSTOMER_SERVICE } from '../../core/tokens/customer-service.token';
import { STOCK_WITHDRAWAL_SERVICE } from '../../core/tokens/stock-withdrawal-service.token';
import { MockStockWithdrawalService } from '../stock-withdrawals/mock-stock-withdrawal.service';
import { MockInvoiceService } from './mock-invoice.service';

describe('MockInvoiceService', () => {
  it('records the offered lines as promotion withdrawals on issue, as the API does, and takes them back on cancel', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        MockInvoiceService,
        { provide: STOCK_WITHDRAWAL_SERVICE, useClass: MockStockWithdrawalService },
        { provide: CUSTOMER_SERVICE, useValue: { getById: async () => ({ firstName: 'Jean', lastName: 'Dupont' }) } },
      ],
    });
    const invoices = TestBed.inject(MockInvoiceService);
    const withdrawals = TestBed.inject(STOCK_WITHDRAWAL_SERVICE);
    const promotions = async () =>
      (await withdrawals.list({ reason: 'promotion' })).items.filter((w) => w.invoiceId !== null);

    const draft = await invoices.create({
      customerId: '1', discountPercent: 0, notes: '', paymentMethod: 'cash',
      lines: [
        { articleId: '2', descriptionSnapshot: 'Pinot Noir Vaudois 2021', quantity: 12, unitPriceSnapshot: 20, vatRateSnapshot: 0.081, offered: false },
        { articleId: '2', descriptionSnapshot: 'Pinot Noir Vaudois 2021', quantity: 1, unitPriceSnapshot: 0, vatRateSnapshot: null, offered: true },
      ],
    });
    expect(await promotions()).toEqual([]);

    const issued = await invoices.issue(draft.id);
    expect((await promotions()).map((w) => [w.articleId, w.quantity, w.date, w.invoiceNumber])).toEqual([
      ['2', 1, issued.issueDate, issued.invoiceNumber],
    ]);

    await invoices.cancel(draft.id);
    expect(await promotions()).toEqual([]);
  });
});
