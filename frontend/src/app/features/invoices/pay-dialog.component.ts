import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, input, linkedSignal, output } from '@angular/core';
import { FormField, form, required, submit, validate } from '@angular/forms/signals';
import { I18nService } from '../../core/i18n/i18n.service';
import { FieldErrorComponent } from '../../shared/components/field-error.component';
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
  imports: [CurrencyPipe, FieldErrorComponent, FormField],
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
            <input id="pay-payment-date" class="input w-full" type="date" [formField]="payForm.paidAt" />
            <app-field-error [field]="payForm.paidAt" />
          </div>
          <div>
            <label class="fieldset-label" for="pay-payment-method">{{ t().invoices.paymentMethodLabel }}</label>
            <select id="pay-payment-method" class="select w-full" [formField]="payForm.paymentMethod">
              @for (method of paymentMethods; track method) {
                <option [value]="method">{{ t().paymentMethod[method] }}</option>
              }
            </select>
          </div>
        </fieldset>

        <div class="modal-action flex-wrap">
          <button type="button" class="btn btn-ghost" (click)="cancelled.emit()">
            {{ t().common.cancel }}
          </button>
          <button type="button" class="btn btn-outline" [disabled]="payForm().invalid()" (click)="confirm(false)">
            {{ t().invoices.pay }}
          </button>
          <button type="button" class="btn btn-success" [disabled]="payForm().invalid()" (click)="confirm(true)">
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
  protected readonly paymentMethods = PAYMENT_METHODS;
  protected readonly today = localIsoDate();
  protected readonly total = computed(() => invoiceTotal(this.invoice()));

  // Paid today, by the method planned on the invoice: both to correct when needed.
  protected readonly model = linkedSignal<{ paidAt: string; paymentMethod: PaymentMethod }>(() => ({
    paidAt: this.today,
    paymentMethod: this.invoice().paymentMethod ?? 'cash',
  }));
  protected readonly payForm = form(this.model, (path) => {
    required(path.paidAt, { message: () => this.t().invoices.paymentDateRequired });
    // ISO dates compare as text.
    validate(path.paidAt, ({ value }) =>
      value() > this.today ? { kind: 'future', message: this.t().invoices.paymentInFuture } : undefined
    );
  });

  protected confirm(print: boolean): void {
    submit(this.payForm, async () => this.confirmed.emit({ ...this.model(), print }));
  }
}
