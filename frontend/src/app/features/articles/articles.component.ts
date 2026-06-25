import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { Article } from './article.model';
import { ArticleFormComponent } from './article-form.component';
import { ArticleStore } from './article.store';

@Component({
  selector: 'app-articles',
  providers: [ArticleStore],
  imports: [CurrencyPipe, ArticleFormComponent],
  template: `
    <div class="p-4 md:p-6 max-w-5xl mx-auto">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-xl font-bold sm:text-2xl">{{ t().articles.title }}</h1>
        <button class="btn btn-primary btn-sm sm:btn-md" (click)="openNew()">
          {{ t().articles.new }}
        </button>
      </div>

      <label class="input mb-4 w-full sm:max-w-xs flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 opacity-40 shrink-0" viewBox="0 0 16 16">
          <path fill-rule="evenodd" d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.099zm-5.242 1.156a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11"/>
        </svg>
        <input type="text" [placeholder]="t().articles.search"
          [value]="store.search()" (input)="onSearch($event)" />
      </label>

      @if (store.loading()) {
        <div class="flex justify-center py-8">
          <span class="loading loading-spinner loading-md"></span>
        </div>
      } @else {
        <div class="card bg-base-100 shadow overflow-hidden">
          <div class="overflow-x-auto">
            <table class="table table-zebra w-full">
              <thead>
                <tr>
                  <th>{{ t().articles.name }}</th>
                  <th class="hidden md:table-cell">{{ t().articles.description }}</th>
                  <th class="text-right">{{ t().articles.unitPrice }}</th>
                  <th class="hidden sm:table-cell">{{ t().articles.vatOverride }}</th>
                  <th class="text-right">{{ t().articles.stock }}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (article of store.items(); track article.id) {
                  <tr>
                    <td class="font-medium">{{ article.name }}</td>
                    <td class="text-base-content/60 text-sm hidden md:table-cell">
                      {{ article.description || '—' }}
                    </td>
                    <td class="text-right tabular-nums">
                      {{ article.unitPrice | currency:'CHF':'code':'1.2-2' }}
                    </td>
                    <td class="hidden sm:table-cell">
                      @if (article.vatRateOverride != null) {
                        <span class="badge badge-outline badge-sm">
                          {{ (article.vatRateOverride * 100).toFixed(1) }}%
                        </span>
                      } @else {
                        <span class="text-base-content/30">—</span>
                      }
                    </td>
                    <td class="text-right tabular-nums">
                      <span [class.text-error]="article.stockQuantity < 0"
                            [class.text-warning]="article.stockQuantity === 0"
                            [class.font-semibold]="article.stockQuantity <= 0">
                        {{ article.stockQuantity }}
                      </span>
                      @if (article.stockQuantity < 0) {
                        <span class="badge badge-error badge-xs ml-1" [title]="t().articles.negativeStock">!</span>
                      } @else if (article.stockQuantity === 0) {
                        <span class="badge badge-warning badge-xs ml-1" [title]="t().articles.outOfStock">0</span>
                      }
                    </td>
                    <td>
                      <div class="flex gap-1 justify-end">
                        <button class="btn btn-ghost btn-sm" (click)="openEdit(article)">
                          {{ t().common.edit }}
                        </button>
                        <button class="btn btn-ghost btn-sm text-error" (click)="store.archive(article.id)">
                          {{ t().common.archive }}
                        </button>
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="6" class="text-center text-base-content/40 py-10">
                      {{ t().articles.noResults }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        @if (store.pages() > 1) {
          <div class="flex justify-center items-center gap-4 mt-4">
            <div class="join">
              @for (p of pageRange(); track p) {
                <button class="join-item btn btn-sm"
                  [class.btn-active]="store.page() === p"
                  (click)="store.setPage(p)">{{ p }}</button>
              }
            </div>
            <span class="text-sm text-base-content/50">
              {{ store.total() }} {{ t().common.results }}
            </span>
          </div>
        }
      }
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

  private searchTimer?: ReturnType<typeof setTimeout>;

  protected readonly pageRange = computed(() => {
    const total = this.store.pages();
    const current = this.store.page();
    const range: number[] = [];
    for (let i = Math.max(1, current - 2); i <= Math.min(total, current + 2); i++) {
      range.push(i);
    }
    return range;
  });

  onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.store.setSearch(value), 300);
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
