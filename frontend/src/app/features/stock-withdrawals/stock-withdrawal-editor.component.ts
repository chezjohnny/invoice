import { Component, inject, signal } from '@angular/core';
import { EditorPageComponent } from '../../shared/components/editor-page.component';
import { ARTICLE_SERVICE } from '../../core/tokens/article-service.token';
import { STOCK_WITHDRAWAL_SERVICE } from '../../core/tokens/stock-withdrawal-service.token';
import { once } from '../../shared/busy';
import { injectEditorExit } from '../../shared/editor-exit';
import { Article } from '../articles/article.model';
import { StockWithdrawalFormComponent } from './stock-withdrawal-form.component';
import { StockWithdrawalCreate } from './stock-withdrawal.model';

/** Full page to record a stock withdrawal (`/stock-withdrawals/new`). */
@Component({
  selector: 'app-stock-withdrawal-editor',
  imports: [EditorPageComponent, StockWithdrawalFormComponent],
  template: `
    <app-editor-page [loading]="articles() === null" (back)="leave()">
      <app-stock-withdrawal-form [articles]="articles() ?? []" [busy]="saving()"
        (saved)="onSaved($event)" (cancelled)="leave()" />
    </app-editor-page>
  `,
})
export class StockWithdrawalEditorComponent {
  private readonly withdrawals = inject(STOCK_WITHDRAWAL_SERVICE);
  protected readonly leave = injectEditorExit(() => '/stock-withdrawals');
  /** null while loading: the stock shown next to each article must be current. */
  protected readonly articles = signal<Article[] | null>(null);
  protected readonly saving = signal(false);

  constructor() {
    inject(ARTICLE_SERVICE).getAll().then((articles) => this.articles.set(articles));
  }

  protected onSaved(data: StockWithdrawalCreate): Promise<void> {
    return once(this.saving, async () => {
      await this.withdrawals.create(data);
      this.leave();
    });
  }
}
