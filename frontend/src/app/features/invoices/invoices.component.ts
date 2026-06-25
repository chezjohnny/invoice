import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { ARTICLE_SERVICE } from '../../core/tokens/article-service.token';
import { CUSTOMER_SERVICE } from '../../core/tokens/customer-service.token';
import { Article } from '../articles/article.model';
import { Customer } from '../customers/customer.model';
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
  imports: [InvoiceFormComponent, DecimalPipe],
  template: `
    <div class="p-6 max-w-6xl mx-auto">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold">{{ t().invoices.title }}</h1>
        <button class="btn btn-primary" (click)="openNew()">{{ t().invoices.new }}</button>
      </div>

      <div class="tabs tabs-bordered mb-4">
        @for (tab of statusTabs; track tab) {
          <button class="tab"
            [class.tab-active]="store.statusFilter() === tab"
            (click)="store.setStatusFilter(tab)">
            {{ t().status[tab] }}
            <span class="badge badge-sm ml-1">{{ countByStatus()[tab] ?? 0 }}</span>
          </button>
        }
      </div>

      <div class="overflow-x-auto">
        <table class="table table-zebra w-full">
          <thead>
            <tr>
              <th>{{ t().invoices.number }}</th>
              <th>{{ t().invoices.customer }}</th>
              <th>{{ t().invoices.date }}</th>
              <th>{{ t().invoices.due }}</th>
              <th class="text-right">{{ t().invoices.total }}</th>
              <th>{{ t().invoices.status }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (inv of store.filteredInvoices(); track inv.id) {
              <tr>
                <td class="font-mono text-sm">{{ inv.invoiceNumber ?? '—' }}</td>
                <td>{{ customerName(inv.customerId) }}</td>
                <td class="text-sm">{{ inv.issueDate ?? '—' }}</td>
                <td class="text-sm">{{ inv.dueDate ?? '—' }}</td>
                <td class="text-right font-medium">{{ lineTotal(inv) | number:'1.2-2' }}</td>
                <td>
                  <span class="badge" [class]="statusBadge(inv.status)">
                    {{ t().status[inv.status] }}
                  </span>
                </td>
                <td>
                  <div class="flex gap-1 flex-wrap">
                    @if (inv.status === 'draft') {
                      <button class="btn btn-ghost btn-xs" (click)="openEdit(inv)">
                        {{ t().common.edit }}
                      </button>
                      <button class="btn btn-ghost btn-xs text-info" (click)="store.issue(inv.id)">
                        {{ t().invoices.issue }}
                      </button>
                      <button class="btn btn-ghost btn-xs text-error" (click)="store.cancel(inv.id)">
                        {{ t().common.cancel }}
                      </button>
                    }
                    @if (inv.status === 'issued') {
                      <button class="btn btn-ghost btn-xs text-success" (click)="store.pay(inv.id)">
                        {{ t().invoices.pay }}
                      </button>
                      <button class="btn btn-ghost btn-xs text-error" (click)="store.cancel(inv.id)">
                        {{ t().common.cancel }}
                      </button>
                      <button class="btn btn-ghost btn-xs" (click)="store.downloadPdf(inv.id)">
                        {{ t().invoices.pdf }}
                      </button>
                    }
                    @if (inv.status === 'paid') {
                      <button class="btn btn-ghost btn-xs" (click)="store.downloadPdf(inv.id)">
                        {{ t().invoices.pdf }}
                      </button>
                    }
                  </div>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7" class="text-center text-base-content/40 py-8">
                  {{ t().invoices.noResults }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    @if (showForm()) {
      <dialog class="modal modal-open">
        <div class="modal-box max-w-4xl">
          <app-invoice-form
            [invoice]="editingInvoice()"
            [articles]="articles()"
            [customers]="customers()"
            (saved)="onSaved($event)"
            (cancelled)="closeForm()"
          />
        </div>
        <div class="modal-backdrop" (click)="closeForm()"></div>
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
  protected readonly customers = signal<Customer[]>([]);
  protected readonly showForm = signal(false);
  protected readonly editingInvoice = signal<Invoice | null>(null);
  protected readonly statusTabs = STATUS_TABS;

  protected readonly countByStatus = computed(() => {
    const counts: Record<string, number> = { all: 0 };
    for (const inv of this.store.entities()) {
      counts['all'] = (counts['all'] ?? 0) + 1;
      counts[inv.status] = (counts[inv.status] ?? 0) + 1;
    }
    return counts;
  });

  constructor() {
    this.articleService.getAll().then((a) => this.articles.set(a));
    this.customerService.getAll().then((c) => this.customers.set(c));
  }

  protected customerName(customerId: string): string {
    const c = this.customers().find((x) => x.id === customerId);
    return c ? `${c.lastName}, ${c.firstName}` : '—';
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

  protected statusBadge(status: string): string {
    return STATUS_BADGE[status] ?? 'badge-neutral';
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
}
