import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { tapResponse } from '@ngrx/operators';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { exhaustMap } from 'rxjs';
import { EditorPageComponent } from '../../shared/components/editor-page.component';
import { ARTICLE_SERVICE } from '../../core/tokens/article-service.token';
import { injectEditorExit } from '../../shared/editor-exit';
import { ArticleFormComponent } from './article-form.component';
import { ArticleData } from './article.model';


/** Full page to create (`/articles/new`) or edit (`/articles/:id/edit`) an article. */
@Component({
  selector: 'app-article-editor',
  imports: [EditorPageComponent, ArticleFormComponent],
  template: `
    <app-editor-page [loading]="loading()" (back)="leave()">
      <app-article-form [article]="article()" [busy]="saving()" (saved)="save($event)" (cancelled)="leave()" />
    </app-editor-page>
  `,
})
export class ArticleEditorComponent {
  private readonly articleService = inject(ARTICLE_SERVICE);
  protected readonly leave = injectEditorExit(() => '/articles');

  private readonly articleId = inject(ActivatedRoute).snapshot.paramMap.get('id');
  // While creating there are no params: nothing to load.
  private readonly loaded = rxResource({
    params: () => this.articleId ?? undefined,
    stream: ({ params: id }) => this.articleService.getById(id),
  });
  /** null while creating. */
  protected readonly article = computed(() => (this.loaded.hasValue() ? this.loaded.value() : null));
  protected readonly loading = this.loaded.isLoading;
  protected readonly saving = signal(false);

  /** Saves, then leaves; a second click while saving is ignored (exhaustMap). */
  protected readonly save = rxMethod<ArticleData>(
    exhaustMap((data) => {
      this.saving.set(true);
      const saved = this.articleId
        ? this.articleService.update(this.articleId, data)
        : this.articleService.create(data);
      return saved.pipe(
        tapResponse({
          next: () => this.leave(),
          error: () => undefined, // errorInterceptor already surfaced a toast
          finalize: () => this.saving.set(false),
        }),
      );
    }),
  );
}
