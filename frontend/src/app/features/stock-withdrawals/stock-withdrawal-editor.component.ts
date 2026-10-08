import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { tapResponse } from '@ngrx/operators';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { exhaustMap } from 'rxjs';
import { EditorPageComponent } from '../../shared/components/editor-page.component';
import { ARTICLE_SERVICE } from '../../core/tokens/article-service.token';
import { STOCK_WITHDRAWAL_SERVICE } from '../../core/tokens/stock-withdrawal-service.token';
import { injectEditorExit } from '../../shared/editor-exit';
import { StockWithdrawalFormComponent } from './stock-withdrawal-form.component';
import { StockWithdrawalCreate } from './stock-withdrawal.model';

/** Full page to record a stock withdrawal (`/stock-withdrawals/new`). */
@Component({
  selector: 'app-stock-withdrawal-editor',
  imports: [EditorPageComponent, StockWithdrawalFormComponent],
  template: `
    <app-editor-page [loading]="articles() === null" (back)="leave()">
      <app-stock-withdrawal-form [articles]="articles() ?? []" [busy]="saving()"
        (saved)="save($event)" (cancelled)="leave()" />
    </app-editor-page>
  `,
})
export class StockWithdrawalEditorComponent {
  private readonly withdrawals = inject(STOCK_WITHDRAWAL_SERVICE);
  protected readonly leave = injectEditorExit(() => '/stock-withdrawals');
  private readonly articleService = inject(ARTICLE_SERVICE);
  private readonly loaded = rxResource({ stream: () => this.articleService.getAll() });
  /** null while loading: the stock shown next to each article must be current. */
  protected readonly articles = computed(() => (this.loaded.hasValue() ? this.loaded.value() : null));
  protected readonly saving = signal(false);

  /** Records it, then leaves; a second click while saving is ignored (exhaustMap). */
  protected readonly save = rxMethod<StockWithdrawalCreate>(
    exhaustMap((data) => {
      this.saving.set(true);
      return this.withdrawals.create(data).pipe(
        tapResponse({
          next: () => this.leave(),
          error: () => undefined, // errorInterceptor already surfaced a toast
          finalize: () => this.saving.set(false),
        }),
      );
    }),
  );
}
