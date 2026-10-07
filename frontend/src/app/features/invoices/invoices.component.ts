import { Component, inject } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { SearchInputComponent } from '../../shared/components/search-input.component';
import { InvoiceTableComponent } from './invoice-table.component';
import { INVOICE_STATUSES } from './invoice.model';
import { InvoiceStore } from './invoice.store';

const STATUS_TABS = ['all', ...INVOICE_STATUSES] as const;

@Component({
  selector: 'app-invoices',
  providers: [InvoiceStore],
  imports: [SearchInputComponent, InvoiceTableComponent],
  template: `
    <div class="p-4 md:p-6 max-w-5xl mx-auto">
      <!-- No "new invoice" here: an invoice is always started from its customer's page -->
      <h1 class="text-xl font-bold sm:text-2xl mb-6">{{ t().invoices.title }}</h1>

      <!-- Filters row -->
      <div class="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
        <app-search-input autofocus [placeholder]="t().invoices.search" [value]="store.search()"
          (valueChange)="store.setSearch($event)" />
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

      <app-invoice-table />
    </div>
  `,
})
export class InvoicesComponent {
  protected readonly store = inject(InvoiceStore);
  protected readonly t = inject(I18nService).T;
  protected readonly statusTabs = STATUS_TABS;

  constructor() {
    this.store.load();
  }
}
