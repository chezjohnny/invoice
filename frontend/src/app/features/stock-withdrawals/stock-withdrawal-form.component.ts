import { Component, computed, inject, input, output, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { FormActionsComponent } from '../../shared/components/form-actions.component';
import { inputValue } from '../../shared/events';
import { localIsoDate } from '../../shared/dates';
import { Article } from '../articles/article.model';
import { STOCK_WITHDRAWAL_REASONS, StockWithdrawalCreate, StockWithdrawalReason } from './stock-withdrawal.model';

@Component({
  selector: 'app-stock-withdrawal-form',
  imports: [FormActionsComponent],
  template: `
    <form (submit)="submit($event)">
      <h1 class="text-xl font-bold sm:text-2xl mb-5">{{ t().stockWithdrawals.newTitle }}</h1>

      <fieldset class="fieldset gap-4">
        <div>
          <label class="fieldset-label" for="withdrawal-article">{{ t().stockWithdrawals.articleLabel }}</label>
          <select id="withdrawal-article" class="select w-full" [class.select-error]="submitted() && errors().article"
            (change)="articleId.set(inputValue($event))">
            <option value="" [selected]="articleId() === ''" disabled>—</option>
            @for (a of articles(); track a.id) {
              <option [value]="a.id" [selected]="articleId() === a.id">
                {{ a.name }} · {{ t().articles.stock }} {{ a.stockQuantity }}
              </option>
            }
          </select>
          @if (submitted() && errors().article) {
            <p class="fieldset-label text-error mt-1">{{ errors().article }}</p>
          }
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label class="fieldset-label" for="withdrawal-date">{{ t().stockWithdrawals.dateLabel }}</label>
            <input id="withdrawal-date" class="input w-full" [class.input-error]="submitted() && errors().date"
              type="date" [value]="date()" (change)="date.set(inputValue($event))" />
            @if (submitted() && errors().date) {
              <p class="fieldset-label text-error mt-1">{{ errors().date }}</p>
            }
          </div>
          <div>
            <label class="fieldset-label" for="withdrawal-quantity">{{ t().stockWithdrawals.quantityLabel }}</label>
            <input id="withdrawal-quantity" class="input w-full" [class.input-error]="submitted() && errors().quantity"
              type="number" min="1" step="1" [value]="quantity()" (input)="quantity.set(inputValue($event))" />
            @if (submitted() && errors().quantity) {
              <p class="fieldset-label text-error mt-1">{{ errors().quantity }}</p>
            }
          </div>
          <div>
            <label class="fieldset-label" for="withdrawal-reason">{{ t().stockWithdrawals.reasonLabel }}</label>
            <select id="withdrawal-reason" class="select w-full" (change)="reason.set(inputValue($event))">
              @for (r of reasons; track r) {
                <option [value]="r" [selected]="reason() === r">{{ t().stockWithdrawalReason[r] }}</option>
              }
            </select>
          </div>
        </div>

        <div>
          <label class="fieldset-label" for="withdrawal-note">{{ t().stockWithdrawals.noteLabel }}</label>
          <input id="withdrawal-note" class="input w-full" type="text" maxlength="500"
            [value]="note()" (input)="note.set(inputValue($event))" />
        </div>
      </fieldset>

      <app-form-actions (cancelled)="cancelled.emit()" />
    </form>
  `,
})
export class StockWithdrawalFormComponent {
  readonly articles = input<Article[]>([]);
  readonly saved = output<StockWithdrawalCreate>();
  readonly cancelled = output<void>();

  protected readonly t = inject(I18nService).T;
  protected readonly inputValue = inputValue;
  protected readonly reasons = STOCK_WITHDRAWAL_REASONS;

  // Create-only, and recreated on each visit to its page: plain signals.
  protected readonly articleId = signal('');
  protected readonly date = signal(localIsoDate());
  protected readonly quantity = signal('1');
  protected readonly reason = signal<StockWithdrawalReason>('tasting');
  protected readonly note = signal('');
  protected readonly submitted = signal(false);

  protected readonly errors = computed(() => ({
    article: this.articleId() === '' ? this.t().stockWithdrawals.articleRequired : null,
    date: this.date() === '' ? this.t().stockWithdrawals.dateRequired : null,
    quantity: (() => {
      const v = Number(this.quantity());
      return Number.isInteger(v) && v >= 1 ? null : this.t().stockWithdrawals.quantityPositive;
    })(),
  }));

  protected readonly isValid = computed(() =>
    Object.values(this.errors()).every((e) => e === null)
  );

  submit(event: Event): void {
    event.preventDefault();
    this.submitted.set(true);
    if (!this.isValid()) return;
    this.saved.emit({
      articleId: this.articleId(),
      date: this.date(),
      quantity: Number(this.quantity()),
      reason: this.reason(),
      note: this.note().trim(),
    });
  }
}
