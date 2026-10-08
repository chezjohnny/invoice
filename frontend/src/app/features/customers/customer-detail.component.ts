import { Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { CUSTOMER_SERVICE } from '../../core/tokens/customer-service.token';
import { SearchInputComponent } from '../../shared/components/search-input.component';
import { InvoiceTableComponent } from '../invoices/invoice-table.component';
import { InvoiceStore } from '../invoices/invoice.store';
import { customerDisplayName } from './customer.model';

@Component({
  selector: 'app-customer-detail',
  providers: [InvoiceStore],
  imports: [RouterLink, SearchInputComponent, InvoiceTableComponent],
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
                  {{ displayName(customer()!) }}
                </h1>
                <p class="text-base-content/60 text-sm mt-1">
                  {{ address() }}
                </p>
                @if (customer()!.email) {
                  <p class="text-sm mt-1">{{ customer()!.email }}</p>
                }
                @for (p of customer()!.phones; track p.number) {
                  <p class="text-sm text-base-content/70">{{ p.label }}: {{ p.number }}</p>
                }
              </div>
              <a class="btn btn-outline btn-sm shrink-0" [routerLink]="['/customers', customer()!.id, 'edit']">
                {{ t().common.edit }}
              </a>
            </div>
          </div>
        </div>

        <!-- Invoice history header -->
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-lg font-semibold">{{ t().customers.invoiceHistory }}</h2>
          <a class="btn btn-sm btn-primary" routerLink="/invoices/new"
            [queryParams]="{ customer: customer()!.id, returnTo: router.url }">
            {{ t().invoices.new }}
          </a>
        </div>

        <div class="flex flex-wrap items-center gap-4 mb-4">
          <app-search-input autofocus [placeholder]="t().invoices.search" [value]="invoices.search()"
            (valueChange)="invoices.setSearch($event)" />
        </div>

        <div class="flex items-center justify-between gap-2 mb-2">
          <span class="text-sm text-base-content/50">{{ invoices.total() }} {{ t().common.results }}</span>
        </div>
        <app-invoice-table [showCustomer]="false" [expandFirst]="true"
          [emptyText]="invoices.search() ? t().invoices.noResults : t().customers.noInvoices" />
      }
    </div>
  `,
})
export class CustomerDetailComponent {
  protected readonly t = inject(I18nService).T;
  protected readonly displayName = customerDisplayName;
  protected readonly router = inject(Router);
  protected readonly invoices = inject(InvoiceStore);
  private readonly customerService = inject(CUSTOMER_SERVICE);

  private readonly customerId = inject(ActivatedRoute).snapshot.paramMap.get('id')!;
  private readonly loaded = rxResource({
    params: () => this.customerId,
    stream: ({ params: id }) => this.customerService.getById(id),
  });
  protected readonly customer = computed(() => (this.loaded.hasValue() ? this.loaded.value() : null));
  protected readonly address = computed(() => {
    const c = this.customer();
    if (!c) return '';
    return [c.addressLine1, c.addressLine2, `${c.postalCode} ${c.city}`.trim()]
      .filter(Boolean)
      .join(', ');
  });
  protected readonly loading = this.loaded.isLoading;

  constructor() {
    // The invoice table shows its own spinner while they load.
    this.invoices.showCustomer(this.customerId);
  }
}
