import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, input, linkedSignal, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog.component';
import { PagerComponent } from '../../shared/components/pager.component';
import { SortHeaderComponent } from '../../shared/components/sort-header.component';
import { NaturalDatePipe } from '../../shared/date.pipe';
import { InvoiceActionsComponent } from './invoice-actions.component';
import { InvoiceLinesComponent } from './invoice-lines.component';
import { InvoiceStatusBadgeComponent } from './invoice-status-badge.component';
import { Invoice, invoiceTotal, isOverdue, nextReminderMessage } from './invoice.model';
import { InvoiceStore } from './invoice.store';
import { PayDialogComponent, PaymentRequest } from './pay-dialog.component';

/**
 * The invoices of the page's InvoiceStore: rows that expand to their lines,
 * their actions, the pager, and the pay / reminder / delete dialogs. Shared by
 * the invoice list and the customer's page.
 */
@Component({
  selector: 'app-invoice-table',
  imports: [
    DecimalPipe, RouterLink, NaturalDatePipe, PagerComponent, SortHeaderComponent,
    ConfirmDialogComponent, PayDialogComponent, InvoiceActionsComponent, InvoiceLinesComponent,
    InvoiceStatusBadgeComponent,
  ],
  template: `
    <!-- Spinner on the first load only: swapping a filled table for it on
         every reload would collapse the page and lose the scroll position -->
    @if (store.loading() && store.items().length === 0) {
      <div class="flex justify-center py-8">
        <span class="loading loading-spinner loading-md"></span>
      </div>
    } @else {
      <div class="card bg-base-100 shadow overflow-hidden transition-opacity"
        [class.opacity-60]="store.loading()" [class.pointer-events-none]="store.loading()">
        <div class="overflow-x-auto">
          <table class="table w-full">
            <thead>
              <tr>
                <th class="w-8"></th>
                <th class="col-fit hidden sm:table-cell" appSortHeader="number" [sort]="store.sort()" (sortChange)="store.toggleSort($event)">{{ t().invoices.number }}</th>
                @if (showCustomer()) {
                  <th appSortHeader="customer" [sort]="store.sort()" (sortChange)="store.toggleSort($event)">{{ t().invoices.customer }}</th>
                }
                <th class="col-fit hidden md:table-cell" appSortHeader="date" [sort]="store.sort()" (sortChange)="store.toggleSort($event)">{{ t().invoices.date }}</th>
                <th class="col-fit hidden md:table-cell" appSortHeader="due" [sort]="store.sort()" (sortChange)="store.toggleSort($event)">{{ t().invoices.due }}</th>
                <th class="col-fit text-right" appSortHeader="total" [sort]="store.sort()" (sortChange)="store.toggleSort($event)">{{ t().invoices.total }}</th>
                <th class="col-fit" appSortHeader="status" [sort]="store.sort()" (sortChange)="store.toggleSort($event)">{{ t().invoices.status }}</th>
                <th class="col-fit"></th>
              </tr>
            </thead>
            <tbody>
              @for (inv of store.items(); track inv.id) {
                <tr class="cursor-pointer hover:bg-base-200" (click)="toggle(inv.id)">
                  <td class="text-base-content/40 text-xs pl-4">
                    {{ expandedId() === inv.id ? '▲' : '▼' }}
                  </td>
                  <td class="col-fit font-mono text-sm hidden sm:table-cell">{{ inv.invoiceNumber ?? '—' }}</td>
                  @if (showCustomer()) {
                    <td class="font-medium">
                      <a [routerLink]="['/customers', inv.customerId]" class="hover:text-primary hover:underline"
                        (click)="$event.stopPropagation()">
                        {{ inv.customerName || '—' }}
                      </a>
                    </td>
                  }
                  <td class="col-fit text-sm text-base-content/60 hidden md:table-cell">{{ inv.issueDate | naturalDate }}</td>
                  <td class="col-fit text-sm hidden md:table-cell"
                    [class]="isOverdue(inv) ? 'text-error font-semibold' : 'text-base-content/60'">{{ inv.dueDate | naturalDate }}</td>
                  <td class="col-fit text-right font-medium tabular-nums">{{ invoiceTotal(inv) | number:'1.2-2' }}</td>
                  <td class="col-fit">
                    <app-invoice-status-badge [status]="inv.status" />
                  </td>
                  <td class="col-fit" (click)="$event.stopPropagation()">
                    <app-invoice-actions [invoice]="inv"
                      (edit)="edit(inv)" (pay)="pendingPayment.set(inv)" (remind)="pendingReminder.set(inv)"
                      (cancelInvoice)="store.cancel(inv.id)" (pdf)="store.downloadPdf(inv)"
                      (delete)="pendingDelete.set(inv)" />
                  </td>
                </tr>
                @if (expandedId() === inv.id) {
                  <tr>
                    <td [attr.colspan]="columns()" class="bg-base-200/60 p-0">
                      <app-invoice-lines [invoice]="inv"
                        (paymentMethodChange)="store.setPaymentMethod(inv.id, $event)"
                        (paymentDateChange)="store.setPaymentDate(inv.id, $event)"
                        (reminderPdf)="store.printReminder(inv, $event)" />
                    </td>
                  </tr>
                }
              } @empty {
                <tr>
                  <td [attr.colspan]="columns()" class="text-center text-base-content/40 py-10">
                    {{ emptyText() ?? t().invoices.noResults }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <app-pager [page]="store.page()" [pages]="store.pages()" (pageChange)="store.setPage($event)" />
    }

    @if (pendingPayment(); as invoice) {
      <app-pay-dialog [invoice]="invoice"
        (confirmed)="onPaymentConfirmed(invoice, $event)" (cancelled)="pendingPayment.set(null)" />
    }

    @if (pendingReminder(); as invoice) {
      <app-confirm-dialog
        [title]="t().invoices.createReminder"
        [message]="reminderMessage(invoice)"
        [confirmLabel]="t().invoices.createReminderAndPrint"
        confirmClass="btn-warning"
        (confirmed)="onReminderConfirmed(invoice)"
        (cancelled)="pendingReminder.set(null)" />
    }

    @if (pendingDelete(); as invoice) {
      <app-confirm-dialog
        [title]="t().invoices.deleteTitle"
        [message]="deleteMessage(invoice)"
        [confirmLabel]="t().common.delete"
        (confirmed)="onDeleteConfirmed(invoice)"
        (cancelled)="pendingDelete.set(null)" />
    }
  `,
})
export class InvoiceTableComponent {
  /** The customer column, left out on the customer's own page. */
  readonly showCustomer = input(true);
  /** Open the first invoice, and keep the open one open across reloads. */
  readonly expandFirst = input(false);
  /** Shown when there is no invoice; defaults to "No invoices found". */
  readonly emptyText = input<string>();

  protected readonly store = inject(InvoiceStore);
  protected readonly t = inject(I18nService).T;
  private readonly router = inject(Router);

  // The first row opens on each new page when asked; a row closed by hand stays closed.
  protected readonly expandedId = linkedSignal<Invoice[], string | null>({
    source: () => this.store.items(),
    computation: (items, previous) => {
      const current = previous?.value ?? null;
      if (!this.expandFirst() || items.some((i) => i.id === current)) return current;
      return items[0]?.id ?? null;
    },
  });
  protected readonly pendingPayment = signal<Invoice | null>(null);
  protected readonly pendingReminder = signal<Invoice | null>(null);
  protected readonly pendingDelete = signal<Invoice | null>(null);
  protected readonly invoiceTotal = invoiceTotal;
  protected readonly isOverdue = isOverdue;
  protected readonly columns = computed(() => (this.showCustomer() ? 8 : 7));

  protected toggle(id: string): void {
    this.expandedId.update((current) => (current === id ? null : id));
  }

  protected edit(invoice: Invoice): void {
    this.router.navigate(['/invoices', invoice.id, 'edit'], { queryParams: { returnTo: this.router.url } });
  }

  protected async onPaymentConfirmed(invoice: Invoice, { print, ...payment }: PaymentRequest): Promise<void> {
    this.pendingPayment.set(null);
    await this.store.pay(invoice.id, payment, print);
  }

  protected async onReminderConfirmed(invoice: Invoice): Promise<void> {
    this.pendingReminder.set(null);
    await this.store.createReminder(invoice.id);
  }

  protected reminderMessage(invoice: Invoice): string {
    return nextReminderMessage(this.t().invoices.createReminderConfirm, invoice, invoice.reminders.length);
  }

  protected async onDeleteConfirmed(invoice: Invoice): Promise<void> {
    this.pendingDelete.set(null);
    await this.store.delete(invoice.id);
  }

  protected deleteMessage(invoice: Invoice): string {
    return this.t().invoices.deleteConfirm.replace('{customer}', invoice.customerName || '—');
  }
}
