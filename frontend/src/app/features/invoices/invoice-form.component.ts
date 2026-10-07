import { CurrencyPipe } from '@angular/common';
import { Component, computed, effect, inject, input, linkedSignal, output, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { FormActionsComponent } from '../../shared/components/form-actions.component';
import { inputValue } from '../../shared/events';
import { isPercent, percentFromRate, rateFromPercent } from '../../shared/percent';
import { INVOICE_SERVICE } from '../../core/tokens/invoice-service.token';
import { Customer, customerDisplayName } from '../customers/customer.model';
import { Article } from '../articles/article.model';
import { Invoice, InvoiceCreate, PAYMENT_METHODS, PaymentMethod, invoiceAmounts } from './invoice.model';

interface LineForm {
  articleId: string | null;
  descriptionSnapshot: string;
  quantity: string;
  unitPriceSnapshot: string;
  vatRateSnapshot: string;
}

const MAX_RECOMMENDATIONS = 10;
// Enough recent invoices to usually find MAX_RECOMMENDATIONS distinct articles.
const RECENT_INVOICES = 20;
const MAX_ARTICLE_RESULTS = 20;

function searchKey(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

interface Recommendation {
  description: string;
  /** Active article: added with its current price and VAT. */
  article: Article | null;
  /** A free-text line's own price and VAT. */
  unitPrice: number;
  vatRate: number | null;
  /** Its article is archived: shown, but no longer offered. */
  archived: boolean;
}

@Component({
  selector: 'app-invoice-form',
  imports: [CurrencyPipe, FormActionsComponent],
  template: `
    <form (submit)="submit($event)">
      <h1 class="text-xl font-bold sm:text-2xl mb-5">
        {{ invoice() ? t().invoices.editTitle : t().invoices.newTitle }}
      </h1>

      <fieldset class="fieldset gap-4">
        <!-- Customer: fixed, an invoice is always started from its customer's page -->
        <div>
          <span class="fieldset-label">{{ t().invoices.customerLabel }}</span>
          <p class="py-2 font-medium">{{ displayName(customer()) }}</p>
        </div>

        <!-- Recommendations -->
        @if (articleRecommendations().length > 0) {
          <div class="rounded-lg border border-base-300 bg-base-200/50 p-3">
            <p class="text-xs text-base-content/50 mb-2">{{ t().invoices.recommendations }}</p>
            <div class="flex flex-wrap gap-1.5">
              @for (rec of articleRecommendations(); track rec.description) {
                @if (rec.archived) {
                  <span class="tooltip" [attr.data-tip]="t().invoices.archivedArticle">
                    <button type="button" class="btn btn-outline btn-xs" disabled>{{ rec.description }}</button>
                  </span>
                } @else {
                  <button type="button" class="btn btn-outline btn-xs" (click)="addRecommendation(rec)">
                    + {{ rec.description }}
                  </button>
                }
              }
            </div>
          </div>
        }

        <!-- Lines -->
        <div>
          <span class="fieldset-label font-semibold mb-2">{{ t().invoices.linesLabel }}</span>

          <!-- Always at hand: each article picked is added (or its quantity raised) -->
          <div class="relative mb-3">
            <input class="input w-full" type="text" role="combobox" autocomplete="off"
              aria-autocomplete="list" aria-controls="article-options"
              [attr.aria-label]="t().invoices.addArticle" [placeholder]="t().invoices.addArticle"
              [attr.aria-expanded]="pickerOpen()"
              [attr.aria-activedescendant]="pickerOpen() ? 'article-option-' + activeOption() : null"
              [value]="articleQuery()"
              (input)="onPickerInput(inputValue($event))" (keydown)="onPickerKey($event)"
              (focus)="pickerFocused.set(true)" (blur)="pickerFocused.set(false)" />
            @if (pickerOpen()) {
              <ul id="article-options" role="listbox"
                class="absolute z-50 w-full bg-base-100 border border-base-300 rounded-box shadow-lg mt-1 max-h-60 overflow-y-auto">
                @for (a of pickerResults(); track a.id; let k = $index) {
                  <li role="option" [id]="'article-option-' + k" [attr.aria-selected]="k === activeOption()"
                    class="px-3 py-2 cursor-pointer text-sm flex justify-between gap-2"
                    [class.bg-base-200]="k === activeOption()"
                    (mouseenter)="activeOption.set(k)"
                    (mousedown)="$event.preventDefault(); addArticle(a)">
                    <span class="truncate">{{ a.name }}</span>
                    <span class="text-base-content/50 text-xs shrink-0 tabular-nums">
                      {{ a.unitPrice | currency:'CHF':'code':'1.2-2' }} · {{ a.stockQuantity }}
                    </span>
                  </li>
                }
              </ul>
            }
          </div>

          @if (lines().length > 0) {
            <div>
              <!-- Column headers -->
              <div class="grid items-end gap-x-2 px-0.5 mb-1 text-xs text-base-content/50"
                   style="grid-template-columns: minmax(0,1fr) 3.5rem 5.5rem 3.5rem 1.75rem">
                <span>{{ t().invoices.articleLabel }}</span>
                <span>{{ t().invoices.qtyLabel }}</span>
                <span>{{ t().invoices.priceLabel }}</span>
                <span>{{ t().invoices.vatLabel }}</span>
                <span></span>
              </div>
              <!-- One row per line -->
              @for (line of lines(); track $index; let i = $index) {
                <div class="grid items-center gap-x-2 px-0.5 mb-1"
                     style="grid-template-columns: minmax(0,1fr) 3.5rem 5.5rem 3.5rem 1.75rem">
                  <!-- An article line shows its article; a free-text line is typed -->
                  <div class="min-w-0">
                    @if (line.articleId !== null) {
                      <div class="input input-sm input-primary w-full">
                        <span class="badge badge-xs badge-primary shrink-0">{{ t().invoices.articleLabel }}</span>
                        <span class="truncate" [title]="line.descriptionSnapshot">{{ line.descriptionSnapshot }}</span>
                      </div>
                    } @else {
                      <label class="input input-sm w-full"
                        [class.input-error]="submitted() && lineErrors()[i].description">
                        <span class="badge badge-xs badge-ghost shrink-0">{{ t().invoices.freeText }}</span>
                        <input class="grow min-w-0" type="text" autocomplete="off"
                          [attr.aria-label]="t().invoices.descLabel" [placeholder]="t().invoices.descLabel"
                          [attr.aria-invalid]="submitted() && lineErrors()[i].description"
                          [value]="line.descriptionSnapshot"
                          (input)="updateLine(i, 'descriptionSnapshot', inputValue($event))" />
                      </label>
                    }
                  </div>
                  <!-- Qty -->
                  <input class="input input-sm w-full" type="number" min="1" step="1"
                    [class.input-error]="submitted() && lineErrors()[i].quantity"
                    [attr.aria-invalid]="submitted() && lineErrors()[i].quantity"
                    [value]="line.quantity"
                    (input)="updateLine(i, 'quantity', inputValue($event))" />
                  <!-- Price -->
                  <input class="input input-sm w-full" type="number" min="0" step="0.01"
                    [class.input-error]="submitted() && lineErrors()[i].price"
                    [attr.aria-invalid]="submitted() && lineErrors()[i].price"
                    [value]="line.unitPriceSnapshot"
                    (input)="updateLine(i, 'unitPriceSnapshot', inputValue($event))" />
                  <!-- VAT% -->
                  <input class="input input-sm w-full" type="number" min="0" max="100" step="0.1"
                    placeholder="—"
                    [class.input-error]="submitted() && lineErrors()[i].vat"
                    [attr.aria-invalid]="submitted() && lineErrors()[i].vat"
                    [value]="line.vatRateSnapshot"
                    (input)="updateLine(i, 'vatRateSnapshot', inputValue($event))" />
                  <!-- Delete + warning -->
                  <div class="flex items-center justify-end gap-0.5">
                    @if (lineStockWarning(line)) {
                      <span class="badge badge-warning badge-xs" [title]="t().articles.lowStockWarning">!</span>
                    }
                    <button type="button" class="btn btn-ghost btn-xs text-error px-1"
                      (click)="removeLine(i)">✕</button>
                  </div>
                </div>
              }
            </div>
          } @else {
            <p class="text-sm text-base-content/40 mb-2">{{ t().invoices.noLines }}</p>
          }

          <button type="button" class="btn btn-ghost btn-sm mt-1" (click)="addLine()">
            {{ t().invoices.addFreeText }}
          </button>
        </div>

        <!-- Totals summary -->
        @if (lines().length > 0) {
          <div class="text-sm text-right text-base-content/70 border-t border-base-200 pt-3 space-y-0.5">
            <div>{{ t().invoices.subtotal }}: <span class="tabular-nums">{{ totals().subtotal | currency:'CHF':'code':'1.2-2' }}</span></div>
            @if (totals().discountAmount > 0) {
              <div class="text-error">− {{ totals().discountAmount | currency:'CHF':'code':'1.2-2' }}</div>
            }
            @if (totals().vatAmount > 0) {
              <div>{{ t().invoices.vatAmount }}: <span class="tabular-nums">{{ totals().vatAmount | currency:'CHF':'code':'1.2-2' }}</span></div>
            }
            <div class="font-semibold text-base-content">
              {{ t().invoices.total }}: <span class="tabular-nums">{{ totals().total | currency:'CHF':'code':'1.2-2' }}</span>
            </div>
          </div>
        }

        <!-- Notes: folded away unless the invoice already has some -->
        <details class="collapse collapse-arrow border border-base-300 rounded-box" [open]="!!invoice()?.notes">
          <summary class="collapse-title min-h-0 py-2 text-sm font-medium">{{ t().invoices.notesLabel }}</summary>
          <div class="collapse-content">
            <textarea class="textarea textarea-bordered w-full" rows="2"
              [attr.aria-label]="t().invoices.notesLabel"
              [value]="notes()" (input)="notes.set(inputValue($event))"></textarea>
          </div>
        </details>

        <div class="flex flex-col sm:flex-row gap-4">
          <!-- Payment method -->
          <div class="w-full sm:max-w-48">
            <label class="fieldset-label" for="invoice-payment-method">{{ t().invoices.paymentMethodLabel }}</label>
            <select id="invoice-payment-method" class="select w-full" (change)="paymentMethod.set(inputValue($event))">
              @for (method of paymentMethods; track method) {
                <option [value]="method" [selected]="paymentMethod() === method">
                  {{ t().paymentMethod[method] }}
                </option>
              }
            </select>
          </div>

          <!-- Discount -->
          <div class="w-full sm:max-w-48">
            <label class="fieldset-label" for="invoice-discount">{{ t().invoices.discountLabel }}</label>
            <input id="invoice-discount" class="input w-full" [class.input-error]="submitted() && discountError()"
              type="number" min="0" max="100" step="0.1"
              [value]="discountPercent()" (input)="discountPercent.set(inputValue($event))" />
            @if (submitted() && discountError()) {
              <p class="fieldset-label text-error mt-1">{{ t().common.invalidPercent }}</p>
            }
          </div>
        </div>
      </fieldset>

      <app-form-actions [submitLabel]="t().invoices.saveDraft" [busy]="busy()" (cancelled)="cancelled.emit()">
        <span class="tooltip-left" [class.tooltip]="!!issueBlockedReason()" [attr.data-tip]="issueBlockedReason()">
          <button type="button" class="btn btn-outline" (click)="submitAndIssue()"
            [disabled]="busy() || !!issueBlockedReason()">
            {{ paymentMethod() === 'cash' ? t().invoices.payAndPrint : t().invoices.issueAndPrint }}
          </button>
        </span>
      </app-form-actions>
    </form>
  `,
})
export class InvoiceFormComponent {
  readonly invoice = input<Invoice | null>(null);
  readonly articles = input<Article[]>([]);
  readonly archivedArticles = input<Article[]>([]);
  readonly customer = input.required<Customer>();
  // Issuing needs a complete company profile (address + IBAN) for the QR-bill.
  readonly canIssue = input(true);
  /** The company's rate, for the articles without one of their own; null when not VAT-registered. */
  readonly defaultVatRate = input<number | null>(null);
  readonly busy = input(false);
  readonly saved = output<InvoiceCreate>();
  readonly cancelled = output<void>();
  readonly issuedAndPrinted = output<InvoiceCreate>();

  protected readonly t = inject(I18nService).T;
  protected readonly displayName = customerDisplayName;
  protected readonly inputValue = inputValue;
  private readonly invoiceService = inject(INVOICE_SERVICE);

  protected readonly discountPercent = linkedSignal(() =>
    this.invoice() != null ? String(this.invoice()!.discountPercent) : '0'
  );
  protected readonly notes = linkedSignal(() => this.invoice()?.notes ?? '');
  protected readonly paymentMethod = linkedSignal<PaymentMethod>(() => this.invoice()?.paymentMethod ?? 'cash');
  protected readonly paymentMethods = PAYMENT_METHODS;

  protected readonly recentInvoices = signal<Invoice[]>([]);
  protected readonly articleQuery = signal('');
  protected readonly pickerFocused = signal(false);
  protected readonly activeOption = signal(0);
  protected readonly pickerResults = computed(() => {
    const words = searchKey(this.articleQuery()).split(/\s+/).filter(Boolean);
    if (words.length === 0) return [];
    return this.articles()
      .filter((a) => words.every((w) => searchKey(a.name).includes(w)))
      .slice(0, MAX_ARTICLE_RESULTS);
  });
  protected readonly pickerOpen = computed(() => this.pickerFocused() && this.pickerResults().length > 0);

  // What the customer bought lately. Imported invoices often name an article in a
  // free-text line: matched by name, it counts as that article, active or archived.
  protected readonly articleRecommendations = computed<Recommendation[]>(() => {
    const byId = new Map(this.articles().map((a) => [a.id, a]));
    const byName = new Map(this.articles().map((a) => [searchKey(a.name), a]));
    const archivedIds = new Set(this.archivedArticles().map((a) => a.id));
    const archivedNames = new Set(this.archivedArticles().map((a) => searchKey(a.name)));
    const seen = new Set<string>();
    const recs: Recommendation[] = [];
    for (const inv of this.recentInvoices()) {
      for (const line of inv.lines) {
        const name = searchKey(line.descriptionSnapshot);
        const article = (line.articleId ? byId.get(line.articleId) : byName.get(name)) ?? null;
        const archived =
          article === null && (line.articleId ? archivedIds.has(line.articleId) : archivedNames.has(name));
        // A deleted article is neither offered nor shown.
        if (line.articleId && article === null && !archived) continue;
        const key = article?.id ?? name;
        if (seen.has(key)) continue;
        seen.add(key);
        recs.push({
          description: article?.name ?? line.descriptionSnapshot,
          article,
          unitPrice: line.unitPriceSnapshot,
          vatRate: line.vatRateSnapshot,
          archived,
        });
        if (recs.length >= MAX_RECOMMENDATIONS) return recs;
      }
    }
    return recs;
  });

  protected readonly lines = linkedSignal<LineForm[]>(() =>
    this.invoice()?.lines.map((l) => ({
      articleId: l.articleId,
      descriptionSnapshot: l.descriptionSnapshot,
      quantity: String(l.quantity),
      unitPriceSnapshot: String(l.unitPriceSnapshot),
      vatRateSnapshot: percentFromRate(l.vatRateSnapshot),
    })) ?? []
  );

  // The same total as the list, the PDF and the pay dialog: VAT included.
  protected readonly totals = computed(() => {
    const { discountPercent, lines } = this._buildPayload();
    const { subtotal, discount, vat, total } = invoiceAmounts({ discountPercent, lines });
    return { subtotal, discountAmount: discount, vatAmount: vat.reduce((sum, v) => sum + v.amount, 0), total };
  });

  constructor() {
    effect(() => {
      this.invoiceService
        .list({ customerId: this.customer().id, perPage: RECENT_INVOICES })
        .then((page) => this.recentInvoices.set(page.items));
    });
  }

  protected addRecommendation(rec: Recommendation): void {
    if (rec.article) {
      this.addArticle(rec.article);
      return;
    }
    this.lines.update((ls) => [
      ...ls,
      {
        articleId: null,
        descriptionSnapshot: rec.description,
        quantity: '1',
        unitPriceSnapshot: String(rec.unitPrice),
        vatRateSnapshot: percentFromRate(rec.vatRate),
      },
    ]);
  }

  protected addLine(): void {
    this.lines.update((ls) => [
      ...ls,
      {
        articleId: null,
        descriptionSnapshot: '',
        quantity: '1',
        unitPriceSnapshot: '',
        vatRateSnapshot: percentFromRate(this.defaultVatRate()),
      },
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

  protected onPickerInput(value: string): void {
    this.articleQuery.set(value);
    this.activeOption.set(0);
  }

  protected onPickerKey(event: KeyboardEvent): void {
    const count = this.pickerResults().length;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.activeOption.update((k) => Math.min(k + 1, count - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.activeOption.update((k) => Math.max(k - 1, 0));
        break;
      case 'Enter':
        // Never submits the form from here: Enter picks the article.
        event.preventDefault();
        if (count > 0) this.addArticle(this.pickerResults()[this.activeOption()]);
        break;
      case 'Escape':
        this.articleQuery.set('');
        break;
    }
  }

  /** Adds the article, or one more of it when it is already on the invoice. */
  protected addArticle(article: Article): void {
    const index = this.lines().findIndex((l) => l.articleId === article.id);
    if (index >= 0) {
      const quantity = parseInt(this.lines()[index].quantity, 10);
      this.updateLine(index, 'quantity', String(Number.isFinite(quantity) ? quantity + 1 : 1));
    } else {
      this.lines.update((ls) => [
        ...ls,
        {
          articleId: article.id,
          descriptionSnapshot: article.name,
          quantity: '1',
          unitPriceSnapshot: String(article.unitPrice),
          vatRateSnapshot: percentFromRate(article.vatRateOverride ?? this.defaultVatRate()),
        },
      ]);
    }
    this.articleQuery.set('');
    this.activeOption.set(0);
  }

  protected lineStockWarning(line: LineForm): boolean {
    if (!line.articleId) return false;
    const article = this.articles().find((a) => a.id === line.articleId);
    return article != null && article.stockQuantity < Number(line.quantity);
  }

  protected readonly submitted = linkedSignal(() => { this.invoice(); return false; });

  protected readonly lineErrors = computed(() =>
    this.lines().map((l) => ({
      description: l.articleId === null && l.descriptionSnapshot.trim() === '',
      quantity: !/^\d+$/.test(l.quantity.trim()) || parseInt(l.quantity, 10) < 1,
      price: l.unitPriceSnapshot.trim() === '' || !(Number(l.unitPriceSnapshot) >= 0),
      vat: !isPercent(l.vatRateSnapshot),
    }))
  );
  protected readonly discountError = computed(() => !isPercent(this.discountPercent()));
  private readonly isValid = computed(
    () => !this.discountError() && this.lineErrors().every((e) => !e.description && !e.quantity && !e.price && !e.vat)
  );

  // A draft may be saved empty, but an invoice without any article is never issued.
  protected readonly issueBlockedReason = computed(() => {
    if (this.lines().length === 0) return this.t().invoices.noLinesBlocked;
    return this.canIssue() ? null : this.t().invoices.issueBlocked;
  });

  protected submitAndIssue(): void {
    this.submitted.set(true);
    if (this.issueBlockedReason() || !this.isValid()) return;
    this.issuedAndPrinted.emit(this._buildPayload());
  }

  submit(event: Event): void {
    event.preventDefault();
    this.submitted.set(true);
    if (!this.isValid()) return;
    this.saved.emit(this._buildPayload());
  }

  // Also run while typing, for the totals: anything not yet a number counts as 0.
  private _buildPayload(): InvoiceCreate {
    const num = (text: string) => (Number.isFinite(Number(text)) ? Number(text) : 0);
    return {
      customerId: this.customer().id,
      discountPercent: num(this.discountPercent()),
      notes: this.notes().trim(),
      paymentMethod: this.paymentMethod(),
      lines: this.lines().map((l) => ({
        articleId: l.articleId,
        descriptionSnapshot: l.descriptionSnapshot.trim(),
        quantity: Math.trunc(num(l.quantity)),
        unitPriceSnapshot: num(l.unitPriceSnapshot),
        vatRateSnapshot: isPercent(l.vatRateSnapshot) ? rateFromPercent(l.vatRateSnapshot) : null,
      })),
    };
  }
}

