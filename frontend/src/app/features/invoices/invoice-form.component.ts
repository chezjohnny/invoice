import { CdkDrag, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, input, linkedSignal, output, resource } from '@angular/core';
import { FormField, FormRoot, applyEach, form, min, required, submit, validate } from '@angular/forms/signals';
import { I18nService } from '../../core/i18n/i18n.service';
import { FieldErrorComponent } from '../../shared/components/field-error.component';
import { DecimalInputDirective } from '../../shared/decimal-input.directive';
import { FormActionsComponent } from '../../shared/components/form-actions.component';
import { IconComponent } from '../../shared/components/icon.component';
import { integer, percent, showsError } from '../../shared/form-errors';
import { searchKey } from '../../shared/search-key';
import { ArticlePickerComponent } from '../articles/article-picker.component';
import { percentOf, rateOf } from '../../shared/percent';
import { INVOICE_SERVICE } from '../../core/tokens/invoice-service.token';
import { Customer, customerDisplayName } from '../customers/customer.model';
import { Article } from '../articles/article.model';
import { Invoice, InvoiceCreate, PAYMENT_METHODS, PaymentMethod, invoiceAmounts } from './invoice.model';

interface LineModel {
  articleId: string | null;
  descriptionSnapshot: string;
  quantity: number | null;
  unitPriceSnapshot: number | null;
  /** 8.1 for 8.1 %; null: no VAT. */
  vatPercent: number | null;
  /** Given away: price 0 and no VAT, neither of them editable. */
  offered: boolean;
}

interface InvoiceModel {
  discountPercent: number | null;
  notes: string;
  paymentMethod: PaymentMethod;
  lines: LineModel[];
}

const MAX_RECOMMENDATIONS = 10;
// Enough recent invoices to usually find MAX_RECOMMENDATIONS distinct articles.
const RECENT_INVOICES = 20;

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
  imports: [ArticlePickerComponent, CdkDrag, CdkDragHandle, CdkDropList, CurrencyPipe, DecimalInputDirective, FieldErrorComponent, FormActionsComponent, FormField, FormRoot, IconComponent],
  template: `
    <form [formRoot]="invoiceForm">
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
          <app-article-picker class="mb-3" autofocus [articles]="articles()"
            [placeholder]="t().invoices.addArticle" (picked)="addArticle($event)" />

          @if (model().lines.length > 0) {
            <div>
              <!-- Column headers -->
              <div class="grid items-end gap-x-2 px-0.5 mb-1 text-xs text-base-content/50"
                   style="grid-template-columns: 1.25rem minmax(0,1fr) 3.5rem 5.5rem 3.5rem 1.75rem">
                <span></span>
                <span>{{ t().invoices.articleLabel }}</span>
                <span>{{ t().invoices.qtyLabel }}</span>
                <span>{{ t().invoices.priceLabel }}</span>
                <span>{{ t().invoices.vatLabel }}</span>
                <span></span>
              </div>
              <!-- A block per sold (or free-text) line, with the offered lines of its
                   article right below it: dragged by its handle, they move together -->
              <div cdkDropList cdkDropListLockAxis="y" (cdkDropListDropped)="moveBlock($event.previousIndex, $event.currentIndex)">
                @for (block of blocks(); track model().lines[block[0]]; let b = $index) {
                  <div cdkDrag class="rounded-box bg-base-100">
                    @for (i of block; track model().lines[i]) {
                      @let line = invoiceForm.lines[i];
                      <div class="grid items-center gap-x-2 px-0.5 mb-1"
                           style="grid-template-columns: 1.25rem minmax(0,1fr) 3.5rem 5.5rem 3.5rem 1.75rem">
                        <div class="flex justify-center">
                          @if (i === block[0]) {
                            <button type="button" cdkDragHandle
                              class="btn btn-ghost btn-xs px-0 cursor-grab touch-none text-base-content/50"
                              [attr.aria-label]="t().invoices.dragLine" [title]="t().invoices.dragLine"
                              (keydown.arrowup)="$event.preventDefault(); moveBlock(b, b - 1)"
                              (keydown.arrowdown)="$event.preventDefault(); moveBlock(b, b + 1)">
                              <app-icon name="grip" />
                            </button>
                          }
                        </div>
                        <!-- An article line shows its article; a free-text line is typed -->
                        <div class="min-w-0">
                          @if (line.offered().value()) {
                            <div class="input input-sm input-secondary w-full">
                              <span class="badge badge-xs badge-secondary shrink-0">{{ t().invoices.offered }}</span>
                              <span class="truncate" [title]="line.descriptionSnapshot().value()">{{ line.descriptionSnapshot().value() }}</span>
                            </div>
                          } @else if (line.articleId().value() !== null) {
                            <div class="input input-sm input-primary w-full pr-1">
                              <span class="badge badge-xs badge-primary shrink-0">{{ t().invoices.articleLabel }}</span>
                              <span class="truncate grow" [title]="line.descriptionSnapshot().value()">{{ line.descriptionSnapshot().value() }}</span>
                              <button type="button" class="btn btn-ghost btn-xs px-1 shrink-0"
                                [title]="t().invoices.offer" [attr.aria-label]="t().invoices.offer" (click)="offer(i)">
                                <app-icon name="gift" />
                              </button>
                            </div>
                          } @else {
                            <label class="input input-sm w-full" [class.input-error]="showsError(line.descriptionSnapshot)">
                              <span class="badge badge-xs badge-ghost shrink-0">{{ t().invoices.freeText }}</span>
                              <input class="grow min-w-0" type="text" autocomplete="off"
                                [attr.aria-label]="t().invoices.descLabel" [placeholder]="t().invoices.descLabel"
                                [attr.aria-invalid]="showsError(line.descriptionSnapshot)"
                                [formField]="line.descriptionSnapshot" />
                            </label>
                          }
                        </div>
                        <!-- Qty -->
                        <input class="input input-sm w-full" type="number" step="1" [attr.aria-label]="t().invoices.qtyLabel"
                          [attr.aria-invalid]="showsError(line.quantity)"
                          [formField]="line.quantity" />
                        @if (line.offered().value()) {
                          <!-- Given away: no price, no VAT -->
                          <span class="px-3 text-sm tabular-nums text-base-content/60">0.00</span>
                          <span class="px-3 text-sm text-base-content/60">—</span>
                        } @else {
                          <!-- Price -->
                          <input class="input input-sm w-full" appDecimal [attr.aria-label]="t().invoices.priceLabel"
                            [attr.aria-invalid]="showsError(line.unitPriceSnapshot)"
                            [formField]="line.unitPriceSnapshot" />
                          <!-- VAT% -->
                          <input class="input input-sm w-full" appDecimal placeholder="—" [attr.aria-label]="t().invoices.vatLabel"
                            [attr.aria-invalid]="showsError(line.vatPercent)"
                            [formField]="line.vatPercent" />
                        }
                        <!-- Delete + warning -->
                        <div class="flex items-center justify-end gap-0.5">
                          @if (lineStockWarning(line().value())) {
                            <span class="badge badge-warning badge-xs" [title]="t().articles.lowStockWarning">!</span>
                          }
                          <button type="button" class="btn btn-ghost btn-xs text-error px-1"
                            (click)="removeLine(i)">✕</button>
                        </div>
                      </div>
                    }
                  </div>
                }
              </div>
            </div>
          } @else {
            <p class="text-sm text-base-content/40 mb-2">{{ t().invoices.noLines }}</p>
          }

          <button type="button" class="btn btn-ghost btn-sm mt-1" (click)="addLine()">
            {{ t().invoices.addFreeText }}
          </button>
        </div>

        <!-- Totals summary -->
        @if (model().lines.length > 0) {
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
              [attr.aria-label]="t().invoices.notesLabel" [formField]="invoiceForm.notes"></textarea>
          </div>
        </details>

        <div class="flex flex-col sm:flex-row gap-4">
          <!-- Payment method -->
          <div class="w-full sm:max-w-48">
            <label class="fieldset-label" for="invoice-payment-method">{{ t().invoices.paymentMethodLabel }}</label>
            <select id="invoice-payment-method" class="select w-full" [formField]="invoiceForm.paymentMethod">
              @for (method of paymentMethods; track method) {
                <option [value]="method">{{ t().paymentMethod[method] }}</option>
              }
            </select>
          </div>

          <!-- Discount -->
          <div class="w-full sm:max-w-48">
            <label class="fieldset-label" for="invoice-discount">{{ t().invoices.discountLabel }}</label>
            <input id="invoice-discount" class="input w-full" appDecimal
              [formField]="invoiceForm.discountPercent" />
            <app-field-error [field]="invoiceForm.discountPercent" />
          </div>
        </div>
      </fieldset>

      <app-form-actions [submitLabel]="t().invoices.saveDraft" [busy]="busy()" (cancelled)="cancelled.emit()">
        <span class="tooltip-left" [class.tooltip]="!!issueBlockedReason()" [attr.data-tip]="issueBlockedReason()">
          <button type="button" class="btn btn-outline" (click)="submitAndIssue()"
            [disabled]="busy() || !!issueBlockedReason()">
            {{ model().paymentMethod === 'cash' ? t().invoices.payAndPrint : t().invoices.issueAndPrint }}
          </button>
        </span>
      </app-form-actions>
    </form>
  `,
  // While a block is dragged, the others slide aside, and it settles where it is dropped.
  styles: `
    .cdk-drop-list-dragging .cdk-drag:not(.cdk-drag-placeholder),
    .cdk-drag-animating {
      transition: transform 200ms cubic-bezier(0, 0, 0.2, 1);
    }
    .cdk-drag-placeholder {
      opacity: 0.3;
    }
    .cdk-drag-preview {
      box-shadow: 0 4px 12px rgb(0 0 0 / 0.2);
    }
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
  protected readonly showsError = showsError;
  private readonly invoiceService = inject(INVOICE_SERVICE);

  protected readonly paymentMethods = PAYMENT_METHODS;

  protected readonly model = linkedSignal<InvoiceModel>(() => {
    const invoice = this.invoice();
    return {
      discountPercent: invoice?.discountPercent ?? 0,
      notes: invoice?.notes ?? '',
      paymentMethod: invoice?.paymentMethod ?? 'cash',
      lines: invoice?.lines.map((l) => ({
        articleId: l.articleId,
        descriptionSnapshot: l.descriptionSnapshot,
        quantity: l.quantity,
        unitPriceSnapshot: l.unitPriceSnapshot,
        vatPercent: percentOf(l.vatRateSnapshot),
        offered: l.offered,
      })) ?? [],
    };
  });

  // Line fields only turn red: a message under each would break the row grid.
  protected readonly invoiceForm = form(
    this.model,
    (path) => {
      const invalidPercent = () => this.t().common.invalidPercent;
      required(path.discountPercent, { message: invalidPercent });
      percent(path.discountPercent, invalidPercent);
      applyEach(path.lines, (line) => {
        validate(line.descriptionSnapshot, ({ value, valueOf }) =>
          valueOf(line.articleId) === null && value().trim() === '' ? { kind: 'required' } : undefined
        );
        required(line.quantity);
        min(line.quantity, 1);
        integer(line.quantity);
        required(line.unitPriceSnapshot);
        min(line.unitPriceSnapshot, 0);
        percent(line.vatPercent, invalidPercent);
      });
    },
    { submission: { action: async () => this.saved.emit(this.payload()) } }
  );

  private readonly recentInvoices = resource({
    params: () => ({ customerId: this.customer().id, perPage: RECENT_INVOICES }),
    loader: async ({ params }) => (await this.invoiceService.list(params)).items,
  });

  // What the customer bought lately. Imported invoices often name an article in a
  // free-text line: matched by name, it counts as that article, active or archived.
  protected readonly articleRecommendations = computed<Recommendation[]>(() => {
    const byId = new Map(this.articles().map((a) => [a.id, a]));
    const byName = new Map(this.articles().map((a) => [searchKey(a.name), a]));
    const archivedIds = new Set(this.archivedArticles().map((a) => a.id));
    const archivedNames = new Set(this.archivedArticles().map((a) => searchKey(a.name)));
    const seen = new Set<string>();
    const recs: Recommendation[] = [];
    // Suggestions are a help: without them (the list failed), the editor still works.
    const recent = this.recentInvoices.hasValue() ? this.recentInvoices.value() : [];
    for (const inv of recent) {
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

  // The same total as the list, the PDF and the pay dialog: VAT included.
  protected readonly totals = computed(() => {
    const { discountPercent, lines } = this.payload();
    const { subtotal, discount, vat, total } = invoiceAmounts({ discountPercent, lines });
    return { subtotal, discountAmount: discount, vatAmount: vat.reduce((sum, v) => sum + v.amount, 0), total };
  });

  protected addRecommendation(rec: Recommendation): void {
    if (rec.article) {
      this.addArticle(rec.article);
      return;
    }
    this.pushLine({
      articleId: null,
      descriptionSnapshot: rec.description,
      quantity: 1,
      unitPriceSnapshot: rec.unitPrice,
      vatPercent: percentOf(rec.vatRate),
      offered: false,
    });
  }

  protected addLine(): void {
    this.pushLine({
      articleId: null,
      descriptionSnapshot: '',
      quantity: 1,
      unitPriceSnapshot: null,
      vatPercent: percentOf(this.defaultVatRate()),
      offered: false,
    });
  }

  /**
   * The lines as they move: one sold (or free-text) line and the offered lines of
   * its article right below it, so that a gift stays under what it comes with.
   */
  protected readonly blocks = computed(() => {
    const blocks: number[][] = [];
    this.model().lines.forEach((line, index) => {
      const head = blocks.at(-1);
      const below = head && line.offered && this.model().lines[head[0]].articleId === line.articleId;
      if (below) head.push(index);
      else blocks.push([index]);
    });
    return blocks;
  });

  /** Moves a block (dropped, or by the arrow keys on its handle) to another place. */
  protected moveBlock(from: number, to: number): void {
    const blocks = [...this.blocks()];
    if (to < 0 || to >= blocks.length || to === from) return;
    moveItemInArray(blocks, from, to);
    // The same line objects, in their new order: their form fields follow them.
    this.model.update((m) => ({ ...m, lines: blocks.flat().map((i) => m.lines[i]) }));
  }

  protected removeLine(index: number): void {
    this.model.update((m) => ({ ...m, lines: m.lines.filter((_, i) => i !== index) }));
  }

  private pushLine(line: LineModel): void {
    this.model.update((m) => ({ ...m, lines: [...m.lines, line] }));
  }

  /** Adds the article, or one more of it when it is already on the invoice. */
  protected addArticle(article: Article): void {
    const sold = (l: LineModel) => l.articleId === article.id && !l.offered;
    if (this.model().lines.some(sold)) {
      this.model.update((m) => ({
        ...m,
        lines: m.lines.map((l) => (sold(l) ? { ...l, quantity: Number.isInteger(l.quantity) ? l.quantity! + 1 : 1 } : l)),
      }));
    } else {
      this.pushLine({
        articleId: article.id,
        descriptionSnapshot: article.name,
        quantity: 1,
        unitPriceSnapshot: article.unitPrice,
        vatPercent: percentOf(article.vatRateOverride ?? this.defaultVatRate()),
        offered: false,
      });
    }
  }

  /**
   * One more of this article given away: on the line below it, created at 1.
   * Sold or offered, the bottles leave the same stock.
   */
  protected offer(index: number): void {
    const sold = this.model().lines[index];
    const offered = this.model().lines.findIndex((l) => l.offered && l.articleId === sold.articleId);
    this.model.update((m) => {
      const lines = [...m.lines];
      if (offered >= 0) {
        lines[offered] = { ...lines[offered], quantity: (lines[offered].quantity ?? 0) + 1 };
      } else {
        // A new object, not a spread of the sold line: Signal Forms keys each array
        // item by a symbol stored on it, which a spread would copy, binding both
        // lines to the same fields.
        lines.splice(index + 1, 0, {
          articleId: sold.articleId,
          descriptionSnapshot: sold.descriptionSnapshot,
          quantity: 1,
          unitPriceSnapshot: 0,
          vatPercent: null,
          offered: true,
        });
      }
      return { ...m, lines };
    });
  }

  protected lineStockWarning(line: LineModel): boolean {
    if (!line.articleId) return false;
    const article = this.articles().find((a) => a.id === line.articleId);
    const wanted = this.model().lines
      .filter((l) => l.articleId === line.articleId)
      .reduce((sum, l) => sum + (l.quantity ?? 0), 0);
    return article != null && article.stockQuantity < wanted;
  }

  // A draft may be saved empty, but an invoice without any article is never issued.
  protected readonly issueBlockedReason = computed(() => {
    if (this.model().lines.length === 0) return this.t().invoices.noLinesBlocked;
    return this.canIssue() ? null : this.t().invoices.issueBlocked;
  });

  protected submitAndIssue(): void {
    if (this.issueBlockedReason()) return;
    submit(this.invoiceForm, async () => this.issuedAndPrinted.emit(this.payload()));
  }

  // Also run while typing, for the totals: an empty or half-typed number counts as 0.
  private payload(): InvoiceCreate {
    const finite = (value: number | null) => (value != null && Number.isFinite(value) ? value : null);
    const num = (value: number | null) => finite(value) ?? 0;
    const m = this.model();
    return {
      customerId: this.customer().id,
      discountPercent: num(m.discountPercent),
      notes: m.notes.trim(),
      paymentMethod: m.paymentMethod,
      lines: m.lines.map((l) => ({
        articleId: l.articleId,
        descriptionSnapshot: l.descriptionSnapshot.trim(),
        quantity: Math.trunc(num(l.quantity)),
        unitPriceSnapshot: num(l.unitPriceSnapshot),
        vatRateSnapshot: rateOf(finite(l.vatPercent)),
        offered: l.offered,
      })),
    };
  }
}
