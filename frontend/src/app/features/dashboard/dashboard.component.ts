import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { ARTICLE_SERVICE } from '../../core/tokens/article-service.token';
import { CUSTOMER_SERVICE } from '../../core/tokens/customer-service.token';
import { INVOICE_SERVICE } from '../../core/tokens/invoice-service.token';
import { Article } from '../articles/article.model';
import { Customer } from '../customers/customer.model';
import { Invoice } from '../invoices/invoice.model';

function invoiceTotal(inv: Invoice): number {
  const sub = inv.lines.reduce((s, l) => s + l.quantity * l.unitPriceSnapshot, 0);
  const disc = sub * inv.discountPercent / 100;
  const vat = inv.lines.reduce((s, l) =>
    l.vatRateSnapshot != null
      ? s + l.quantity * l.unitPriceSnapshot * (1 - inv.discountPercent / 100) * l.vatRateSnapshot
      : s, 0);
  return sub - disc + vat;
}

@Component({
  selector: 'app-dashboard',
  imports: [CurrencyPipe, RouterLink],
  template: `
    <div class="p-6 max-w-5xl mx-auto">
      <h1 class="text-2xl font-bold mb-6">{{ t().dashboard.title }}</h1>

      @if (loading()) {
        <div class="flex justify-center py-12">
          <span class="loading loading-spinner loading-lg"></span>
        </div>
      } @else {
        <!-- KPI cards -->
        <div class="stats stats-vertical lg:stats-horizontal shadow w-full mb-6">
          <div class="stat">
            <div class="stat-title">{{ t().dashboard.draft }}</div>
            <div class="stat-value text-2xl">{{ stats().draftCount }}</div>
            <div class="stat-desc">
              {{ stats().draftTotal | currency:'CHF':'code':'1.2-2' }}
            </div>
          </div>
          <div class="stat">
            <div class="stat-title">{{ t().dashboard.outstanding }}</div>
            <div class="stat-value text-2xl text-info">{{ stats().issuedCount }}</div>
            <div class="stat-desc">
              {{ stats().issuedTotal | currency:'CHF':'code':'1.2-2' }}
            </div>
          </div>
          <div class="stat">
            <div class="stat-title">{{ t().dashboard.paidThisYear }}</div>
            <div class="stat-value text-2xl text-success">{{ stats().paidCount }}</div>
            <div class="stat-desc">
              {{ stats().paidTotal | currency:'CHF':'code':'1.2-2' }}
            </div>
          </div>
          <div class="stat">
            <div class="stat-title">{{ t().dashboard.customers }}</div>
            <div class="stat-value text-2xl">{{ stats().customerCount }}</div>
            <div class="stat-desc">
              <a routerLink="/customers" class="link link-primary text-xs">
                {{ t().nav.customers }}
              </a>
            </div>
          </div>
          <div class="stat">
            <div class="stat-title">{{ t().dashboard.articles }}</div>
            <div class="stat-value text-2xl">{{ stats().articleCount }}</div>
            <div class="stat-desc">
              <a routerLink="/articles" class="link link-primary text-xs">
                {{ t().nav.articles }}
              </a>
            </div>
          </div>
        </div>

        <!-- Recent invoices -->
        <div class="card bg-base-100 shadow">
          <div class="card-body">
            <div class="flex justify-between items-center mb-2">
              <h2 class="card-title text-base">{{ t().dashboard.recentInvoices }}</h2>
              <a routerLink="/invoices" class="btn btn-ghost btn-xs">
                {{ t().nav.invoices }} →
              </a>
            </div>
            @if (recent().length === 0) {
              <p class="text-base-content/40 text-sm">{{ t().dashboard.noInvoices }}</p>
            } @else {
              <table class="table table-sm">
                <thead>
                  <tr>
                    <th>{{ t().invoices.number }}</th>
                    <th>{{ t().invoices.customer }}</th>
                    <th>{{ t().invoices.date }}</th>
                    <th class="text-right">{{ t().dashboard.total }}</th>
                    <th>{{ t().invoices.status }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (inv of recent(); track inv.id) {
                    <tr>
                      <td class="font-mono text-xs">{{ inv.invoiceNumber ?? '—' }}</td>
                      <td>{{ customerName(inv.customerId) }}</td>
                      <td class="text-sm">{{ inv.issueDate ?? '—' }}</td>
                      <td class="text-right">{{ invoiceTotal(inv) | currency:'CHF':'code':'1.2-2' }}</td>
                      <td>
                        <span class="badge badge-sm" [class]="statusClass(inv.status)">
                          {{ t().status[inv.status] }}
                        </span>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class DashboardComponent {
  private readonly invoiceService = inject(INVOICE_SERVICE);
  private readonly customerService = inject(CUSTOMER_SERVICE);
  private readonly articleService = inject(ARTICLE_SERVICE);
  protected readonly t = inject(I18nService).T;

  protected readonly invoices = signal<Invoice[]>([]);
  protected readonly customers = signal<Customer[]>([]);
  protected readonly articles = signal<Article[]>([]);
  protected readonly loading = signal(true);

  protected readonly invoiceTotal = invoiceTotal;

  protected readonly stats = computed(() => {
    const invs = this.invoices();
    const year = new Date().getFullYear();
    const drafts = invs.filter((i) => i.status === 'draft');
    const issued = invs.filter((i) => i.status === 'issued');
    const paid = invs.filter(
      (i) => i.status === 'paid' && i.issueDate?.startsWith(String(year))
    );
    return {
      draftCount: drafts.length,
      draftTotal: drafts.reduce((s, i) => s + invoiceTotal(i), 0),
      issuedCount: issued.length,
      issuedTotal: issued.reduce((s, i) => s + invoiceTotal(i), 0),
      paidCount: paid.length,
      paidTotal: paid.reduce((s, i) => s + invoiceTotal(i), 0),
      customerCount: this.customers().filter((c) => !c.isArchived).length,
      articleCount: this.articles().filter((a) => !a.isArchived).length,
    };
  });

  protected readonly recent = computed(() => this.invoices().slice(0, 5));

  constructor() {
    Promise.all([
      this.invoiceService.getAll(),
      this.customerService.getAll(),
      this.articleService.getAll(),
    ]).then(([invoices, customers, articles]) => {
      this.invoices.set(invoices);
      this.customers.set(customers);
      this.articles.set(articles);
      this.loading.set(false);
    });
  }

  protected customerName(customerId: string): string {
    const c = this.customers().find((x) => x.id === customerId);
    return c ? `${c.lastName}, ${c.firstName}` : '—';
  }

  protected statusClass(status: string): string {
    return (
      { draft: 'badge-neutral', issued: 'badge-info', paid: 'badge-success', cancelled: 'badge-error' }[
        status
      ] ?? 'badge-neutral'
    );
  }
}
