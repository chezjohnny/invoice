import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { NaturalDatePipe } from '../../shared/date.pipe';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog.component';
import { IconComponent } from '../../shared/components/icon.component';
import { PagerComponent } from '../../shared/components/pager.component';
import { SearchInputComponent } from '../../shared/components/search-input.component';
import { SortHeaderComponent } from '../../shared/components/sort-header.component';
import {
  STOCK_WITHDRAWAL_REASONS, StockWithdrawal, StockWithdrawalReason,
} from './stock-withdrawal.model';
import { StockWithdrawalStore } from './stock-withdrawal.store';

const REASON_BADGE: Record<StockWithdrawalReason, string> = {
  tasting: 'badge-info', promotion: 'badge-secondary', loss: 'badge-error', other: 'badge-neutral',
};

@Component({
  selector: 'app-stock-withdrawals',
  providers: [StockWithdrawalStore],
  imports: [
    RouterLink, PagerComponent, SortHeaderComponent, SearchInputComponent,
    IconComponent, ConfirmDialogComponent, NaturalDatePipe,
  ],
  template: `
    <div class="p-4 md:p-6 max-w-5xl mx-auto">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-xl font-bold sm:text-2xl">{{ t().stockWithdrawals.title }}</h1>
        <a class="btn btn-primary btn-sm sm:btn-md" routerLink="/stock-withdrawals/new">
          {{ t().stockWithdrawals.new }}
        </a>
      </div>

      <div class="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
        <app-search-input autofocus [placeholder]="t().stockWithdrawals.search" [value]="store.search()"
          (valueChange)="store.setSearch($event)" />
        <div class="tabs tabs-bordered overflow-x-auto flex-1 min-w-0">
          <button class="tab whitespace-nowrap" [class.tab-active]="store.reasonFilter() === null"
            (click)="store.setReasonFilter(null)">
            {{ t().status.all }}
          </button>
          @for (reason of reasons; track reason) {
            <button class="tab whitespace-nowrap" [class.tab-active]="store.reasonFilter() === reason"
              (click)="store.setReasonFilter(reason)">
              {{ t().stockWithdrawalReason[reason] }}
            </button>
          }
        </div>
      </div>

      <div class="flex items-center justify-between gap-2 mb-2">
        <span class="text-sm text-base-content/50">{{ store.total() }} {{ t().common.results }}</span>
      </div>

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
                  <th class="col-fit" appSortHeader="date" [sort]="store.sort()" (sortChange)="store.toggleSort($event)">{{ t().stockWithdrawals.date }}</th>
                  <th appSortHeader="article" [sort]="store.sort()" (sortChange)="store.toggleSort($event)">{{ t().stockWithdrawals.article }}</th>
                  <th class="col-fit text-right" appSortHeader="quantity" [sort]="store.sort()" (sortChange)="store.toggleSort($event)">{{ t().stockWithdrawals.quantity }}</th>
                  <th class="col-fit" appSortHeader="reason" [sort]="store.sort()" (sortChange)="store.toggleSort($event)">{{ t().stockWithdrawals.reason }}</th>
                  <th class="hidden md:table-cell">{{ t().stockWithdrawals.note }}</th>
                  <th class="col-fit"></th>
                </tr>
              </thead>
              <tbody>
                @for (w of store.items(); track w.id) {
                  <tr>
                    <td class="col-fit text-sm text-base-content/60">{{ w.date | naturalDate }}</td>
                    <td class="font-medium">{{ w.articleName }}</td>
                    <td class="col-fit text-right tabular-nums">{{ w.quantity }}</td>
                    <td class="col-fit">
                      <span class="badge badge-sm" [class]="reasonBadge[w.reason]">
                        {{ t().stockWithdrawalReason[w.reason] }}
                      </span>
                    </td>
                    <td class="text-sm text-base-content/60 hidden md:table-cell">{{ w.note || '—' }}</td>
                    <td class="col-fit">
                      <div class="flex justify-end">
                        @if (w.invoiceNumber) {
                          <!-- Offered on an invoice: it alone takes the withdrawal back, by being cancelled -->
                          <a class="link link-primary text-sm whitespace-nowrap tooltip tooltip-left"
                            [attr.data-tip]="t().stockWithdrawals.fromInvoiceHint"
                            routerLink="/invoices" [queryParams]="{ q: w.invoiceNumber }">
                            {{ t().stockWithdrawals.fromInvoice.replace('{number}', w.invoiceNumber) }}
                          </a>
                        } @else {
                          <button class="btn btn-ghost btn-sm btn-square tooltip tooltip-left text-error"
                            [attr.data-tip]="t().common.delete" [attr.aria-label]="t().common.delete"
                            (click)="pendingDelete.set(w)">
                            <app-icon name="delete" />
                          </button>
                        }
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="6" class="text-center text-base-content/40 py-10">
                      {{ t().stockWithdrawals.noResults }}
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

    @if (pendingDelete(); as withdrawal) {
      <app-confirm-dialog
        [title]="t().stockWithdrawals.deleteTitle"
        [message]="deleteMessage(withdrawal)"
        [confirmLabel]="t().common.delete"
        (confirmed)="onDeleteConfirmed(withdrawal)"
        (cancelled)="pendingDelete.set(null)" />
    }
  `,
})
export class StockWithdrawalsComponent {
  protected readonly store = inject(StockWithdrawalStore);
  protected readonly t = inject(I18nService).T;

  protected readonly reasons = STOCK_WITHDRAWAL_REASONS;
  protected readonly reasonBadge = REASON_BADGE;
  protected readonly pendingDelete = signal<StockWithdrawal | null>(null);

  protected async onDeleteConfirmed(withdrawal: StockWithdrawal): Promise<void> {
    this.pendingDelete.set(null);
    await this.store.delete(withdrawal.id);
  }

  protected deleteMessage(withdrawal: StockWithdrawal): string {
    return this.t().stockWithdrawals.deleteConfirm
      .replace('{quantity}', String(withdrawal.quantity))
      .replace('{article}', withdrawal.articleName);
  }
}
