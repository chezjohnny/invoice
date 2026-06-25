import { CurrencyPipe } from '@angular/common';
import { Component, computed, input, linkedSignal, output } from '@angular/core';
import { Article } from '../articles/article.model';
import { Customer } from '../customers/customer.model';
import { InvoiceCreate, InvoiceLine } from './invoice.model';

interface LineForm {
  id: string | null;
  articleId: string | null;
  descriptionSnapshot: string;
  quantity: string;
  unitPriceSnapshot: string;
  vatRateSnapshot: string;
}

@Component({
  selector: 'app-invoice-form',
  imports: [CurrencyPipe],
  template: `
    <form (submit)="submit($event)">
      <h3 class="text-lg font-bold mb-4">{{ invoice() ? 'Edit invoice' : 'New invoice' }}</h3>

      <fieldset class="fieldset gap-3">
        <div>
          <label class="fieldset-label">Customer *</label>
          <select class="select select-bordered w-full"
            [class.select-error]="submitted() && errors().customerId"
            [value]="customerId()"
            (change)="customerId.set(asStr($event))">
            <option value="">— Select a customer —</option>
            @for (c of customers(); track c.id) {
              <option [value]="c.id">{{ c.lastName }}, {{ c.firstName }}</option>
            }
          </select>
          @if (submitted() && errors().customerId) {
            <p class="fieldset-label text-error">{{ errors().customerId }}</p>
          }
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="fieldset-label">Discount (%)</label>
            <input class="input w-full" type="number" min="0" max="100" step="0.1"
              [value]="discountPercent()" (input)="discountPercent.set(asStr($event))" />
          </div>
          <div>
            <label class="fieldset-label">Currency</label>
            <input class="input w-full" type="text" maxlength="3"
              [value]="currency()" (input)="currency.set(asStr($event))" />
          </div>
        </div>

        <!-- Lines -->
        <div>
          <label class="fieldset-label font-semibold">Lines</label>
          @if (lines().length === 0) {
            <p class="text-sm text-base-content/40 mb-2">No lines yet.</p>
          }
          @for (line of lines(); track $index; let i = $index) {
            <div class="border border-base-300 rounded p-3 mb-2 grid grid-cols-12 gap-2 items-end">
              <div class="col-span-4">
                <label class="fieldset-label text-xs">Article</label>
                <select class="select select-bordered select-sm w-full"
                  [value]="line.articleId ?? ''"
                  (change)="selectArticle(i, asStr($event))">
                  <option value="">— Custom —</option>
                  @for (a of articles(); track a.id) {
                    <option [value]="a.id">{{ a.name }}</option>
                  }
                </select>
              </div>
              <div class="col-span-4">
                <label class="fieldset-label text-xs">Description *</label>
                <input class="input input-sm w-full" type="text"
                  [value]="line.descriptionSnapshot"
                  (input)="updateLine(i, 'descriptionSnapshot', asStr($event))" />
              </div>
              <div class="col-span-1">
                <label class="fieldset-label text-xs">Qty</label>
                <input class="input input-sm w-full" type="number" min="1" step="1"
                  [value]="line.quantity"
                  (input)="updateLine(i, 'quantity', asStr($event))" />
              </div>
              <div class="col-span-1">
                <label class="fieldset-label text-xs">Price</label>
                <input class="input input-sm w-full" type="number" min="0" step="0.01"
                  [value]="line.unitPriceSnapshot"
                  (input)="updateLine(i, 'unitPriceSnapshot', asStr($event))" />
              </div>
              <div class="col-span-1">
                <label class="fieldset-label text-xs">VAT %</label>
                <input class="input input-sm w-full" type="number" min="0" max="100" step="0.1"
                  placeholder="—"
                  [value]="line.vatRateSnapshot"
                  (input)="updateLine(i, 'vatRateSnapshot', asStr($event))" />
              </div>
              <div class="col-span-1 flex justify-end">
                <button type="button" class="btn btn-ghost btn-xs text-error"
                  (click)="removeLine(i)">✕</button>
              </div>
            </div>
          }
          <button type="button" class="btn btn-ghost btn-sm" (click)="addLine()">
            + Add line
          </button>
        </div>

        <!-- Totals preview -->
        @if (lines().length > 0) {
          <div class="text-sm text-right text-base-content/70 border-t border-base-200 pt-2">
            <span class="mr-4">Subtotal: {{ totals().subtotal | currency:'CHF':'code':'1.2-2' }}</span>
            @if (totals().discountAmount > 0) {
              <span class="mr-4">
                Discount: -{{ totals().discountAmount | currency:'CHF':'code':'1.2-2' }}
              </span>
            }
            <strong>Total: {{ totals().total | currency:'CHF':'code':'1.2-2' }}</strong>
          </div>
        }

        <div>
          <label class="fieldset-label">Notes</label>
          <textarea class="textarea textarea-bordered w-full" rows="3"
            [value]="notes()" (input)="notes.set(asStr($event))"></textarea>
        </div>
      </fieldset>

      <div class="flex justify-end gap-2 mt-6">
        <button type="button" class="btn btn-ghost" (click)="cancelled.emit()">Cancel</button>
        <button type="submit" class="btn btn-primary">Save draft</button>
      </div>
    </form>
  `,
})
export class InvoiceFormComponent {
  readonly invoice = input<Invoice | null>(null);
  readonly articles = input<Article[]>([]);
  readonly customers = input<Customer[]>([]);
  readonly saved = output<InvoiceCreate>();
  readonly cancelled = output<void>();

  protected readonly customerId = linkedSignal(() => this.invoice()?.customerId ?? '');
  protected readonly currency = linkedSignal(() => this.invoice()?.currency ?? 'CHF');
  protected readonly discountPercent = linkedSignal(() =>
    this.invoice() != null ? String(this.invoice()!.discountPercent) : '0'
  );
  protected readonly notes = linkedSignal(() => this.invoice()?.notes ?? '');
  protected readonly submitted = linkedSignal(() => { this.invoice(); return false; });

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
    customerId: this.customerId() === '' ? 'Customer is required' : null,
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

  protected asStr(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  submit(event: Event): void {
    event.preventDefault();
    this.submitted.set(true);
    if (!this.isValid()) return;
    this.saved.emit({
      customerId: this.customerId(),
      currency: this.currency(),
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
    });
  }
}

// avoid import cycle — inline type
type Invoice = import('./invoice.model').Invoice;
