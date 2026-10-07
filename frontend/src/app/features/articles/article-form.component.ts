import { Component, computed, inject, input, linkedSignal, output } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { FormActionsComponent } from '../../shared/components/form-actions.component';
import { inputValue } from '../../shared/events';
import { isPercent, percentFromRate, rateFromPercent } from '../../shared/percent';
import { Article, ArticleData } from './article.model';
import { AutofocusDirective } from '../../shared/autofocus.directive';


@Component({
  selector: 'app-article-form',
  imports: [AutofocusDirective, FormActionsComponent],
  template: `
    <form (submit)="submit($event)">
      <h1 class="text-xl font-bold sm:text-2xl mb-5">
        {{ article() ? t().articles.editTitle : t().articles.newTitle }}
      </h1>

      <fieldset class="fieldset gap-4">
        <div>
          <label class="fieldset-label" for="article-name">{{ t().articles.nameLabel }}</label>
          <input id="article-name" appAutofocus class="input w-full" [class.input-error]="submitted() && errors().name"
            type="text" [value]="name()" (input)="name.set(inputValue($event))" />
          @if (submitted() && errors().name) {
            <p class="fieldset-label text-error mt-1">{{ errors().name }}</p>
          }
        </div>

        <div>
          <label class="fieldset-label" for="article-desc">{{ t().articles.descLabel }}</label>
          <input id="article-desc" class="input w-full" type="text"
            [value]="description()" (input)="description.set(inputValue($event))" />
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="fieldset-label" for="article-price">{{ t().articles.priceLabel }}</label>
            <input id="article-price" class="input w-full" [class.input-error]="submitted() && errors().unitPrice"
              type="number" min="0" step="0.01"
              [value]="unitPrice()" (input)="unitPrice.set(inputValue($event))" />
            @if (submitted() && errors().unitPrice) {
              <p class="fieldset-label text-error mt-1">{{ errors().unitPrice }}</p>
            }
          </div>
          <div>
            <label class="fieldset-label" for="article-vat">{{ t().articles.vatLabel }}</label>
            <input id="article-vat" class="input w-full" [class.input-error]="submitted() && errors().vatRateOverride"
              type="number" min="0" max="100" step="0.1"
              [value]="vatRateOverride()" (input)="vatRateOverride.set(inputValue($event))" />
            @if (submitted() && errors().vatRateOverride) {
              <p class="fieldset-label text-error mt-1">{{ errors().vatRateOverride }}</p>
            }
          </div>
        </div>

        <div>
          <label class="fieldset-label" for="article-stock">{{ t().articles.stockLabel }}</label>
          <input id="article-stock" class="input w-full sm:max-w-40" type="number" step="1"
            [value]="stockQuantity()" (input)="stockQuantity.set(inputValue($event))" />
        </div>
      </fieldset>

      <app-form-actions [busy]="busy()" (cancelled)="cancelled.emit()" />
    </form>
  `,
})
export class ArticleFormComponent {
  readonly article = input<Article | null>(null);
  readonly busy = input(false);
  readonly saved = output<ArticleData>();
  readonly cancelled = output<void>();

  protected readonly t = inject(I18nService).T;
  protected readonly inputValue = inputValue;

  protected readonly name = linkedSignal(() => this.article()?.name ?? '');
  protected readonly description = linkedSignal(() => this.article()?.description ?? '');
  protected readonly unitPrice = linkedSignal(() =>
    this.article() != null ? String(this.article()!.unitPrice) : ''
  );
  protected readonly vatRateOverride = linkedSignal(() => percentFromRate(this.article()?.vatRateOverride));
  protected readonly stockQuantity = linkedSignal(() =>
    this.article() != null ? String(this.article()!.stockQuantity) : '0'
  );

  protected readonly submitted = linkedSignal(() => { this.article(); return false; });

  protected readonly errors = computed(() => ({
    name: this.name().trim() === '' ? this.t().articles.nameRequired : null,
    unitPrice: (() => {
      const v = parseFloat(this.unitPrice());
      if (isNaN(v)) return this.t().articles.priceRequired;
      if (v < 0) return this.t().articles.pricePositive;
      return null;
    })(),
    vatRateOverride: isPercent(this.vatRateOverride()) ? null : this.t().common.invalidPercent,
  }));

  protected readonly isValid = computed(() =>
    Object.values(this.errors()).every((e) => e === null)
  );

  submit(event: Event): void {
    event.preventDefault();
    this.submitted.set(true);
    if (!this.isValid()) return;
    this.saved.emit({
      name: this.name().trim(),
      description: this.description().trim(),
      unitPrice: parseFloat(this.unitPrice()),
      vatRateOverride: rateFromPercent(this.vatRateOverride()),
      stockQuantity: parseInt(this.stockQuantity(), 10) || 0,
    });
  }
}
