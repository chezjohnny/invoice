import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormField, form, maxLength, min, required, submit, validate } from '@angular/forms/signals';
import { I18nService } from '../../core/i18n/i18n.service';
import { FieldErrorComponent } from '../../shared/components/field-error.component';
import { FormActionsComponent } from '../../shared/components/form-actions.component';
import { localIsoDate } from '../../shared/dates';
import { showsError } from '../../shared/form-errors';
import { ArticlePickerComponent } from '../articles/article-picker.component';
import { Article } from '../articles/article.model';
import { STOCK_WITHDRAWAL_REASONS, StockWithdrawalCreate, StockWithdrawalReason } from './stock-withdrawal.model';

interface WithdrawalModel {
  /** Empty until an article is picked. */
  articleId: string;
  date: string;
  quantity: number | null;
  reason: StockWithdrawalReason;
  note: string;
}

@Component({
  selector: 'app-stock-withdrawal-form',
  imports: [ArticlePickerComponent, FieldErrorComponent, FormActionsComponent, FormField],
  template: `
    <form (submit)="save($event)">
      <h1 class="text-xl font-bold sm:text-2xl mb-5">{{ t().stockWithdrawals.newTitle }}</h1>

      <fieldset class="fieldset gap-4">
        <div>
          <label class="fieldset-label" for="withdrawal-article">{{ t().stockWithdrawals.articleLabel }}</label>
          <!-- Picked by typing part of its name, as on an invoice; ✕ to pick another -->
          @if (article(); as a) {
            <div class="input w-full">
              <span class="truncate grow" [title]="a.name">{{ a.name }}</span>
              <span class="text-base-content/50 text-xs shrink-0 tabular-nums">{{ t().articles.stock }} {{ a.stockQuantity }}</span>
              <button type="button" class="btn btn-ghost btn-xs px-1" [attr.aria-label]="t().stockWithdrawals.changeArticle"
                (click)="pick('')">✕</button>
            </div>
          } @else {
            <app-article-picker inputId="withdrawal-article" autofocus [articles]="articles()"
              [invalid]="showsError(withdrawalForm.articleId)"
              [placeholder]="t().stockWithdrawals.pickArticle" (picked)="pick($event.id)" />
          }
          <app-field-error [field]="withdrawalForm.articleId" />
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label class="fieldset-label" for="withdrawal-date">{{ t().stockWithdrawals.dateLabel }}</label>
            <input id="withdrawal-date" class="input w-full" type="date"
              [class.input-error]="showsError(withdrawalForm.date)" [formField]="withdrawalForm.date" />
            <app-field-error [field]="withdrawalForm.date" />
          </div>
          <div>
            <label class="fieldset-label" for="withdrawal-quantity">{{ t().stockWithdrawals.quantityLabel }}</label>
            <input id="withdrawal-quantity" class="input w-full" type="number" step="1"
              [class.input-error]="showsError(withdrawalForm.quantity)" [formField]="withdrawalForm.quantity" />
            <app-field-error [field]="withdrawalForm.quantity" />
          </div>
          <div>
            <label class="fieldset-label" for="withdrawal-reason">{{ t().stockWithdrawals.reasonLabel }}</label>
            <select id="withdrawal-reason" class="select w-full" [formField]="withdrawalForm.reason">
              @for (r of reasons; track r) {
                <option [value]="r">{{ t().stockWithdrawalReason[r] }}</option>
              }
            </select>
          </div>
        </div>

        <div>
          <label class="fieldset-label" for="withdrawal-note">{{ t().stockWithdrawals.noteLabel }}</label>
          <input id="withdrawal-note" class="input w-full" type="text"
            [class.input-error]="showsError(withdrawalForm.note)" [formField]="withdrawalForm.note" />
          <app-field-error [field]="withdrawalForm.note" />
        </div>
      </fieldset>

      <app-form-actions [busy]="busy()" (cancelled)="cancelled.emit()" />
    </form>
  `,
})
export class StockWithdrawalFormComponent {
  readonly articles = input<Article[]>([]);
  readonly busy = input(false);
  readonly saved = output<StockWithdrawalCreate>();
  readonly cancelled = output<void>();

  protected readonly t = inject(I18nService).T;
  protected readonly showsError = showsError;
  protected readonly reasons = STOCK_WITHDRAWAL_REASONS;

  // Create-only, and recreated on each visit to its page: a plain signal.
  protected readonly model = signal<WithdrawalModel>({
    articleId: '',
    date: localIsoDate(),
    quantity: 1,
    reason: 'tasting',
    note: '',
  });

  protected readonly withdrawalForm = form(this.model, (path) => {
    required(path.articleId, { message: () => this.t().stockWithdrawals.articleRequired });
    required(path.date, { message: () => this.t().stockWithdrawals.dateRequired });
    required(path.quantity, { message: () => this.t().stockWithdrawals.quantityPositive });
    min(path.quantity, 1, { message: () => this.t().stockWithdrawals.quantityPositive });
    validate(path.quantity, ({ value }) =>
      value() == null || Number.isInteger(value())
        ? undefined
        : { kind: 'integer', message: this.t().stockWithdrawals.quantityPositive }
    );
    maxLength(path.note, 500);
  });

  protected readonly article = computed(() =>
    this.articles().find((a) => a.id === this.model().articleId) ?? null
  );

  protected pick(articleId: string): void {
    this.model.update((m) => ({ ...m, articleId }));
  }

  protected save(event: Event): void {
    event.preventDefault();
    submit(this.withdrawalForm, async () => {
      const m = this.model();
      this.saved.emit({
        articleId: m.articleId,
        date: m.date,
        quantity: m.quantity ?? 1,
        reason: m.reason,
        note: m.note.trim(),
      });
    });
  }
}
