import { CurrencyPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { Article } from './article.model';
import { ArticleFormComponent } from './article-form.component';
import { ArticleStore } from './article.store';

@Component({
  selector: 'app-articles',
  providers: [ArticleStore],
  imports: [CurrencyPipe, ArticleFormComponent],
  template: `
    <div class="p-6 max-w-5xl mx-auto">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold">{{ t().articles.title }}</h1>
        <button class="btn btn-primary" (click)="openNew()">{{ t().articles.new }}</button>
      </div>

      <label class="input mb-4 w-full max-w-sm flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 opacity-50" viewBox="0 0 16 16">
          <path fill-rule="evenodd" d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.099zm-5.242 1.156a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11"/>
        </svg>
        <input type="text" [placeholder]="t().articles.search"
          [value]="store.filter()" (input)="onFilter($event)" />
      </label>

      <div class="overflow-x-auto">
        <table class="table table-zebra w-full">
          <thead>
            <tr>
              <th>{{ t().articles.name }}</th>
              <th>{{ t().articles.description }}</th>
              <th class="text-right">{{ t().articles.unitPrice }}</th>
              <th>{{ t().articles.vatOverride }}</th>
              <th class="text-right">{{ t().articles.stock }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (article of store.filteredArticles(); track article.id) {
              <tr>
                <td class="font-medium">{{ article.name }}</td>
                <td class="text-base-content/60 text-sm">{{ article.description }}</td>
                <td class="text-right">{{ article.unitPrice | currency:'CHF':'code':'1.2-2' }}</td>
                <td>
                  @if (article.vatRateOverride != null) {
                    <span class="badge badge-outline">{{ (article.vatRateOverride * 100).toFixed(1) }} %</span>
                  } @else {
                    <span class="text-base-content/40">—</span>
                  }
                </td>
                <td class="text-right">{{ article.stockQuantity }}</td>
                <td class="flex gap-1">
                  <button class="btn btn-ghost btn-xs" (click)="openEdit(article)">
                    {{ t().common.edit }}
                  </button>
                  <button class="btn btn-ghost btn-xs" (click)="store.archive(article.id)">
                    {{ t().common.archive }}
                  </button>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="6" class="text-center text-base-content/40 py-8">
                  {{ t().articles.noResults }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>

    @if (showForm()) {
      <dialog class="modal modal-open">
        <div class="modal-box">
          <app-article-form
            [article]="editingArticle()"
            (saved)="onSaved($event)"
            (cancelled)="closeForm()"
          />
        </div>
        <div class="modal-backdrop" (click)="closeForm()"></div>
      </dialog>
    }
  `,
})
export class ArticlesComponent {
  protected readonly store = inject(ArticleStore);
  protected readonly t = inject(I18nService).T;
  protected readonly showForm = signal(false);
  protected readonly editingArticle = signal<Article | null>(null);

  onFilter(event: Event): void {
    this.store.setFilter((event.target as HTMLInputElement).value);
  }

  openNew(): void {
    this.editingArticle.set(null);
    this.showForm.set(true);
  }

  openEdit(article: Article): void {
    this.editingArticle.set(article);
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
  }

  async onSaved(data: Omit<Article, 'id' | 'isArchived'>): Promise<void> {
    const editing = this.editingArticle();
    if (editing) {
      await this.store.updateArticle(editing.id, data);
    } else {
      await this.store.createArticle(data);
    }
    this.closeForm();
  }
}
