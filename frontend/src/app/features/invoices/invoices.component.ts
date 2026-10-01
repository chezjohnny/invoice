import { DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { ARTICLE_SERVICE } from '../../core/tokens/article-service.token';
import { CUSTOMER_SERVICE } from '../../core/tokens/customer-service.token';
import { Article } from '../articles/article.model';
import { Customer } from '../customers/customer.model';
import { CompanyStore } from '../settings/company.store';
import { CustomerFormComponent } from '../customers/customer-form.component';
import { InvoiceFormComponent } from './invoice-form.component';
import { InvoiceLinesComponent } from './invoice-lines.component';
import { Invoice, InvoiceCreate } from './invoice.model';
import { InvoiceStore } from './invoice.store';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog.component';
import { IconComponent } from '../../shared/components/icon.component';
import { PagerComponent } from '../../shared/components/pager.component';
import { SearchInputComponent } from '../../shared/components/search-input.component';
import { SortHeaderComponent } from '../../shared/components/sort-header.component';

const STATUS_TABS = ['all', 'draft', 'issued', 'paid', 'cancelled'] as const;

const STATUS_BADGE: Record<string, string> = {
  draft: 'badge-neutral', issued: 'badge-info', paid: 'badge-success', cancelled: 'badge-error',
};

@Component({
  selector: 'app-invoices',
  providers: [InvoiceStore],
  imports: [InvoiceFormComponent, CustomerFormComponent, DecimalPipe, RouterLink, PagerComponent, SortHeaderComponent, SearchInputComponent, InvoiceLinesComponent, IconComponent, ConfirmDialogComponent],
  template: `
    <div class="p-4 md:p-6 max-w-5xl mx-auto">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-xl font-bold sm:text-2xl">{{ t().invoices.title }}</h1>
        <button class="btn btn-primary btn-sm sm:btn-md" (click)="openNew()">
          {{ t().invoices.new }}
        </button>
      </div>

      <!-- Filters row -->
      <div class="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
        <app-search-input [placeholder]="t().invoices.search" [value]="store.search()"
          (search)="store.setSearch($event)" />
        <div class="tabs tabs-bordered overflow-x-auto flex-1 min-w-0">
          @for (tab of statusTabs; track tab) {
            <button class="tab whitespace-nowrap"
              [class.tab-active]="store.statusFilter() === tab"
              (click)="store.setStatusFilter(tab)">
              {{ t().status[tab] }}
            </button>
          }
        </div>
      </div>

      <div class="flex items-center justify-between gap-2 mb-2">
        <span class="text-sm text-base-content/50">{{ store.total() }} {{ t().common.results }}</span>
      </div>

      @if (store.loading()) {
        <div class="flex justify-center py-8">
          <span class="loading loading-spinner loading-md"></span>
        </div>
      } @else {
        <div class="card bg-base-100 shadow overflow-hidden">
          <div class="overflow-x-auto">
            <table class="table w-full">
              <thead>
                <tr>
                  <th class="w-8"></th>
                  <th class="hidden sm:table-cell" appSortHeader="number" [sort]="store.sort()" (sortChange)="store.toggleSort($event)">{{ t().invoices.number }}</th>
                  <th appSortHeader="customer" [sort]="store.sort()" (sortChange)="store.toggleSort($event)">{{ t().invoices.customer }}</th>
                  <th class="hidden md:table-cell" appSortHeader="date" [sort]="store.sort()" (sortChange)="store.toggleSort($event)">{{ t().invoices.date }}</th>
                  <th class="hidden md:table-cell" appSortHeader="due" [sort]="store.sort()" (sortChange)="store.toggleSort($event)">{{ t().invoices.due }}</th>
                  <th appSortHeader="paid_at" [sort]="store.sort()" (sortChange)="store.toggleSort($event)">{{ t().invoices.paymentDate }}</th>
                  <th class="text-right" appSortHeader="total" [sort]="store.sort()" (sortChange)="store.toggleSort($event)">{{ t().invoices.total }}</th>
                  <th appSortHeader="status" [sort]="store.sort()" (sortChange)="store.toggleSort($event)">{{ t().invoices.status }}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (inv of store.items(); track inv.id) {
                  <tr class="cursor-pointer hover:bg-base-200" (click)="toggleInvoice(inv.id)">
                    <td class="text-base-content/40 text-xs pl-4">
                      {{ expandedInvoiceId() === inv.id ? '▲' : '▼' }}
                    </td>
                    <td class="font-mono text-sm hidden sm:table-cell">{{ inv.invoiceNumber ?? '—' }}</td>
                    <td class="font-medium">
                      <a [routerLink]="['/customers', inv.customerId]" class="hover:text-primary hover:underline"
                        (click)="$event.stopPropagation()">
                        {{ inv.customerName || '—' }}
                      </a>
                    </td>
                    <td class="text-sm text-base-content/60 hidden md:table-cell">{{ inv.issueDate ?? '—' }}</td>
                    <td class="text-sm text-base-content/60 hidden md:table-cell">{{ inv.dueDate ?? '—' }}</td>
                    <td (click)="$event.stopPropagation()">
                      @if (inv.status === 'paid') {
                        <input type="date" class="input input-bordered input-xs w-36"
                          [value]="inv.paidAt ?? ''"
                          [attr.aria-label]="t().invoices.paymentDate"
                          [disabled]="store.loading()"
                          (change)="onPaymentDateChange(inv.id, $event)" />
                      } @else { — }
                    </td>
                    <td class="text-right font-medium tabular-nums">{{ lineTotal(inv) | number:'1.2-2' }}</td>
                    <td>
                      <span class="badge badge-sm" [class]="statusBadge(inv.status)">
                        {{ statusLabel(inv.status) }}
                      </span>
                    </td>
                    <td (click)="$event.stopPropagation()">
                      <div class="flex gap-1 justify-end items-center whitespace-nowrap">
                        @if (inv.status === 'draft') {
                          <button class="btn btn-ghost btn-sm btn-square tooltip tooltip-left" (click)="openEdit(inv)"
                            [attr.data-tip]="t().common.edit" [attr.aria-label]="t().common.edit">
                            <app-icon name="edit" />
                          </button>
                          <!-- The tooltip sits on a wrapper: a disabled button gets no hover -->
                          <span class="tooltip tooltip-left"
                            [attr.data-tip]="company.isIncomplete() ? t().invoices.issueBlocked : t().invoices.issue">
                            <button class="btn btn-ghost btn-sm btn-square text-info" (click)="store.issue(inv.id)"
                              [disabled]="company.isIncomplete()" [attr.aria-label]="t().invoices.issue">
                              <app-icon name="issue" />
                            </button>
                          </span>
                          <button class="btn btn-ghost btn-sm btn-square tooltip tooltip-left text-error"
                            [attr.data-tip]="t().invoices.cancelInvoice" [attr.aria-label]="t().invoices.cancelInvoice"
                            (click)="store.cancel(inv.id)">
                            <app-icon name="cancel" />
                          </button>
                        }
                        @if (inv.status === 'issued') {
                          <button class="btn btn-ghost btn-sm text-success" (click)="store.pay(inv.id)">
                            {{ t().invoices.pay }}
                          </button>
                          <button class="btn btn-ghost btn-sm btn-square tooltip tooltip-left text-error"
                            [attr.data-tip]="t().invoices.cancelInvoice" [attr.aria-label]="t().invoices.cancelInvoice"
                            (click)="store.cancel(inv.id)">
                            <app-icon name="cancel" />
                          </button>
                          <button class="btn btn-ghost btn-sm btn-square tooltip tooltip-left"
                            [attr.data-tip]="t().invoices.downloadPdf" [attr.aria-label]="t().invoices.downloadPdf"
                            (click)="store.downloadPdf(inv)">
                            <app-icon name="pdf" />
                          </button>
                        }
                        @if (inv.status === 'paid') {
                          <button class="btn btn-ghost btn-sm btn-square tooltip tooltip-left"
                            [attr.data-tip]="t().invoices.downloadPdf" [attr.aria-label]="t().invoices.downloadPdf"
                            (click)="store.downloadPdf(inv)">
                            <app-icon name="pdf" />
                          </button>
                        }
                        <!-- Only a draft cancelled before issue: issued invoices are kept -->
                        @if (inv.status === 'cancelled' && !inv.invoiceNumber) {
                          <button class="btn btn-ghost btn-sm btn-square tooltip tooltip-left text-error"
                            [attr.data-tip]="t().common.delete" [attr.aria-label]="t().common.delete"
                            (click)="pendingDelete.set(inv)">
                            <app-icon name="delete" />
                          </button>
                        }
                      </div>
                    </td>
                  </tr>
                  @if (expandedInvoiceId() === inv.id) {
                    <tr>
                      <td colspan="9" class="bg-base-200/60 p-0">
                        <app-invoice-lines [invoice]="inv" />
                      </td>
                    </tr>
                  }
                } @empty {
                  <tr>
                    <td colspan="9" class="text-center text-base-content/40 py-10">
                      {{ t().invoices.noResults }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        <app-pager [page]="store.page()" [pages]="store.pages()"
          (pageChange)="store.setPage($event)" />
      }
    </div>

    @if (showForm()) {
      <dialog class="modal modal-open">
        <div class="modal-box w-full max-w-3xl">
          <app-invoice-form
            [invoice]="editingInvoice()"
            [articles]="articles()"
            [externalCustomer]="pendingCustomer()"
            [canIssue]="!company.isIncomplete()"
            (saved)="onSaved($event)"
            (cancelled)="closeForm()"
            (createCustomerRequested)="onCreateCustomerRequested()"
            (issuedAndPrinted)="onIssuedAndPrinted($event)"
          />
        </div>
        <div class="modal-backdrop" (click)="closeForm()"></div>
      </dialog>
    }

    @if (showCustomerForm()) {
      <dialog class="modal modal-open">
        <div class="modal-box w-full max-w-lg">
          <app-customer-form
            (saved)="onCustomerSaved($event)"
            (cancelled)="showCustomerForm.set(false)"
          />
        </div>
        <div class="modal-backdrop" (click)="showCustomerForm.set(false)"></div>
      </dialog>
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
export class InvoicesComponent {
  protected readonly store = inject(InvoiceStore);
  protected readonly t = inject(I18nService).T;

  private readonly articleService = inject(ARTICLE_SERVICE);
  private readonly customerService = inject(CUSTOMER_SERVICE);

  protected readonly articles = signal<Article[]>([]);
  protected readonly showForm = signal(false);
  protected readonly showCustomerForm = signal(false);
  protected readonly editingInvoice = signal<Invoice | null>(null);
  protected readonly pendingCustomer = signal<Customer | null>(null);
  protected readonly statusTabs = STATUS_TABS;
  protected readonly expandedInvoiceId = signal<string | null>(null);
  protected readonly pendingDelete = signal<Invoice | null>(null);

  protected readonly company = inject(CompanyStore);

  constructor() {
    this.articleService.getAll().then((a) => this.articles.set(a));
  }

  protected lineTotal(inv: Invoice): number {
    const sub = inv.lines.reduce((s, l) => s + l.quantity * l.unitPriceSnapshot, 0);
    const disc = sub * inv.discountPercent / 100;
    const vat = inv.lines.reduce(
      (s, l) =>
        l.vatRateSnapshot != null
          ? s + l.quantity * l.unitPriceSnapshot * (1 - inv.discountPercent / 100) * l.vatRateSnapshot
          : s,
      0
    );
    return sub - disc + vat;
  }

  protected async onDeleteConfirmed(invoice: Invoice): Promise<void> {
    this.pendingDelete.set(null);
    await this.store.delete(invoice.id);
  }

  protected deleteMessage(invoice: Invoice): string {
    return this.t().invoices.deleteConfirm.replace('{customer}', invoice.customerName || '—');
  }

  protected toggleInvoice(id: string): void {
    this.expandedInvoiceId.update((current) => (current === id ? null : id));
  }

  protected statusLabel(status: string): string {
    return (this.t().status as Record<string, string>)[status] ?? status;
  }

  protected statusBadge(status: string): string {
    return STATUS_BADGE[status] ?? 'badge-neutral';
  }


  async onPaymentDateChange(id: string, event: Event): Promise<void> {
    const paidAt = (event.target as HTMLInputElement).value;
    if (paidAt) await this.store.setPaymentDate(id, paidAt);
  }

  openNew(): void {
    this.editingInvoice.set(null);
    this.showForm.set(true);
  }

  openEdit(invoice: Invoice): void {
    this.editingInvoice.set(invoice);
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
    this.pendingCustomer.set(null);
  }

  async onSaved(data: InvoiceCreate): Promise<void> {
    const editing = this.editingInvoice();
    if (editing) {
      await this.store.updateInvoice(editing.id, data);
    } else {
      await this.store.createInvoice(data);
    }
    this.closeForm();
  }

  async onIssuedAndPrinted(data: InvoiceCreate): Promise<void> {
    const invoice = await this.store.createInvoice(data);
    // The draft is persisted: close the modal before issuing so a failure
    // there cannot be retried into a second draft.
    this.closeForm();
    await this.store.issueAndPrint(invoice.id);
  }

  onCreateCustomerRequested(): void {
    this.showCustomerForm.set(true);
  }

  async onCustomerSaved(data: Omit<Customer, 'id' | 'isArchived'>): Promise<void> {
    const customer = await this.customerService.create(data);
    this.pendingCustomer.set(customer);
    this.showCustomerForm.set(false);
  }
}
