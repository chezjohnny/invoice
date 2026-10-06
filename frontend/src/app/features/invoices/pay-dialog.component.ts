import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, input, linkedSignal, output } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { inputValue } from '../../shared/events';
import { localIsoDate } from '../../shared/dates';
import { Invoice, PAYMENT_METHODS, Payment, PaymentMethod, invoiceTotal } from './invoice.model';

export interface PaymentRequest extends Payment {
  /** Download the receipt right away, e.g. as the paper copy for the accounts. */
  print: boolean;
}

/**
 * Records the payment of an issued invoice in one step: its date, how it was
 * paid, and the receipt. Render it with `@if` while pending.
 */
@Component({
  selector: 'app-pay-dialog',
  // On the document: the button that opened the dialog keeps the focus.
  host: { '(document:keydown.escape)': 'cancelled.emit()' },
  imports: [CurrencyPipe],
  template: `
    <dialog class="modal modal-open">
      <div class="modal-box max-w-md">
        <h3 class="text-lg font-semibold">{{ t().invoices.payTitle }}</h3>
        <p class="text-sm text-base-content/70 mt-1">
          <span class="font-mono">{{ invoice().invoiceNumber }}</span> · {{ invoice().customerName }}
          · <span class="font-semibold tabular-nums">{{ total() | currency:'CHF':'code':'1.2-2' }}</span>
        </p>

        <fieldset class="fieldset gap-4 mt-4">
          <div>
            <label class="fieldset-label" for="pay-payment-date">{{ t().invoices.paymentDate }}</label>
            <input id="pay-payment-date" class="input w-full" type="date" [max]="today" [value]="paidAt()"
              (change)="paidAt.set(inputValue($event))" />
          </div>
          <div>
            <label class="fieldset-label" for="pay-payment-method">{{ t().invoices.paymentMethodLabel }}</label>
            <select id="pay-payment-method" class="select w-full" (change)="paymentMethod.set(inputValue($event))">
              @for (method of paymentMethods; track method) {
                <option [value]="method" [selected]="paymentMethod() === method">
                  {{ t().paymentMethod[method] }}
                </option>
              }
            </select>
          </div>
        </fieldset>

        <div class="modal-action flex-wrap">
          <button type="button" class="btn btn-ghost" (click)="cancelled.emit()">
            {{ t().common.cancel }}
          </button>
          <button type="button" class="btn btn-outline" [disabled]="!paidAt()" (click)="confirm(false)">
            {{ t().invoices.pay }}
          </button>
          <button type="button" class="btn btn-success" [disabled]="!paidAt()" (click)="confirm(true)">
            {{ t().invoices.payAndPrint }}
          </button>
        </div>
      </div>
      <button type="button" class="modal-backdrop" tabindex="-1" [attr.aria-label]="t().common.cancel"
        (click)="cancelled.emit()"></button>
    </dialog>
  `,
})
export class PayDialogComponent {
  readonly invoice = input.required<Invoice>();
  readonly confirmed = output<PaymentRequest>();
  readonly cancelled = output<void>();

  protected readonly t = inject(I18nService).T;
  protected readonly inputValue = inputValue;
  protected readonly paymentMethods = PAYMENT_METHODS;
  protected readonly today = localIsoDate();
  protected readonly total = computed(() => invoiceTotal(this.invoice()));

  protected readonly paidAt = linkedSignal(() => { this.invoice(); return this.today; });
  // The method planned on the invoice, to be corrected when the customer paid otherwise.
  protected readonly paymentMethod = linkedSignal<PaymentMethod>(
    () => this.invoice().paymentMethod ?? 'cash'
  );

  protected confirm(print: boolean): void {
    this.confirmed.emit({ paidAt: this.paidAt(), paymentMethod: this.paymentMethod(), print });
  }
}
