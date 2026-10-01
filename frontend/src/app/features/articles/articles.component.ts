import { CurrencyPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { Article } from './article.model';
import { ArticleFormComponent } from './article-form.component';
import { ArticleStore } from './article.store';
import { PagerComponent } from '../../shared/components/pager.component';
import { SearchInputComponent } from '../../shared/components/search-input.component';
import { SortHeaderComponent } from '../../shared/components/sort-header.component';

@Component({
  selector: 'app-articles',
  providers: [ArticleStore],
  imports: [CurrencyPipe, ArticleFormComponent, PagerComponent, SortHeaderComponent, SearchInputComponent],
  template: `
    <div class="p-4 md:p-6 max-w-5xl mx-auto">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-xl font-bold sm:text-2xl">{{ t().articles.title }}</h1>
        <button class="btn btn-primary btn-sm sm:btn-md" (click)="openNew()">
          {{ t().articles.new }}
        </button>
      </div>

      <div class="flex flex-wrap items-center gap-4 mb-4">
      <app-search-input [placeholder]="t().articles.search" [value]="store.search()"
        (search)="store.setSearch($event)" />
      <label class="label cursor-pointer gap-2 text-sm">
        <input type="checkbox" class="toggle toggle-sm"
          [checked]="store.archived()" (change)="onToggleArchived($event)" />
        {{ t().common.showArchived }}
      </label>
      <label class="select select-sm w-auto">
        <span class="label">{{ t().articles.salesYear }}</span>
        <select (change)="onSalesYear($event)">
          <option value="" [selected]="store.salesYear() === null">{{ t().articles.allYears }}</option>
          @for (year of store.salesYears(); track year) {
            <option [value]="year" [selected]="store.salesYear() === year">{{ year }}</option>
          }
        </select>
      </label>
      </div>

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
                  <th appSortHeader="name" [sort]="store.sort()" (sortChange)="store.toggleSort($event)">{{ t().articles.name }}</th>
                  <th class="hidden md:table-cell" appSortHeader="description" [sort]="store.sort()" (sortChange)="store.toggleSort($event)">{{ t().articles.description }}</th>
                  <th class="text-right" appSortHeader="unit_price" [sort]="store.sort()" (sortChange)="store.toggleSort($event)">{{ t().articles.unitPrice }}</th>
                  <th class="hidden sm:table-cell" appSortHeader="vat_rate_override" [sort]="store.sort()" (sortChange)="store.toggleSort($event)">{{ t().articles.vatOverride }}</th>
                  <th class="text-right" appSortHeader="stock_quantity" [sort]="store.sort()" (sortChange)="store.toggleSort($event)">{{ t().articles.stock }}</th>
                  <th class="text-right" appSortHeader="sold_quantity" [sort]="store.sort()" (sortChange)="store.toggleSort($event)">
                    {{ t().articles.sold }}
                    @if (store.salesYear() !== null) {
                      <span class="font-normal opacity-60">{{ store.salesYear() }}</span>
                    }
                  </th>
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
                    <td class="text-right tabular-nums"
                        [class.text-base-content/40]="article.soldQuantity === 0">
                      {{ article.soldQuantity }}
                    </td>
                    <td>
                      <div class="flex gap-1 justify-end">
                        @if (article.isArchived) {
                          <button class="btn btn-ghost btn-sm text-success" (click)="store.restore(article.id)">
                            {{ t().common.restore }}
                          </button>
                        } @else {
                          <button class="btn btn-ghost btn-sm" (click)="openEdit(article)">
                            {{ t().common.edit }}
                          </button>
                          <button class="btn btn-ghost btn-sm text-error" (click)="store.archive(article.id)">
                            {{ t().common.archive }}
                          </button>
                        }
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="7" class="text-center text-base-content/40 py-10">
                      {{ t().articles.noResults }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        <app-pager [page]="store.page()" [pages]="store.pages()" [total]="store.total()"
          (pageChange)="store.setPage($event)" />
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


  onSalesYear(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.store.setSalesYear(value ? Number(value) : null);
  }

  onToggleArchived(event: Event): void {
    this.store.setArchived((event.target as HTMLInputElement).checked);
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
