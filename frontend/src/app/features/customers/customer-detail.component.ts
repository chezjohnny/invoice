import { DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { ARTICLE_SERVICE } from '../../core/tokens/article-service.token';
import { CUSTOMER_SERVICE } from '../../core/tokens/customer-service.token';
import { INVOICE_SERVICE } from '../../core/tokens/invoice-service.token';
import { Article } from '../articles/article.model';
import { Invoice, InvoiceCreate } from '../invoices/invoice.model';
import { InvoiceFormComponent } from '../invoices/invoice-form.component';
import { InvoiceLinesComponent } from '../invoices/invoice-lines.component';
import { SearchInputComponent } from '../../shared/components/search-input.component';
import { PagerComponent } from '../../shared/components/pager.component';
import { CustomerFormComponent } from './customer-form.component';
import { Customer } from './customer.model';

const INVOICES_PER_PAGE = 20;

const STATUS_BADGE: Record<string, string> = {
  draft: 'badge-neutral', issued: 'badge-info', paid: 'badge-success', cancelled: 'badge-error',
};

@Component({
  selector: 'app-customer-detail',
  imports: [RouterLink, DecimalPipe, InvoiceFormComponent, CustomerFormComponent, PagerComponent, SearchInputComponent, InvoiceLinesComponent],
  template: `
    <div class="p-4 md:p-6 max-w-5xl mx-auto">
      <a routerLink="/customers" class="btn btn-ghost btn-sm mb-5 -ml-2">
        ← {{ t().customers.backToList }}
      </a>

      @if (loading()) {
        <div class="flex justify-center py-12">
          <span class="loading loading-spinner loading-md"></span>
        </div>
      } @else if (customer()) {

        <!-- Customer info card -->
        <div class="card bg-base-100 shadow mb-6">
          <div class="card-body p-4 md:p-6">
            <div class="flex justify-between items-start gap-4">
              <div class="min-w-0">
                <h1 class="text-xl font-bold sm:text-2xl">
                  {{ customer()!.lastName }}, {{ customer()!.firstName }}
                </h1>
                <p class="text-base-content/60 text-sm mt-1">
                  {{ customer()!.addressLine1 }}, {{ customer()!.postalCode }} {{ customer()!.city }}
                </p>
                @if (customer()!.email) {
                  <p class="text-sm mt-1">{{ customer()!.email }}</p>
                }
                @for (p of customer()!.phones; track p.number) {
                  <p class="text-sm text-base-content/70">{{ p.label }}: {{ p.number }}</p>
                }
              </div>
              <button class="btn btn-outline btn-sm shrink-0" (click)="showEditForm.set(true)">
                {{ t().common.edit }}
              </button>
            </div>
          </div>
        </div>

        <!-- Invoice history header -->
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-lg font-semibold">{{ t().customers.invoiceHistory }}</h2>
          <button class="btn btn-sm"
            [class]="showInvoiceForm() ? 'btn-ghost' : 'btn-primary'"
            (click)="showInvoiceForm.set(!showInvoiceForm())">
            {{ showInvoiceForm() ? t().common.cancel : t().invoices.new }}
          </button>
        </div>

        <div class="flex flex-wrap items-center gap-4 mb-4">
          <app-search-input [placeholder]="t().invoices.search" [value]="search()"
            (search)="onSearch($event)" />
        </div>

        <!-- New invoice form (inline) -->
        @if (showInvoiceForm()) {
          <div class="card bg-base-100 shadow mb-6">
            <div class="card-body p-4 md:p-6">
              <app-invoice-form
                [externalCustomer]="customer()"
                [articles]="articles()"
                (saved)="onInvoiceSaved($event)"
                (cancelled)="showInvoiceForm.set(false)"
                (issuedAndPrinted)="onIssuedAndPrinted($event)"
              />
            </div>
          </div>
        }

        <!-- Invoice list -->
        @if (invoices().length === 0) {
          <div class="card bg-base-100 shadow">
            <div class="card-body text-center text-base-content/40 py-10">
              <p>{{ search() ? t().invoices.noResults : t().customers.noInvoices }}</p>
            </div>
          </div>
        } @else {
          <div class="card bg-base-100 shadow overflow-hidden">
            <div class="overflow-x-auto">
              <table class="table w-full">
                <thead>
                  <tr>
                    <th class="w-8"></th>
                    <th class="hidden sm:table-cell">{{ t().invoices.number }}</th>
                    <th class="hidden md:table-cell">{{ t().invoices.date }}</th>
                    <th class="hidden md:table-cell">{{ t().invoices.due }}</th>
                    <th>{{ t().invoices.status }}</th>
                    <th class="text-right">{{ t().invoices.total }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (inv of invoices(); track inv.id) {
                    <tr class="cursor-pointer hover:bg-base-200 select-none"
                      (click)="toggleInvoice(inv.id)">
                      <td class="text-base-content/40 text-xs pl-4">
                        {{ expandedInvoiceId() === inv.id ? '▲' : '▼' }}
                      </td>
                      <td class="font-mono text-sm hidden sm:table-cell">{{ inv.invoiceNumber ?? '—' }}</td>
                      <td class="text-sm text-base-content/60 hidden md:table-cell">{{ inv.issueDate ?? '—' }}</td>
                      <td class="text-sm text-base-content/60 hidden md:table-cell">{{ inv.dueDate ?? '—' }}</td>
                      <td>
                        <span class="badge badge-sm" [class]="statusBadge(inv.status)">
                          {{ statusLabel(inv.status) }}
                        </span>
                      </td>
                      <td class="text-right font-semibold tabular-nums">
                        CHF {{ lineTotal(inv) | number:'1.2-2' }}
                      </td>
                    </tr>
                    @if (expandedInvoiceId() === inv.id) {
                      <tr>
                        <td colspan="6" class="bg-base-200/60 p-0">
                          <app-invoice-lines [invoice]="inv">
                            @if (inv.status === 'issued' || inv.status === 'paid') {
                              <button class="btn btn-sm btn-outline"
                                (click)="downloadPdf($event, inv)">
                                ↓ PDF
                              </button>
                            }
                          </app-invoice-lines>
                        </td>
                      </tr>
                    }
                  }
                </tbody>
              </table>
            </div>
          </div>
          <app-pager [page]="invoicePage()" [pages]="invoicePages()" [total]="invoiceTotal()"
            (pageChange)="loadInvoices($event)" />
        }
      }
    </div>

    @if (showEditForm()) {
      <dialog class="modal modal-open">
        <div class="modal-box w-full max-w-lg">
          <app-customer-form
            [customer]="customer()"
            (saved)="onCustomerSaved($event)"
            (cancelled)="showEditForm.set(false)"
          />
        </div>
        <div class="modal-backdrop" (click)="showEditForm.set(false)"></div>
      </dialog>
    }
  `,
})
export class CustomerDetailComponent {
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.T;
  private readonly route = inject(ActivatedRoute);
  private readonly customerService = inject(CUSTOMER_SERVICE);
  private readonly invoiceService = inject(INVOICE_SERVICE);
  private readonly articleService = inject(ARTICLE_SERVICE);

  protected readonly customer = signal<Customer | null>(null);
  protected readonly invoices = signal<Invoice[]>([]);
  protected readonly invoicePage = signal(1);
  protected readonly invoicePages = signal(1);
  protected readonly invoiceTotal = signal(0);
  protected readonly search = signal('');
  protected readonly articles = signal<Article[]>([]);
  protected readonly loading = signal(true);
  protected readonly showInvoiceForm = signal(false);
  protected readonly showEditForm = signal(false);
  protected readonly expandedInvoiceId = signal<string | null>(null);

  constructor() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this._load(id);
  }

  private async _load(id: string): Promise<void> {
    this.loading.set(true);
    const [customer, articles] = await Promise.all([
      this.customerService.getById(id),
      this.articleService.getAll(),
      this.loadInvoices(1),
    ]);
    this.customer.set(customer);
    this.articles.set(articles);
    this.loading.set(false);
  }

  protected onSearch(value: string): void {
    this.search.set(value);
    this.loadInvoices(1);
  }

  protected async loadInvoices(page: number): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id')!;
    const result = await this.invoiceService.list({
      customerId: id, search: this.search(), page, perPage: INVOICES_PER_PAGE,
    });
    this.invoices.set(result.items);
    this.invoicePage.set(result.page);
    this.invoicePages.set(result.pages);
    this.invoiceTotal.set(result.total);
    this.expandedInvoiceId.set(result.items[0]?.id ?? null);
  }

  protected async onInvoiceSaved(data: InvoiceCreate): Promise<void> {
    await this.invoiceService.create(data);
    // The new invoice is the most recent one: it opens page 1.
    await this.loadInvoices(1);
    this.showInvoiceForm.set(false);
  }

  protected async onIssuedAndPrinted(data: InvoiceCreate): Promise<void> {
    const invoice = await this.invoiceService.create(data);
    const issued = await this.invoiceService.issue(invoice.id);
    const blob = await this.invoiceService.downloadPdf(issued.id, this.i18n.locale());
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${issued.invoiceNumber ?? 'invoice'}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    await this.loadInvoices(1);
    this.showInvoiceForm.set(false);
  }

  protected async onCustomerSaved(data: Omit<Customer, 'id' | 'isArchived'>): Promise<void> {
    const updated = await this.customerService.update(this.customer()!.id, data);
    this.customer.set(updated);
    this.showEditForm.set(false);
  }

  protected lineTotal(inv: Invoice): number {
    const sub = inv.lines.reduce((s, l) => s + l.quantity * l.unitPriceSnapshot, 0);
    return sub - (sub * inv.discountPercent) / 100;
  }

  protected statusBadge(status: string): string {
    return STATUS_BADGE[status] ?? 'badge-neutral';
  }

  protected statusLabel(status: string): string {
    return (this.t().status as Record<string, string>)[status] ?? status;
  }

  protected toggleInvoice(id: string): void {
    this.expandedInvoiceId.update((current) => (current === id ? null : id));
  }

  protected async downloadPdf(event: Event, inv: Invoice): Promise<void> {
    event.stopPropagation();
    const blob = await this.invoiceService.downloadPdf(inv.id, this.i18n.locale());
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${inv.invoiceNumber ?? 'invoice'}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
