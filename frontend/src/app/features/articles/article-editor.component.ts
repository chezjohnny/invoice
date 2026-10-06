import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { EditorPageComponent } from '../../shared/components/editor-page.component';
import { ARTICLE_SERVICE } from '../../core/tokens/article-service.token';
import { injectEditorExit } from '../../shared/editor-exit';
import { ArticleFormComponent } from './article-form.component';
import { Article, ArticleData } from './article.model';


/** Full page to create (`/articles/new`) or edit (`/articles/:id/edit`) an article. */
@Component({
  selector: 'app-article-editor',
  imports: [EditorPageComponent, ArticleFormComponent],
  template: `
    <app-editor-page [loading]="loading()" (back)="leave()">
      <app-article-form [article]="article()" (saved)="onSaved($event)" (cancelled)="leave()" />
    </app-editor-page>
  `,
})
export class ArticleEditorComponent {
  private readonly articleService = inject(ARTICLE_SERVICE);
  protected readonly leave = injectEditorExit(() => '/articles');

  private readonly articleId = inject(ActivatedRoute).snapshot.paramMap.get('id');
  /** null while creating. */
  protected readonly article = signal<Article | null>(null);
  protected readonly loading = signal(this.articleId !== null);

  constructor() {
    if (this.articleId) {
      this.articleService.getById(this.articleId).then((article) => {
        this.article.set(article);
        this.loading.set(false);
      });
    }
  }

  protected async onSaved(data: ArticleData): Promise<void> {
    if (this.articleId) await this.articleService.update(this.articleId, data);
    else await this.articleService.create(data);
    this.leave();
  }
}
