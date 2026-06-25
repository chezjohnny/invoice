import { CurrencyPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { DASHBOARD_SERVICE } from '../../core/tokens/dashboard-service.token';
import { DashboardStats } from '../../core/models/page.model';

@Component({
  selector: 'app-dashboard',
  imports: [CurrencyPipe, RouterLink],
  template: `
    <div class="p-4 md:p-6 max-w-5xl mx-auto">
      <h1 class="text-xl font-bold sm:text-2xl mb-6">{{ t().dashboard.title }}</h1>

      @if (loading()) {
        <div class="flex justify-center py-12">
          <span class="loading loading-spinner loading-lg"></span>
        </div>
      } @else {
        <!-- KPI cards -->
        <div class="stats stats-vertical sm:stats-horizontal shadow w-full mb-6 bg-base-100">
          <div class="stat">
            <div class="stat-title">{{ t().dashboard.draft }}</div>
            <div class="stat-value text-2xl">{{ stats().draft.count }}</div>
            <div class="stat-desc">{{ stats().draft.total | currency:'CHF':'code':'1.2-2' }}</div>
          </div>
          <div class="stat">
            <div class="stat-title">{{ t().dashboard.outstanding }}</div>
            <div class="stat-value text-2xl text-warning">{{ stats().issued.count }}</div>
            <div class="stat-desc">{{ stats().issued.total | currency:'CHF':'code':'1.2-2' }}</div>
          </div>
          <div class="stat">
            <div class="stat-title">{{ t().dashboard.paidThisYear }}</div>
            <div class="stat-value text-2xl text-success">{{ stats().paid.count }}</div>
            <div class="stat-desc">{{ stats().paid.total | currency:'CHF':'code':'1.2-2' }}</div>
          </div>
          <div class="stat">
            <div class="stat-title">{{ t().dashboard.customers }}</div>
            <div class="stat-value text-2xl">{{ stats().customerCount }}</div>
            <div class="stat-desc">
              <a routerLink="/customers" class="link link-primary text-xs">{{ t().nav.customers }}</a>
            </div>
          </div>
          <div class="stat">
            <div class="stat-title">{{ t().dashboard.articles }}</div>
            <div class="stat-value text-2xl">{{ stats().articleCount }}</div>
            <div class="stat-desc">
              <a routerLink="/articles" class="link link-primary text-xs">{{ t().nav.articles }}</a>
            </div>
          </div>
        </div>

        <!-- Recent invoices -->
        <div class="card bg-base-100 shadow">
          <div class="card-body p-4 md:p-6">
            <div class="flex justify-between items-center mb-3">
              <h2 class="font-semibold text-base">{{ t().dashboard.recentInvoices }}</h2>
              <a routerLink="/invoices" class="btn btn-ghost btn-sm text-xs">
                {{ t().nav.invoices }} →
              </a>
            </div>
            @if (stats().recentInvoices.length === 0) {
              <p class="text-base-content/40 text-sm py-4 text-center">{{ t().dashboard.noInvoices }}</p>
            } @else {
              <div class="overflow-x-auto">
                <table class="table table-sm w-full">
                  <thead>
                    <tr>
                      <th class="hidden sm:table-cell">{{ t().invoices.number }}</th>
                      <th>{{ t().invoices.customer }}</th>
                      <th class="hidden md:table-cell">{{ t().invoices.date }}</th>
                      <th class="text-right">{{ t().dashboard.total }}</th>
                      <th>{{ t().invoices.status }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (inv of stats().recentInvoices; track inv.id) {
                      <tr>
                        <td class="font-mono text-xs hidden sm:table-cell">{{ inv.invoiceNumber ?? '—' }}</td>
                        <td class="font-medium">{{ inv.customerName }}</td>
                        <td class="text-sm text-base-content/60 hidden md:table-cell">{{ inv.issueDate ?? '—' }}</td>
                        <td class="text-right font-medium">{{ inv.total | currency:'CHF':'code':'1.2-2' }}</td>
                        <td>
                          <span class="badge badge-sm" [class]="statusClass(inv.status)">
                            {{ statusLabel(inv.status) }}
                          </span>
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
  `,
})
export class DashboardComponent {
  private readonly dashboardService = inject(DASHBOARD_SERVICE);
  protected readonly t = inject(I18nService).T;

  protected readonly loading = signal(true);
  protected readonly stats = signal<DashboardStats>({
    draft: { count: 0, total: 0 },
    issued: { count: 0, total: 0 },
    paid: { count: 0, total: 0 },
    customerCount: 0,
    articleCount: 0,
    recentInvoices: [],
  });

  constructor() {
    this.dashboardService.getStats().then((s) => {
      this.stats.set(s);
      this.loading.set(false);
    });
  }

  protected statusLabel(status: string): string {
    return (this.t().status as Record<string, string>)[status] ?? status;
  }

  protected statusClass(status: string): string {
    return (
      { draft: 'badge-neutral', issued: 'badge-info', paid: 'badge-success', cancelled: 'badge-error' }[status] ??
      'badge-neutral'
    );
  }
}
