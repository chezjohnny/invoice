import { Component, computed, inject, input, output } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { IconComponent } from '../../shared/components/icon.component';
import { Invoice, isOverdue } from './invoice.model';

@Component({
  selector: 'app-invoice-actions',
  imports: [IconComponent],
  template: `
    @let inv = invoice();
    <div class="flex gap-1 justify-end items-center whitespace-nowrap">
      @if (inv.status === 'draft') {
        <button class="btn btn-ghost btn-sm btn-square tooltip tooltip-left" (click)="edit.emit()"
          [attr.data-tip]="t().common.edit" [attr.aria-label]="t().common.edit">
          <app-icon name="edit" />
        </button>
        <button class="btn btn-ghost btn-sm btn-square tooltip tooltip-left text-error"
          [attr.data-tip]="t().invoices.cancelInvoice" [attr.aria-label]="t().invoices.cancelInvoice"
          (click)="cancelInvoice.emit()">
          <app-icon name="cancel" />
        </button>
      }
      @if (inv.status === 'issued') {
        <button class="btn btn-ghost btn-sm text-success" (click)="pay.emit()">
          {{ t().invoices.pay }}
        </button>
        @if (overdue()) {
          <button class="btn btn-ghost btn-sm btn-square tooltip tooltip-left text-warning"
            [attr.data-tip]="t().invoices.createReminder" [attr.aria-label]="t().invoices.createReminder"
            (click)="remind.emit()">
            <app-icon name="reminder" />
          </button>
        }
        <button class="btn btn-ghost btn-sm btn-square tooltip tooltip-left text-error"
          [attr.data-tip]="t().invoices.cancelInvoice" [attr.aria-label]="t().invoices.cancelInvoice"
          (click)="cancelInvoice.emit()">
          <app-icon name="cancel" />
        </button>
      }
      @if (inv.status === 'issued' || inv.status === 'paid') {
        <button class="btn btn-ghost btn-sm btn-square tooltip tooltip-left"
          [attr.data-tip]="t().invoices.downloadPdf" [attr.aria-label]="t().invoices.downloadPdf"
          (click)="pdf.emit()">
          <app-icon name="pdf" />
        </button>
      }
      <!-- Only a draft cancelled before issue: issued invoices are kept -->
      @if (inv.status === 'cancelled' && !inv.invoiceNumber) {
        <button class="btn btn-ghost btn-sm btn-square tooltip tooltip-left text-error"
          [attr.data-tip]="t().common.delete" [attr.aria-label]="t().common.delete"
          (click)="delete.emit()">
          <app-icon name="delete" />
        </button>
      }
    </div>
  `,
})
export class InvoiceActionsComponent {
  readonly invoice = input.required<Invoice>();
  readonly edit = output<void>();
  readonly pay = output<void>();
  readonly remind = output<void>();
  readonly cancelInvoice = output<void>();
  readonly pdf = output<void>();
  readonly delete = output<void>();

  protected readonly t = inject(I18nService).T;
  protected readonly overdue = computed(() => isOverdue(this.invoice()));
}
