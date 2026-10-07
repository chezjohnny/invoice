import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { localIsoDate } from '../../shared/dates';
import { Invoice } from './invoice.model';
import { PayDialogComponent, PaymentRequest } from './pay-dialog.component';

const INVOICE: Invoice = {
  id: 'i1', customerId: 'c1', customerName: 'Dupont, Jean', invoiceNumber: '2610071', status: 'issued',
  issueDate: '2026-10-07', dueDate: '2026-11-06', paidAt: null, discountPercent: 0, notes: '',
  paymentMethod: 'twint', lines: [], reminders: [],
};

describe('PayDialogComponent', () => {
  let fixture: ComponentFixture<PayDialogComponent>;
  let confirmed: PaymentRequest[];
  const element = () => fixture.nativeElement as HTMLElement;
  const date = () => element().querySelector('#pay-payment-date') as HTMLInputElement;
  const payButton = () => element().querySelector('.btn-outline') as HTMLButtonElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [PayDialogComponent],
      providers: [provideZonelessChangeDetection()],
    });
    fixture = TestBed.createComponent(PayDialogComponent);
    fixture.componentRef.setInput('invoice', INVOICE);
    confirmed = [];
    fixture.componentInstance.confirmed.subscribe((p) => confirmed.push(p));
    await fixture.whenStable();
  });

  it('pays today, by the method planned on the invoice', async () => {
    expect(date().value).toBe(localIsoDate());
    payButton().click();
    await fixture.whenStable();
    expect(confirmed).toEqual([{ paidAt: localIsoDate(), paymentMethod: 'twint', print: false }]);
  });

  it('refuses a payment in the future', async () => {
    date().value = '2999-01-01';
    date().dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(payButton().disabled).toBe(true);
  });
});
