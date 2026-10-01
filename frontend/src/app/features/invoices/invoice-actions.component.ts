import { Component, inject, input, output } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { IconComponent } from '../../shared/components/icon.component';
import { Invoice } from './invoice.model';

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
        <!-- The tooltip sits on a wrapper: a disabled button gets no hover -->
        <span class="tooltip tooltip-left"
          [attr.data-tip]="canIssue() ? t().invoices.issue : t().invoices.issueBlocked">
          <button class="btn btn-ghost btn-sm btn-square text-info" (click)="issue.emit()"
            [disabled]="!canIssue()" [attr.aria-label]="t().invoices.issue">
            <app-icon name="issue" />
          </button>
        </span>
        <button class="btn btn-ghost btn-sm btn-square tooltip tooltip-left text-error"
          [attr.data-tip]="t().invoices.cancelInvoice" [attr.aria-label]="t().invoices.cancelInvoice"
          (click)="cancel.emit()">
          <app-icon name="cancel" />
        </button>
      }
      @if (inv.status === 'issued') {
        <button class="btn btn-ghost btn-sm text-success" (click)="pay.emit()">
          {{ t().invoices.pay }}
        </button>
        <button class="btn btn-ghost btn-sm btn-square tooltip tooltip-left text-error"
          [attr.data-tip]="t().invoices.cancelInvoice" [attr.aria-label]="t().invoices.cancelInvoice"
          (click)="cancel.emit()">
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
  // Issuing needs a complete company profile (address + IBAN) for the QR-bill.
  readonly canIssue = input(true);
  readonly edit = output<void>();
  readonly issue = output<void>();
  readonly pay = output<void>();
  readonly cancel = output<void>();
  readonly pdf = output<void>();
  readonly delete = output<void>();

  protected readonly t = inject(I18nService).T;
}
