import { DecimalPipe } from '@angular/common';
import { Component, inject, input } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { Invoice } from './invoice.model';

/** Expanded detail of an invoice row: its lines, then any projected actions. */
@Component({
  selector: 'app-invoice-lines',
  imports: [DecimalPipe],
  template: `
    <div class="px-4 py-3">
      <!-- Number and date on mobile, where their columns are hidden -->
      <p class="text-xs text-base-content/50 font-mono mb-2 sm:hidden">
        {{ invoice().invoiceNumber ?? '—' }}
        @if (invoice().issueDate) { · {{ invoice().issueDate }} }
      </p>
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
                  <td>{{ line.descriptionSnapshot }}</td>
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
      <ng-content />
    </div>
  `,
})
export class InvoiceLinesComponent {
  readonly invoice = input.required<Invoice>();

  protected readonly t = inject(I18nService).T;
}
