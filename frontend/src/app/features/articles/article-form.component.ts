import { Component, inject, input, linkedSignal, output } from '@angular/core';
import { FormField, FormRoot, form, min, required } from '@angular/forms/signals';
import { I18nService } from '../../core/i18n/i18n.service';
import { AutofocusDirective } from '../../shared/autofocus.directive';
import { FieldErrorComponent } from '../../shared/components/field-error.component';
import { FormActionsComponent } from '../../shared/components/form-actions.component';
import { percent, requiredText } from '../../shared/form-errors';
import { percentOf, rateOf } from '../../shared/percent';
import { Article, ArticleData } from './article.model';

interface ArticleModel {
  name: string;
  description: string;
  unitPrice: number | null;
  /** 8.1 for 8.1 %; null: the company's rate. */
  vatPercent: number | null;
  stockQuantity: number | null;
}

@Component({
  selector: 'app-article-form',
  imports: [AutofocusDirective, FieldErrorComponent, FormActionsComponent, FormField, FormRoot],
  template: `
    <form [formRoot]="articleForm">
      <h1 class="text-xl font-bold sm:text-2xl mb-5">
        {{ article() ? t().articles.editTitle : t().articles.newTitle }}
      </h1>

      <fieldset class="fieldset gap-4">
        <div>
          <label class="fieldset-label" for="article-name">{{ t().articles.nameLabel }}</label>
          <input id="article-name" appAutofocus class="input w-full" type="text" [formField]="articleForm.name" />
          <app-field-error [field]="articleForm.name" />
        </div>

        <div>
          <label class="fieldset-label" for="article-desc">{{ t().articles.descLabel }}</label>
          <input id="article-desc" class="input w-full" type="text" [formField]="articleForm.description" />
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="fieldset-label" for="article-price">{{ t().articles.priceLabel }}</label>
            <input id="article-price" class="input w-full" type="number" step="0.01" [formField]="articleForm.unitPrice" />
            <app-field-error [field]="articleForm.unitPrice" />
          </div>
          <div>
            <label class="fieldset-label" for="article-vat">{{ t().articles.vatLabel }}</label>
            <input id="article-vat" class="input w-full" type="number" step="0.1" [formField]="articleForm.vatPercent" />
            <app-field-error [field]="articleForm.vatPercent" />
          </div>
        </div>

        <div>
          <label class="fieldset-label" for="article-stock">{{ t().articles.stockLabel }}</label>
          <input id="article-stock" class="input w-full sm:max-w-40" type="number" step="1" [formField]="articleForm.stockQuantity" />
          <app-field-error [field]="articleForm.stockQuantity" />
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

  protected readonly model = linkedSignal<ArticleModel>(() => {
    const article = this.article();
    return {
      name: article?.name ?? '',
      description: article?.description ?? '',
      unitPrice: article?.unitPrice ?? null,
      vatPercent: percentOf(article?.vatRateOverride),
      stockQuantity: article?.stockQuantity ?? 0,
    };
  });

  protected readonly articleForm = form(
    this.model,
    (path) => {
      requiredText(path.name, () => this.t().articles.nameRequired);
      required(path.unitPrice, { message: () => this.t().articles.priceRequired });
      min(path.unitPrice, 0, { message: () => this.t().articles.pricePositive });
      percent(path.vatPercent, () => this.t().common.invalidPercent);
    },
    {
      submission: {
        action: async () => {
          const m = this.model();
          this.saved.emit({
            name: m.name.trim(),
            description: m.description.trim(),
            unitPrice: m.unitPrice ?? 0,
            vatRateOverride: rateOf(m.vatPercent),
            stockQuantity: m.stockQuantity ?? 0,
          });
        },
      },
    }
  );
}
