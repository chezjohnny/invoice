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
import { CustomerFormComponent } from './customer-form.component';
import { Customer } from './customer.model';

const STATUS_BADGE: Record<string, string> = {
  draft: 'badge-neutral', issued: 'badge-info', paid: 'badge-success', cancelled: 'badge-error',
};

@Component({
  selector: 'app-customer-detail',
  imports: [RouterLink, DecimalPipe, InvoiceFormComponent, CustomerFormComponent],
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
              <p>{{ t().customers.noInvoices }}</p>
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
                          <div class="px-4 py-3">
                            <!-- Invoice number on mobile (since column is hidden) -->
                            <p class="text-xs text-base-content/50 font-mono mb-2 sm:hidden">
                              {{ inv.invoiceNumber ?? '—' }}
                              @if (inv.issueDate) { · {{ inv.issueDate }} }
                            </p>
                            @if (inv.lines.length === 0) {
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
                                    @for (line of inv.lines; track line.id) {
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
                            @if (inv.status === 'issued' || inv.status === 'paid') {
                              <button class="btn btn-sm btn-outline"
                                (click)="downloadPdf($event, inv)">
                                ↓ PDF
                              </button>
                            }
                          </div>
                        </td>
                      </tr>
                    }
                  }
                </tbody>
              </table>
            </div>
          </div>
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
  protected readonly t = inject(I18nService).T;
  private readonly route = inject(ActivatedRoute);
  private readonly customerService = inject(CUSTOMER_SERVICE);
  private readonly invoiceService = inject(INVOICE_SERVICE);
  private readonly articleService = inject(ARTICLE_SERVICE);

  protected readonly customer = signal<Customer | null>(null);
  protected readonly invoices = signal<Invoice[]>([]);
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
    const [customer, invoicePage, articles] = await Promise.all([
      this.customerService.getById(id),
      this.invoiceService.list({ customerId: id, perPage: 50 }),
      this.articleService.getAll(),
    ]);
    this.customer.set(customer);
    this.invoices.set(invoicePage.items);
    this.articles.set(articles);
    this.expandedInvoiceId.set(invoicePage.items[0]?.id ?? null);
    this.loading.set(false);
  }

  private async _reloadInvoices(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id')!;
    const page = await this.invoiceService.list({ customerId: id, perPage: 50 });
    this.invoices.set(page.items);
    this.expandedInvoiceId.set(page.items[0]?.id ?? null);
  }

  protected async onInvoiceSaved(data: InvoiceCreate): Promise<void> {
    await this.invoiceService.create(data);
    await this._reloadInvoices();
    this.showInvoiceForm.set(false);
  }

  protected async onIssuedAndPrinted(data: InvoiceCreate): Promise<void> {
    const invoice = await this.invoiceService.create(data);
    const issued = await this.invoiceService.issue(invoice.id);
    const blob = await this.invoiceService.downloadPdf(issued.id);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${issued.invoiceNumber ?? 'invoice'}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
    await this._reloadInvoices();
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
    const blob = await this.invoiceService.downloadPdf(inv.id);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${inv.invoiceNumber ?? 'invoice'}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
