import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { inputValue } from '../../shared/events';
import { ArticleListItem } from './article.model';
import { ArticleStore } from './article.store';
import { IconComponent } from '../../shared/components/icon.component';
import { PagerComponent } from '../../shared/components/pager.component';
import { SearchInputComponent } from '../../shared/components/search-input.component';
import { SortHeaderComponent } from '../../shared/components/sort-header.component';

@Component({
  selector: 'app-articles',
  providers: [ArticleStore],
  imports: [DecimalPipe, RouterLink, PagerComponent, SortHeaderComponent, SearchInputComponent, IconComponent],
  template: `
    <div class="p-4 md:p-6 max-w-5xl mx-auto">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-xl font-bold sm:text-2xl">{{ t().articles.title }}</h1>
        <div class="flex gap-2">
          <button type="button" class="btn btn-sm sm:btn-md"
            [class]="store.inventoryMode() ? 'btn-warning' : 'btn-outline'"
            [attr.aria-pressed]="store.inventoryMode()"
            [disabled]="store.archived()"
            (click)="store.setInventoryMode(!store.inventoryMode())">
            {{ t().articles.inventory }}
          </button>
          <a class="btn btn-primary btn-sm sm:btn-md" routerLink="/articles/new">
            {{ t().articles.new }}
          </a>
        </div>
      </div>

      @if (store.inventoryMode()) {
        <div role="note" class="alert alert-warning alert-soft text-sm mb-4">{{ t().articles.inventoryHint }}</div>
      }

      <div class="flex flex-wrap items-center gap-4 mb-4">
      <app-search-input [placeholder]="t().articles.search" [value]="store.search()"
        (valueChange)="store.setSearch($event)" />
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
      @if (store.salesYear() !== null) {
        <select class="select select-sm w-auto" [attr.aria-label]="t().articles.allQuarters"
          (change)="onSalesQuarter($event)">
          <option value="" [selected]="store.salesQuarter() === null">{{ t().articles.allQuarters }}</option>
          @for (quarter of quarters; track quarter) {
            <option [value]="quarter" [selected]="store.salesQuarter() === quarter">
              {{ t().articles.quarter }}{{ quarter }}
            </option>
          }
        </select>
      }
      </div>

      <div class="flex items-center justify-between gap-2 mb-2">
        <span class="text-sm text-base-content/50">{{ store.total() }} {{ t().common.results }}</span>
        <!-- What is listed (active or archived) over the selected sales period -->
        <button class="btn btn-ghost btn-xs" (click)="store.exportCsv()">
          ↓ {{ t().articles.exportCsv }}
          @if (period(); as p) { <span class="opacity-60">{{ p }}</span> }
        </button>
      </div>

      <!-- Spinner on the first load only: swapping a filled table for it on
           every reload would collapse the page and lose the scroll position -->
      @if (store.loading() && store.items().length === 0) {
        <div class="flex justify-center py-8">
          <span class="loading loading-spinner loading-md"></span>
        </div>
      } @else {
        <div class="card bg-base-100 shadow overflow-hidden transition-opacity"
          [class.opacity-60]="store.loading()" [class.pointer-events-none]="store.loading()">
          <div class="overflow-x-auto">
            <table class="table table-zebra w-full">
              <thead>
                <tr>
                  <th appSortHeader="name" [sort]="store.sort()" (sortChange)="store.toggleSort($event)">{{ t().articles.name }}</th>
                  <th class="hidden md:table-cell" appSortHeader="description" [sort]="store.sort()" (sortChange)="store.toggleSort($event)">{{ t().articles.description }}</th>
                  <th class="col-fit text-right" appSortHeader="unit_price" [sort]="store.sort()" (sortChange)="store.toggleSort($event)">{{ t().articles.unitPrice }}</th>
                  <th class="col-fit hidden sm:table-cell" appSortHeader="vat_rate_override" [sort]="store.sort()" (sortChange)="store.toggleSort($event)">{{ t().articles.vatOverride }}</th>
                  <th class="col-fit text-right" appSortHeader="stock_quantity" [sort]="store.sort()" (sortChange)="store.toggleSort($event)">{{ t().articles.stock }}</th>
                  <th class="col-fit text-right" appSortHeader="sold_quantity" [sort]="store.sort()" (sortChange)="store.toggleSort($event)">
                    {{ t().articles.sold }}
                    @if (period(); as p) { <span class="font-normal opacity-60">{{ p }}</span> }
                  </th>
                  <th class="col-fit text-right" appSortHeader="withdrawn_quantity" [sort]="store.sort()" (sortChange)="store.toggleSort($event)">
                    {{ t().articles.withdrawn }}
                    @if (period(); as p) { <span class="font-normal opacity-60">{{ p }}</span> }
                  </th>
                  <th class="col-fit"></th>
                </tr>
              </thead>
              <tbody>
                @for (article of store.items(); track article.id) {
                  <tr>
                    <td class="font-medium">{{ article.name }}</td>
                    <td class="text-base-content/60 text-sm hidden md:table-cell">
                      {{ article.description || '—' }}
                    </td>
                    <td class="col-fit text-right tabular-nums">
                      {{ article.unitPrice | number:'1.2-2' }}
                    </td>
                    <td class="col-fit hidden sm:table-cell">
                      @if (article.vatRateOverride != null) {
                        <span class="badge badge-outline badge-sm">
                          {{ (article.vatRateOverride * 100).toFixed(1) }}%
                        </span>
                      } @else {
                        <span class="text-base-content/30">—</span>
                      }
                    </td>
                    <td class="col-fit text-right tabular-nums">
                      @if (store.inventoryMode() && !article.isArchived) {
                        <!-- Saved when leaving the field (Tab, Enter): count article after article -->
                        <div class="flex items-center justify-end gap-1">
                          @if (counted().has(article.id)) {
                            <span class="text-success text-xs" aria-hidden="true">✓</span>
                          }
                          <input type="number" inputmode="numeric" min="0" step="1"
                            class="input input-sm w-20 text-right tabular-nums"
                            [attr.aria-label]="t().articles.stock + ' — ' + article.name"
                            [value]="article.stockQuantity" (change)="onCount(article, $event)" />
                        </div>
                      } @else {
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
                      }
                    </td>
                    <td class="col-fit text-right tabular-nums"
                        [class.text-base-content/40]="article.soldQuantity === 0">
                      {{ article.soldQuantity }}
                    </td>
                    <td class="col-fit text-right tabular-nums"
                        [class.text-base-content/40]="article.withdrawnQuantity === 0">
                      {{ article.withdrawnQuantity }}
                    </td>
                    <td class="col-fit">
                      <div class="flex gap-1 justify-end">
                        @if (article.isArchived) {
                          <button class="btn btn-ghost btn-sm btn-square tooltip tooltip-left text-success" (click)="store.restore(article.id)"
                            [attr.data-tip]="t().common.restore" [attr.aria-label]="t().common.restore">
                            <app-icon name="restore" />
                          </button>
                        } @else {
                          <a class="btn btn-ghost btn-sm btn-square tooltip tooltip-left"
                            [routerLink]="['/articles', article.id, 'edit']"
                            [attr.data-tip]="t().common.edit" [attr.aria-label]="t().common.edit">
                            <app-icon name="edit" />
                          </a>
                          <button class="btn btn-ghost btn-sm btn-square tooltip tooltip-left text-error" (click)="store.archive(article.id)"
                            [attr.data-tip]="t().common.archive" [attr.aria-label]="t().common.archive">
                            <app-icon name="archive" />
                          </button>
                        }
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="8" class="text-center text-base-content/40 py-10">
                      {{ t().articles.noResults }}
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        <app-pager [page]="store.page()" [pages]="store.pages()"
          (pageChange)="store.setPage($event)" />
      }
    </div>
  `,
})
export class ArticlesComponent {
  protected readonly store = inject(ArticleStore);
  protected readonly t = inject(I18nService).T;
  protected readonly quarters = [1, 2, 3, 4];
  /** Articles counted during this inventory, ticked next to their input. */
  protected readonly counted = signal<ReadonlySet<string>>(new Set());
  /** Sales period shown in the Sold and Withdrawn headers, e.g. "2025 Q2"; null = all time. */
  protected readonly period = computed(() => {
    const year = this.store.salesYear();
    if (year === null) return null;
    const quarter = this.store.salesQuarter();
    return quarter === null ? String(year) : `${year} ${this.t().articles.quarter}${quarter}`;
  });


  onSalesYear(event: Event): void {
    const value = inputValue(event);
    this.store.setSalesYear(value ? Number(value) : null);
  }

  onSalesQuarter(event: Event): void {
    const value = inputValue(event);
    this.store.setSalesQuarter(value ? Number(value) : null);
  }

  async onCount(article: ArticleListItem, event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const quantity = Number(input.value);
    if (input.value === '' || !Number.isInteger(quantity) || quantity < 0) {
      input.value = String(article.stockQuantity);
      return;
    }
    await this.store.countStock(article, quantity);
    this.counted.update((ids) => new Set(ids).add(article.id));
  }

  onToggleArchived(event: Event): void {
    this.store.setArchived((event.target as HTMLInputElement).checked);
  }
}
