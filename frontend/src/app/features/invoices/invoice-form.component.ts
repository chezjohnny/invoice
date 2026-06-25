import { CurrencyPipe } from '@angular/common';
import { Component, computed, effect, inject, input, linkedSignal, output, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CUSTOMER_SERVICE } from '../../core/tokens/customer-service.token';
import { INVOICE_SERVICE } from '../../core/tokens/invoice-service.token';
import { Customer } from '../customers/customer.model';
import { Article } from '../articles/article.model';
import { Invoice, InvoiceCreate } from './invoice.model';

interface LineForm {
  id: string | null;
  articleId: string | null;
  descriptionSnapshot: string;
  quantity: string;
  unitPriceSnapshot: string;
  vatRateSnapshot: string;
}

interface Recommendation {
  articleId: string | null;
  description: string;
  unitPrice: number;
  vatRate: number | null;
}

@Component({
  selector: 'app-invoice-form',
  imports: [CurrencyPipe],
  template: `
    <form (submit)="submit($event)">
      <h3 class="text-lg font-bold mb-4">
        {{ invoice() ? t().invoices.editTitle : t().invoices.newTitle }}
      </h3>

      <fieldset class="fieldset gap-3">
        <!-- Customer section -->
        @if (externalCustomer()) {
          <div>
            <label class="fieldset-label">{{ t().invoices.customerLabel }}</label>
            <p class="py-2 font-medium">{{ externalCustomer()!.lastName }}, {{ externalCustomer()!.firstName }}</p>
          </div>
        } @else {
          <div class="relative">
            <label class="fieldset-label">{{ t().invoices.customerLabel }}</label>
            <input type="text" class="input input-bordered w-full"
              [class.input-error]="submitted() && errors().customerId"
              [value]="customerSearch()"
              (input)="onCustomerSearch(asStr($event))"
              (blur)="onCustomerBlur()"
              [placeholder]="t().common.searchCustomer" />
            @if (showDropdown()) {
              @if (customerResults().length > 0) {
                <ul class="absolute z-50 w-full bg-base-100 border border-base-300 rounded-box shadow-lg mt-1 max-h-48 overflow-y-auto">
                  @for (c of customerResults(); track c.id) {
                    <li class="px-3 py-2 hover:bg-base-200 cursor-pointer text-sm"
                      (mousedown)="selectCustomer(c)">
                      {{ c.lastName }}, {{ c.firstName }}
                      @if (c.city) { <span class="text-base-content/50 text-xs ml-1">— {{ c.city }}</span> }
                    </li>
                  }
                </ul>
              } @else if (customerSearch().trim()) {
                <ul class="absolute z-50 w-full bg-base-100 border border-base-300 rounded-box shadow-lg mt-1">
                  <li class="px-3 py-2 hover:bg-base-200 cursor-pointer text-sm text-primary font-medium"
                    (mousedown)="createCustomerRequested.emit()">
                    + {{ t().invoices.createCustomer }}
                  </li>
                </ul>
              }
            }
            @if (submitted() && errors().customerId) {
              <p class="fieldset-label text-error">{{ errors().customerId }}</p>
            }
          </div>
        }
        @if (articleRecommendations().length > 0) {
          <div class="rounded border border-base-200 p-2">
            <p class="text-xs text-base-content/50 mb-1.5">{{ t().invoices.recommendations }}</p>
            <div class="flex flex-wrap gap-1">
              @for (rec of articleRecommendations(); track rec.description) {
                <button type="button" class="btn btn-outline btn-xs" (click)="addRecommendation(rec)">
                  + {{ rec.description }}
                </button>
              }
            </div>
          </div>
        }

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="fieldset-label">{{ t().invoices.discountLabel }}</label>
            <input class="input w-full" type="number" min="0" max="100" step="0.1"
              [value]="discountPercent()" (input)="discountPercent.set(asStr($event))" />
          </div>
        </div>

        <div>
          <label class="fieldset-label font-semibold">{{ t().invoices.linesLabel }}</label>
          @if (lines().length === 0) {
            <p class="text-sm text-base-content/40 mb-2">{{ t().invoices.noLines }}</p>
          }
          @for (line of lines(); track $index; let i = $index) {
            <div class="border border-base-300 rounded p-3 mb-2 grid grid-cols-12 gap-2 items-end">
              <div class="col-span-4">
                <label class="fieldset-label text-xs">{{ t().invoices.articleLabel }}</label>
                <select class="select select-bordered select-sm w-full"
                  [value]="line.articleId ?? ''"
                  (change)="selectArticle(i, asStr($event))">
                  <option value="">—</option>
                  @for (a of articles(); track a.id) {
                    <option [value]="a.id">{{ a.name }}</option>
                  }
                </select>
              </div>
              <div class="col-span-4">
                <label class="fieldset-label text-xs">{{ t().invoices.descLabel }}</label>
                <input class="input input-sm w-full" type="text"
                  [value]="line.descriptionSnapshot"
                  (input)="updateLine(i, 'descriptionSnapshot', asStr($event))" />
              </div>
              <div class="col-span-1">
                <label class="fieldset-label text-xs">{{ t().invoices.qtyLabel }}</label>
                <input class="input input-sm w-full" type="number" min="1" step="1"
                  [value]="line.quantity"
                  (input)="updateLine(i, 'quantity', asStr($event))" />
              </div>
              <div class="col-span-1">
                <label class="fieldset-label text-xs">{{ t().invoices.priceLabel }}</label>
                <input class="input input-sm w-full" type="number" min="0" step="0.01"
                  [value]="line.unitPriceSnapshot"
                  (input)="updateLine(i, 'unitPriceSnapshot', asStr($event))" />
              </div>
              <div class="col-span-1">
                <label class="fieldset-label text-xs">{{ t().invoices.vatLabel }}</label>
                <input class="input input-sm w-full" type="number" min="0" max="100" step="0.1"
                  placeholder="—"
                  [value]="line.vatRateSnapshot"
                  (input)="updateLine(i, 'vatRateSnapshot', asStr($event))" />
              </div>
              <div class="col-span-1 flex flex-col items-end gap-1">
                @if (lineStockWarning(line)) {
                  <span class="badge badge-warning badge-xs" [title]="t().articles.lowStockWarning">!</span>
                }
                <button type="button" class="btn btn-ghost btn-xs text-error"
                  (click)="removeLine(i)">✕</button>
              </div>
            </div>
          }
          <button type="button" class="btn btn-ghost btn-sm" (click)="addLine()">
            {{ t().invoices.addLine }}
          </button>
        </div>

        @if (lines().length > 0) {
          <div class="text-sm text-right text-base-content/70 border-t border-base-200 pt-2">
            <span class="mr-4">
              {{ t().dashboard.total }}: {{ totals().subtotal | currency:'CHF':'code':'1.2-2' }}
            </span>
            @if (totals().discountAmount > 0) {
              <span class="mr-4">
                -{{ totals().discountAmount | currency:'CHF':'code':'1.2-2' }}
              </span>
            }
            <strong>{{ t().invoices.total }}: {{ totals().total | currency:'CHF':'code':'1.2-2' }}</strong>
          </div>
        }

        <div>
          <label class="fieldset-label">{{ t().invoices.notesLabel }}</label>
          <textarea class="textarea textarea-bordered w-full" rows="3"
            [value]="notes()" (input)="notes.set(asStr($event))"></textarea>
        </div>
      </fieldset>

      <div class="flex justify-end gap-2 mt-6">
        <button type="button" class="btn btn-ghost" (click)="cancelled.emit()">
          {{ t().common.cancel }}
        </button>
        <button type="button" class="btn btn-outline" (click)="submitAndIssue()">
          {{ t().invoices.issueAndPrint }}
        </button>
        <button type="submit" class="btn btn-primary">{{ t().invoices.saveDraft }}</button>
      </div>
    </form>
  `,
})
export class InvoiceFormComponent {
  readonly invoice = input<InvoiceType | null>(null);
  readonly articles = input<Article[]>([]);
  readonly externalCustomer = input<Customer | null>(null);
  readonly saved = output<InvoiceCreate>();
  readonly cancelled = output<void>();
  readonly createCustomerRequested = output<void>();
  readonly issuedAndPrinted = output<InvoiceCreate>();

  protected readonly t = inject(I18nService).T;
  private readonly customerService = inject(CUSTOMER_SERVICE);
  private readonly invoiceService = inject(INVOICE_SERVICE);

  protected readonly customerId = linkedSignal(() =>
    this.invoice()?.customerId ?? this.externalCustomer()?.id ?? ''
  );
  protected readonly discountPercent = linkedSignal(() =>
    this.invoice() != null ? String(this.invoice()!.discountPercent) : '0'
  );
  protected readonly notes = linkedSignal(() => this.invoice()?.notes ?? '');
  protected readonly submitted = linkedSignal(() => { this.invoice(); return false; });

  protected readonly customerSearch = linkedSignal(() => {
    const ext = this.externalCustomer();
    if (ext) return `${ext.lastName}, ${ext.firstName}`;
    return this.invoice()?.customerName ?? '';
  });
  protected readonly customerResults = signal<Customer[]>([]);
  protected readonly showDropdown = signal(false);
  protected readonly recentInvoices = signal<Invoice[]>([]);
  private searchTimer?: ReturnType<typeof setTimeout>;

  protected readonly articleRecommendations = computed<Recommendation[]>(() => {
    const seen = new Set<string>();
    const recs: Recommendation[] = [];
    for (const inv of this.recentInvoices()) {
      for (const line of inv.lines) {
        const key = line.articleId ?? line.descriptionSnapshot;
        if (!seen.has(key)) {
          seen.add(key);
          recs.push({
            articleId: line.articleId,
            description: line.descriptionSnapshot,
            unitPrice: line.unitPriceSnapshot,
            vatRate: line.vatRateSnapshot,
          });
          if (recs.length >= 5) return recs;
        }
      }
    }
    return recs;
  });

  protected readonly lines = linkedSignal<LineForm[]>(() =>
    this.invoice()?.lines.map((l) => ({
      id: l.id,
      articleId: l.articleId,
      descriptionSnapshot: l.descriptionSnapshot,
      quantity: String(l.quantity),
      unitPriceSnapshot: String(l.unitPriceSnapshot),
      vatRateSnapshot: l.vatRateSnapshot != null ? String(l.vatRateSnapshot * 100) : '',
    })) ?? []
  );

  protected readonly errors = computed(() => ({
    customerId: this.customerId() === '' ? this.t().invoices.customerRequired : null,
  }));

  protected readonly isValid = computed(() =>
    Object.values(this.errors()).every((e) => e === null)
  );

  protected readonly totals = computed(() => {
    const disc = parseFloat(this.discountPercent()) || 0;
    const subtotal = this.lines().reduce((sum, l) => {
      return sum + (parseInt(l.quantity) || 0) * (parseFloat(l.unitPriceSnapshot) || 0);
    }, 0);
    const discountAmount = (subtotal * disc) / 100;
    return { subtotal, discountAmount, total: subtotal - discountAmount };
  });

  constructor() {
    effect(() => {
      const customer = this.externalCustomer();
      if (customer) {
        this.invoiceService
          .list({ customerId: customer.id, perPage: 5 })
          .then((page) => this.recentInvoices.set(page.items));
      }
    });
  }

  protected onCustomerSearch(value: string): void {
    this.customerSearch.set(value);
    this.customerId.set('');
    clearTimeout(this.searchTimer);
    if (!value.trim()) {
      this.customerResults.set([]);
      this.recentInvoices.set([]);
      this.showDropdown.set(false);
      return;
    }
    this.searchTimer = setTimeout(async () => {
      const page = await this.customerService.list({ search: value, perPage: 10 });
      this.customerResults.set(page.items);
      this.showDropdown.set(true);
    }, 300);
  }

  protected selectCustomer(customer: Customer): void {
    this.customerId.set(customer.id);
    this.customerSearch.set(`${customer.lastName}, ${customer.firstName}`);
    this.showDropdown.set(false);
    this.customerResults.set([]);
    this.invoiceService
      .list({ customerId: customer.id, perPage: 5 })
      .then((page) => this.recentInvoices.set(page.items));
  }

  protected onCustomerBlur(): void {
    setTimeout(() => this.showDropdown.set(false), 200);
  }

  protected addRecommendation(rec: Recommendation): void {
    this.lines.update((ls) => [
      ...ls,
      {
        id: null,
        articleId: rec.articleId,
        descriptionSnapshot: rec.description,
        quantity: '1',
        unitPriceSnapshot: String(rec.unitPrice),
        vatRateSnapshot: rec.vatRate != null ? String(rec.vatRate * 100) : '',
      },
    ]);
  }

  protected addLine(): void {
    this.lines.update((ls) => [
      ...ls,
      { id: null, articleId: null, descriptionSnapshot: '', quantity: '1', unitPriceSnapshot: '', vatRateSnapshot: '' },
    ]);
  }

  protected removeLine(index: number): void {
    this.lines.update((ls) => ls.filter((_, i) => i !== index));
  }

  protected updateLine(index: number, field: keyof LineForm, value: string): void {
    this.lines.update((ls) =>
      ls.map((l, i) => (i === index ? { ...l, [field]: value } : l))
    );
  }

  protected selectArticle(index: number, articleId: string): void {
    const article = this.articles().find((a) => a.id === articleId);
    this.lines.update((ls) =>
      ls.map((l, i) =>
        i === index
          ? {
              ...l,
              articleId: article ? articleId : null,
              descriptionSnapshot: article ? article.name : '',
              unitPriceSnapshot: article ? String(article.unitPrice) : '',
              vatRateSnapshot: article?.vatRateOverride != null
                ? String(article.vatRateOverride * 100)
                : '',
            }
          : l
      )
    );
  }

  protected lineStockWarning(line: LineForm): boolean {
    if (!line.articleId) return false;
    const article = this.articles().find((a) => a.id === line.articleId);
    return article != null && article.stockQuantity <= 0;
  }

  protected asStr(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected submitAndIssue(): void {
    this.submitted.set(true);
    if (!this.isValid()) return;
    this.issuedAndPrinted.emit(this._buildPayload());
  }

  submit(event: Event): void {
    event.preventDefault();
    this.submitted.set(true);
    if (!this.isValid()) return;
    this.saved.emit(this._buildPayload());
  }

  private _buildPayload(): InvoiceCreate {
    return {
      customerId: this.customerId(),
      discountPercent: parseFloat(this.discountPercent()) || 0,
      notes: this.notes().trim(),
      lines: this.lines().map((l) => ({
        articleId: l.articleId,
        descriptionSnapshot: l.descriptionSnapshot.trim(),
        quantity: parseInt(l.quantity) || 1,
        unitPriceSnapshot: parseFloat(l.unitPriceSnapshot) || 0,
        vatRateSnapshot:
          l.vatRateSnapshot.trim() !== '' ? parseFloat(l.vatRateSnapshot) / 100 : null,
      })),
    };
  }
}

// avoid import cycle — inline type
type InvoiceType = import('./invoice.model').Invoice;
