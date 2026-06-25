import { Component, computed, inject, input, linkedSignal, output } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { Article } from './article.model';

type ArticleData = Omit<Article, 'id' | 'isArchived'>;

@Component({
  selector: 'app-article-form',
  template: `
    <form (submit)="submit($event)">
      <h3 class="text-lg font-semibold mb-5">
        {{ article() ? t().articles.editTitle : t().articles.newTitle }}
      </h3>

      <fieldset class="fieldset gap-4">
        <div>
          <label class="fieldset-label">{{ t().articles.nameLabel }}</label>
          <input class="input w-full" [class.input-error]="submitted() && errors().name"
            type="text" [value]="name()" (input)="name.set(asStr($event))" />
          @if (submitted() && errors().name) {
            <p class="fieldset-label text-error mt-1">{{ errors().name }}</p>
          }
        </div>

        <div>
          <label class="fieldset-label">{{ t().articles.descLabel }}</label>
          <input class="input w-full" type="text"
            [value]="description()" (input)="description.set(asStr($event))" />
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="fieldset-label">{{ t().articles.priceLabel }}</label>
            <input class="input w-full" [class.input-error]="submitted() && errors().unitPrice"
              type="number" min="0" step="0.01"
              [value]="unitPrice()" (input)="unitPrice.set(asStr($event))" />
            @if (submitted() && errors().unitPrice) {
              <p class="fieldset-label text-error mt-1">{{ errors().unitPrice }}</p>
            }
          </div>
          <div>
            <label class="fieldset-label">{{ t().articles.vatLabel }}</label>
            <input class="input w-full" type="number" min="0" max="100" step="0.1"
              [value]="vatRateOverride()" (input)="vatRateOverride.set(asStr($event))" />
          </div>
        </div>

        <div>
          <label class="fieldset-label">{{ t().articles.stockLabel }}</label>
          <input class="input w-full sm:max-w-40" type="number" step="1"
            [value]="stockQuantity()" (input)="stockQuantity.set(asStr($event))" />
        </div>
      </fieldset>

      <div class="flex justify-end gap-2 mt-6">
        <button type="button" class="btn btn-ghost" (click)="cancelled.emit()">
          {{ t().common.cancel }}
        </button>
        <button type="submit" class="btn btn-primary">{{ t().common.save }}</button>
      </div>
    </form>
  `,
})
export class ArticleFormComponent {
  readonly article = input<Article | null>(null);
  readonly saved = output<ArticleData>();
  readonly cancelled = output<void>();

  protected readonly t = inject(I18nService).T;

  protected readonly name = linkedSignal(() => this.article()?.name ?? '');
  protected readonly description = linkedSignal(() => this.article()?.description ?? '');
  protected readonly unitPrice = linkedSignal(() =>
    this.article() != null ? String(this.article()!.unitPrice) : ''
  );
  protected readonly vatRateOverride = linkedSignal(() =>
    this.article()?.vatRateOverride != null
      ? String(this.article()!.vatRateOverride! * 100)
      : ''
  );
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
  }));

  protected readonly isValid = computed(() =>
    Object.values(this.errors()).every((e) => e === null)
  );

  protected asStr(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  submit(event: Event): void {
    event.preventDefault();
    this.submitted.set(true);
    if (!this.isValid()) return;
    const vat = this.vatRateOverride().trim();
    this.saved.emit({
      name: this.name().trim(),
      description: this.description().trim(),
      unitPrice: parseFloat(this.unitPrice()),
      vatRateOverride: vat !== '' ? parseFloat(vat) / 100 : null,
      stockQuantity: parseInt(this.stockQuantity(), 10) || 0,
    });
  }
}
