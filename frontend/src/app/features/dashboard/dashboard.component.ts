import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { tapResponse } from '@ngrx/operators';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { concatMap, mergeMap } from 'rxjs';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { InvoiceStatusBadgeComponent } from '../invoices/invoice-status-badge.component';
import { NaturalDatePipe } from '../../shared/date.pipe';
import { DASHBOARD_SERVICE } from '../../core/tokens/dashboard-service.token';
import { INVOICE_SERVICE } from '../../core/tokens/invoice-service.token';
import { DashboardStats, OverdueInvoiceItem } from './dashboard.model';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog.component';
import { IconComponent } from '../../shared/components/icon.component';
import { daysSince } from '../../shared/dates';
import { saveFile } from '../../shared/download';
import { nextReminderMessage, reminderPdfName } from '../invoices/invoice.model';

/** Shown until the figures arrive. */
const EMPTY: DashboardStats = {
  draft: { count: 0, total: 0 },
  issued: { count: 0, total: 0 },
  overdue: { count: 0, total: 0 },
  paid: { count: 0, total: 0 },
  invoiceCount: 0,
  customerCount: 0,
  articleCount: 0,
  recentInvoices: [],
  overdueInvoices: [],
};

@Component({
  selector: 'app-dashboard',
  imports: [InvoiceStatusBadgeComponent, CurrencyPipe, RouterLink, IconComponent, ConfirmDialogComponent, NaturalDatePipe],
  template: `
    <div class="p-4 md:p-6 max-w-5xl mx-auto">
      <h1 class="text-xl font-bold sm:text-2xl mb-6">{{ t().dashboard.title }}</h1>

      @if (loading()) {
        <div class="flex justify-center py-12">
          <span class="loading loading-spinner loading-lg"></span>
        </div>
      } @else {
        <!-- KPI cards: each one opens the matching list, or section -->
        <div class="stats stats-vertical lg:stats-horizontal shadow w-full mb-6 bg-base-100">
          <a class="stat hover:bg-base-200" routerLink="/invoices">
            <div class="stat-title">{{ t().dashboard.invoices }}</div>
            <div class="stat-value text-2xl">{{ stats().invoiceCount }}</div>
          </a>
          <a class="stat hover:bg-base-200" routerLink="/invoices" [queryParams]="{ status: 'draft' }">
            <div class="stat-title">{{ t().dashboard.draft }}</div>
            <div class="stat-value text-2xl">{{ stats().draft.count }}</div>
            <div class="stat-desc">{{ stats().draft.total | currency:'CHF':'code':'1.2-2' }}</div>
          </a>
          <a class="stat hover:bg-base-200" routerLink="/invoices" [queryParams]="{ status: 'issued' }">
            <div class="stat-title">{{ t().dashboard.outstanding }}</div>
            <div class="stat-value text-2xl text-warning">{{ stats().issued.count }}</div>
            <div class="stat-desc">{{ stats().issued.total | currency:'CHF':'code':'1.2-2' }}</div>
          </a>
          <button type="button" class="stat text-left hover:bg-base-200 disabled:hover:bg-transparent"
            [disabled]="stats().overdue.count === 0" (click)="scrollToOverdue()">
            <div class="stat-title">{{ t().dashboard.overdue }}</div>
            <div class="stat-value text-2xl" [class.text-error]="stats().overdue.count > 0">
              {{ stats().overdue.count }}
            </div>
            <div class="stat-desc">{{ stats().overdue.total | currency:'CHF':'code':'1.2-2' }}</div>
          </button>
          <a class="stat hover:bg-base-200" routerLink="/invoices" [queryParams]="{ status: 'paid' }">
            <div class="stat-title">{{ t().dashboard.paidThisYear }}</div>
            <div class="stat-value text-2xl text-success">{{ stats().paid.count }}</div>
            <div class="stat-desc">{{ stats().paid.total | currency:'CHF':'code':'1.2-2' }}</div>
          </a>
          <a class="stat hover:bg-base-200" routerLink="/customers">
            <div class="stat-title">{{ t().dashboard.customers }}</div>
            <div class="stat-value text-2xl">{{ stats().customerCount }}</div>
          </a>
          <a class="stat hover:bg-base-200" routerLink="/articles">
            <div class="stat-title">{{ t().dashboard.articles }}</div>
            <div class="stat-value text-2xl">{{ stats().articleCount }}</div>
          </a>
        </div>

        @if (stats().overdueInvoices.length > 0) {
          <div id="overdue" class="card bg-base-100 shadow mb-6 border-l-4 border-error scroll-mt-4">
            <div class="card-body p-4 md:p-6">
              <h2 class="font-semibold text-base mb-3 text-error">{{ t().dashboard.overdueInvoices }}</h2>
              <div class="overflow-x-auto">
                <table class="table table-sm w-full">
                  <thead>
                    <tr>
                      <th class="col-fit hidden sm:table-cell">{{ t().invoices.number }}</th>
                      <th>{{ t().invoices.customer }}</th>
                      <th class="col-fit hidden md:table-cell">{{ t().invoices.due }}</th>
                      <th class="col-fit text-right">{{ t().dashboard.daysLate }}</th>
                      <th class="col-fit text-right">{{ t().dashboard.total }}</th>
                      <th class="col-fit">{{ t().dashboard.reminders }}</th>
                      <th class="col-fit"></th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (inv of stats().overdueInvoices; track inv.id) {
                      <tr>
                        <td class="col-fit font-mono text-xs hidden sm:table-cell">{{ inv.invoiceNumber ?? '—' }}</td>
                        <td class="font-medium">
                          <a [routerLink]="['/customers', inv.customerId]" class="hover:text-primary hover:underline">
                            {{ inv.customerName || '—' }}
                          </a>
                        </td>
                        <td class="col-fit text-sm text-base-content/60 hidden md:table-cell">{{ inv.dueDate | naturalDate }}</td>
                        <td class="col-fit text-right tabular-nums text-error">{{ daysSince(inv.dueDate) }}</td>
                        <td class="col-fit text-right font-medium tabular-nums">{{ inv.total | currency:'CHF':'code':'1.2-2' }}</td>
                        <td class="col-fit text-sm">
                          @if (inv.reminderCount > 0) {
                            <span class="badge badge-warning badge-sm">{{ inv.reminderCount }}</span>
                            <span class="text-base-content/60 hidden sm:inline ml-1.5">{{ inv.lastReminderOn | naturalDate }}</span>
                          } @else { — }
                        </td>
                        <td class="col-fit">
                          <div class="flex justify-end gap-1">
                            <button class="btn btn-ghost btn-sm btn-square tooltip tooltip-left text-warning"
                              [attr.data-tip]="t().invoices.createReminder" [attr.aria-label]="t().invoices.createReminder"
                              (click)="pendingReminder.set(inv)">
                              <app-icon name="reminder" />
                            </button>
                            @if (inv.reminderCount > 0) {
                              <button class="btn btn-ghost btn-sm btn-square tooltip tooltip-left"
                                [attr.data-tip]="t().invoices.downloadPdf" [attr.aria-label]="t().invoices.downloadPdf"
                                (click)="downloadReminder({ inv, number: inv.reminderCount })">
                                <app-icon name="pdf" />
                              </button>
                            }
                          </div>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        }

        <!-- Recent invoices -->
        <div class="card bg-base-100 shadow">
          <div class="card-body p-4 md:p-6">
            <h2 class="font-semibold text-base mb-3">{{ t().dashboard.recentInvoices }}</h2>
            @if (stats().recentInvoices.length === 0) {
              <p class="text-base-content/40 text-sm py-4 text-center">{{ t().dashboard.noInvoices }}</p>
            } @else {
              <div class="overflow-x-auto">
                <table class="table table-sm w-full">
                  <thead>
                    <tr>
                      <th class="col-fit hidden sm:table-cell">{{ t().invoices.number }}</th>
                      <th>{{ t().invoices.customer }}</th>
                      <th class="col-fit hidden md:table-cell">{{ t().invoices.date }}</th>
                      <th class="col-fit text-right">{{ t().dashboard.total }}</th>
                      <th class="col-fit">{{ t().invoices.status }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (inv of stats().recentInvoices; track inv.id) {
                      <tr>
                        <td class="col-fit font-mono text-xs hidden sm:table-cell">{{ inv.invoiceNumber ?? '—' }}</td>
                        <td class="font-medium">
                          <a [routerLink]="['/customers', inv.customerId]" class="hover:text-primary hover:underline">
                            {{ inv.customerName || '—' }}
                          </a>
                        </td>
                        <td class="col-fit text-sm text-base-content/60 hidden md:table-cell">{{ inv.issueDate | naturalDate }}</td>
                        <td class="col-fit text-right font-medium tabular-nums">{{ inv.total | currency:'CHF':'code':'1.2-2' }}</td>
                        <td class="col-fit">
                          <app-invoice-status-badge [status]="inv.status" />
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        </div>
      }
    </div>

    @if (pendingReminder(); as inv) {
      <app-confirm-dialog
        [title]="t().invoices.createReminder"
        [message]="reminderMessage(inv)"
        [confirmLabel]="t().invoices.createReminderAndPrint"
        confirmClass="btn-warning"
        (confirmed)="onReminderConfirmed(inv)"
        (cancelled)="pendingReminder.set(null)" />
    }
  `,
})
export class DashboardComponent {
  private readonly dashboardService = inject(DASHBOARD_SERVICE);
  private readonly invoiceService = inject(INVOICE_SERVICE);
  private readonly i18n = inject(I18nService);
  protected readonly t = this.i18n.T;
  protected readonly daysSince = daysSince;
  protected readonly pendingReminder = signal<OverdueInvoiceItem | null>(null);

  private readonly loaded = rxResource({ stream: () => this.dashboardService.getStats() });
  /** The first load only: a reload after a reminder keeps the figures shown. */
  protected readonly loading = computed(() => this.loaded.status() === 'loading');
  protected readonly stats = computed<DashboardStats>(() => (this.loaded.hasValue() ? this.loaded.value() : EMPTY));

  /** Downloads run side by side (mergeMap); a failed one leaves the others. */
  protected readonly downloadReminder = rxMethod<{ inv: OverdueInvoiceItem; number: number }>(
    mergeMap(({ inv, number }) =>
      this.invoiceService.downloadReminderPdf(inv.id, number, this.i18n.locale()).pipe(
        tapResponse({ next: (pdf) => saveFile(pdf, reminderPdfName(inv, number)), error: () => undefined }),
      ),
    ),
  );

  /** Records the next reminder, refreshes the figures and downloads it; one at a time. */
  protected readonly createReminder = rxMethod<OverdueInvoiceItem>(
    concatMap((inv) =>
      this.invoiceService.createReminder(inv.id).pipe(
        tapResponse({
          next: () => {
            this.loaded.reload();
            this.downloadReminder({ inv, number: inv.reminderCount + 1 });
          },
          error: () => undefined, // errorInterceptor already surfaced a toast
        }),
      ),
    ),
  );

  protected onReminderConfirmed(inv: OverdueInvoiceItem): void {
    this.pendingReminder.set(null);
    this.createReminder(inv);
  }

  protected reminderMessage(inv: OverdueInvoiceItem): string {
    return nextReminderMessage(this.t().invoices.createReminderConfirm, inv, inv.reminderCount);
  }

  protected scrollToOverdue(): void {
    document.getElementById('overdue')?.scrollIntoView({ behavior: 'smooth' });
  }

}
