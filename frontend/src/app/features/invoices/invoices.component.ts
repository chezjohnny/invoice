import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { ARTICLE_SERVICE } from '../../core/tokens/article-service.token';
import { CUSTOMER_SERVICE } from '../../core/tokens/customer-service.token';
import { Article } from '../articles/article.model';
import { Customer } from '../customers/customer.model';
import { CustomerFormComponent } from '../customers/customer-form.component';
import { InvoiceFormComponent } from './invoice-form.component';
import { Invoice, InvoiceCreate } from './invoice.model';
import { InvoiceStore } from './invoice.store';

const STATUS_TABS = ['all', 'draft', 'issued', 'paid', 'cancelled'] as const;

const STATUS_BADGE: Record<string, string> = {
  draft: 'badge-neutral', issued: 'badge-info', paid: 'badge-success', cancelled: 'badge-error',
};

@Component({
  selector: 'app-invoices',
  providers: [InvoiceStore],
  imports: [InvoiceFormComponent, CustomerFormComponent, DecimalPipe],
  template: `
    <div class="p-4 md:p-6 max-w-5xl mx-auto">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-xl font-bold sm:text-2xl">{{ t().invoices.title }}</h1>
        <button class="btn btn-primary btn-sm sm:btn-md" (click)="openNew()">
          {{ t().invoices.new }}
        </button>
      </div>

      <!-- Filters row -->
      <div class="flex flex-col sm:flex-row gap-3 mb-4">
        <div class="tabs tabs-bordered overflow-x-auto flex-1 min-w-0">
          @for (tab of statusTabs; track tab) {
            <button class="tab whitespace-nowrap"
              [class.tab-active]="store.statusFilter() === tab"
              (click)="store.setStatusFilter(tab)">
              {{ t().status[tab] }}
            </button>
          }
        </div>
        <label class="input input-sm flex items-center gap-2 w-full sm:w-48 shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 opacity-40 shrink-0" viewBox="0 0 16 16">
            <path fill-rule="evenodd" d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.099zm-5.242 1.156a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11"/>
          </svg>
          <input type="text" placeholder="FAC-…" [value]="store.search()" (input)="onSearch($event)" />
        </label>
      </div>

      @if (store.loading()) {
        <div class="flex justify-center py-8">
          <span class="loading loading-spinner loading-md"></span>
        </div>
      } @else {
        <div class="card bg-base-100 shadow overflow-hidden">
          <div class="overflow-x-auto">
            <table class="table table-zebra w-full">
              <thead>
                <tr>
                  <th class="hidden sm:table-cell">{{ t().invoices.number }}</th>
                  <th>{{ t().invoices.customer }}</th>
                  <th class="hidden md:table-cell">{{ t().invoices.date }}</th>
                  <th class="hidden md:table-cell">{{ t().invoices.due }}</th>
                  <th class="text-right">{{ t().invoices.total }}</th>
                  <th>{{ t().invoices.status }}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (inv of store.items(); track inv.id) {
                  <tr>
                    <td class="font-mono text-sm hidden sm:table-cell">{{ inv.invoiceNumber ?? '—' }}</td>
                    <td class="font-medium">{{ inv.customerName || '—' }}</td>
                    <td class="text-sm text-base-content/60 hidden md:table-cell">{{ inv.issueDate ?? '—' }}</td>
                    <td class="text-sm text-base-content/60 hidden md:table-cell">{{ inv.dueDate ?? '—' }}</td>
                    <td class="text-right font-medium tabular-nums">{{ lineTotal(inv) | number:'1.2-2' }}</td>
                    <td>
                      <span class="badge badge-sm" [class]="statusBadge(inv.status)">
                        {{ statusLabel(inv.status) }}
                      </span>
                    </td>
                    <td>
                      <div class="flex gap-1 justify-end flex-wrap">
                        @if (inv.status === 'draft') {
                          <button class="btn btn-ghost btn-sm" (click)="openEdit(inv)">
                            {{ t().common.edit }}
                          </button>
                          <button class="btn btn-ghost btn-sm text-info" (click)="store.issue(inv.id)">
                            {{ t().invoices.issue }}
                          </button>
                          <button class="btn btn-ghost btn-sm text-error" (click)="store.cancel(inv.id)">
                            {{ t().common.cancel }}
                          </button>
                        }
                        @if (inv.status === 'issued') {
                          <button class="btn btn-ghost btn-sm text-success" (click)="store.pay(inv.id)">
                            {{ t().invoices.pay }}
                          </button>
                          <button class="btn btn-ghost btn-sm text-error" (click)="store.cancel(inv.id)">
                            {{ t().common.cancel }}
                          </button>
                          <button class="btn btn-ghost btn-sm" (click)="store.downloadPdf(inv.id)">
                            {{ t().invoices.pdf }}
                          </button>
                        }
                        @if (inv.status === 'paid') {
                          <button class="btn btn-ghost btn-sm" (click)="store.downloadPdf(inv.id)">
                            {{ t().invoices.pdf }}
                          </button>
                        }
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="7" class="text-center text-base-content/40 py-10">
                      {{ t().invoices.noResults }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        @if (store.pages() > 1) {
          <div class="flex justify-center items-center gap-4 mt-4">
            <div class="join">
              @for (p of pageRange(); track p) {
                <button class="join-item btn btn-sm"
                  [class.btn-active]="store.page() === p"
                  (click)="store.setPage(p)">{{ p }}</button>
              }
            </div>
            <span class="text-sm text-base-content/50">
              {{ store.total() }} {{ t().common.results }}
            </span>
          </div>
        }
      }
    </div>

    @if (showForm()) {
      <dialog class="modal modal-open">
        <div class="modal-box w-full max-w-3xl">
          <app-invoice-form
            [invoice]="editingInvoice()"
            [articles]="articles()"
            [externalCustomer]="pendingCustomer()"
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

  private searchTimer?: ReturnType<typeof setTimeout>;

  protected readonly pageRange = computed(() => {
    const total = this.store.pages();
    const current = this.store.page();
    const range: number[] = [];
    for (let i = Math.max(1, current - 2); i <= Math.min(total, current + 2); i++) {
      range.push(i);
    }
    return range;
  });

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

  protected statusLabel(status: string): string {
    return (this.t().status as Record<string, string>)[status] ?? status;
  }

  protected statusBadge(status: string): string {
    return STATUS_BADGE[status] ?? 'badge-neutral';
  }

  onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.store.setSearch(value), 300);
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
    await this.store.issueAndPrint(invoice.id);
    this.closeForm();
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
