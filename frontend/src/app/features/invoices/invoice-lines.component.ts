import { DecimalPipe } from '@angular/common';
import { Component, inject, input, output } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { inputValue } from '../../shared/events';
import { NaturalDatePipe } from '../../shared/date.pipe';
import { IconComponent } from '../../shared/components/icon.component';
import { Invoice, PAYMENT_METHODS, PaymentMethod } from './invoice.model';

/** Expanded detail of an invoice row: its payment and reminders, its lines, then its internal notes. */
@Component({
  selector: 'app-invoice-lines',
  imports: [DecimalPipe, IconComponent, NaturalDatePipe],
  template: `
    <div class="px-4 py-3">
      <!-- Number and date on mobile, where their columns are hidden -->
      <p class="text-xs text-base-content/50 font-mono mb-2 sm:hidden">
        {{ invoice().invoiceNumber ?? '—' }}
        @if (invoice().issueDate) { · {{ invoice().issueDate | naturalDate }} }
      </p>
      <!-- Payment: a draft changes it in the form; once issued or paid, here -->
      @if (invoice().status === 'issued' || invoice().status === 'paid') {
        <div class="flex flex-wrap gap-2 mb-3">
          <label class="select select-sm w-auto">
            <span class="label">{{ t().invoices.paymentMethodLabel }}</span>
            <select (change)="onPaymentMethod($event)">
              @if (invoice().paymentMethod === null) {
                <option value="" selected disabled>—</option>
              }
              @for (method of paymentMethods; track method) {
                <option [value]="method" [selected]="invoice().paymentMethod === method">
                  {{ t().paymentMethod[method] }}
                </option>
              }
            </select>
          </label>
          @if (invoice().status === 'paid') {
            <label class="input input-sm w-auto">
              <span class="label">{{ t().invoices.paymentDate }}</span>
              <input type="date" [value]="invoice().paidAt ?? ''" (change)="onPaymentDate($event)" />
            </label>
          }
        </div>
      } @else if (invoice().paymentMethod; as method) {
        <p class="text-sm text-base-content/60 mb-3">
          {{ t().invoices.paymentMethodLabel }}: {{ t().paymentMethod[method] }}
        </p>
      }
      @if (invoice().reminders.length > 0) {
        <ul class="text-sm mb-3 space-y-1">
          @for (r of invoice().reminders; track r.number) {
            <li class="flex items-center gap-2">
              <app-icon name="reminder" class="text-warning" />
              <span class="font-medium">{{ reminderLabel(r.number) }}</span>
              <span class="text-base-content/60">
                {{ r.sentOn | naturalDate }} · {{ t().invoices.reminderDue }} {{ r.dueOn | naturalDate }}
              </span>
              <button class="btn btn-ghost btn-xs btn-square tooltip" type="button"
                [attr.data-tip]="t().invoices.downloadPdf" [attr.aria-label]="t().invoices.downloadPdf"
                (click)="reminderPdf.emit(r.number)">
                <app-icon name="pdf" />
              </button>
            </li>
          }
        </ul>
      }
      @if (invoice().lines.length === 0) {
        <p class="text-sm text-base-content/40">{{ t().invoices.noLines }}</p>
      } @else {
        <div class="overflow-x-auto">
          <table class="table table-sm w-full mb-3">
            <thead>
              <tr>
                <th>{{ t().invoices.descLabel }}</th>
                <th class="text-right">{{ t().invoices.qtyLabel }}</th>
                <th class="text-right hidden sm:table-cell">{{ t().invoices.priceLabel }}</th>
                <th class="text-right hidden sm:table-cell">{{ t().invoices.vatLabel }}</th>
                <th class="text-right">{{ t().invoices.total }}</th>
              </tr>
            </thead>
            <tbody>
              @for (line of invoice().lines; track line.id) {
                <tr>
                  <td>
                    {{ line.descriptionSnapshot }}
                    @if (line.offered) {
                      <span class="badge badge-xs badge-secondary ml-1">{{ t().invoices.offered }}</span>
                    }
                  </td>
                  <td class="text-right tabular-nums">{{ line.quantity }}</td>
                  <td class="text-right tabular-nums hidden sm:table-cell">
                    {{ line.unitPriceSnapshot | number:'1.2-2' }}
                  </td>
                  <td class="text-right hidden sm:table-cell">
                    @if (line.vatRateSnapshot != null) {
                      {{ (line.vatRateSnapshot * 100) | number:'1.1-1' }}%
                    } @else { — }
                  </td>
                  <td class="text-right font-medium tabular-nums">
                    {{ (line.quantity * line.unitPriceSnapshot) | number:'1.2-2' }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
      @if (invoice().notes) {
        <p class="text-xs text-base-content/60 whitespace-pre-line">
          {{ t().invoices.internalNotes }}: {{ invoice().notes }}
        </p>
      }
    </div>
  `,
})
export class InvoiceLinesComponent {
  readonly invoice = input.required<Invoice>();
  readonly paymentMethodChange = output<PaymentMethod>();
  readonly paymentDateChange = output<string>();
  /** Download the PDF of the reminder with this number. */
  readonly reminderPdf = output<number>();

  protected readonly paymentMethods = PAYMENT_METHODS;

  protected readonly t = inject(I18nService).T;

  protected onPaymentMethod(event: Event): void {
    this.paymentMethodChange.emit(inputValue<PaymentMethod>(event));
  }

  protected reminderLabel(number: number): string {
    const t = this.t().invoices;
    return number === 1 ? t.reminderFirst : t.reminderNth.replace('{n}', String(number));
  }

  protected onPaymentDate(event: Event): void {
    // Cleared with the picker's reset button: a paid invoice keeps its date.
    const paidAt = inputValue(event);
    if (paidAt) this.paymentDateChange.emit(paidAt);
  }
}
