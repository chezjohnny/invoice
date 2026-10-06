import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { customerDisplayName } from './customer.model';
import { CustomerStore } from './customer.store';
import { IconComponent } from '../../shared/components/icon.component';
import { PagerComponent } from '../../shared/components/pager.component';
import { SearchInputComponent } from '../../shared/components/search-input.component';
import { SortHeaderComponent } from '../../shared/components/sort-header.component';

@Component({
  selector: 'app-customers',
  providers: [CustomerStore],
  imports: [RouterLink, PagerComponent, SortHeaderComponent, SearchInputComponent, IconComponent],
  template: `
    <div class="p-4 md:p-6 max-w-5xl mx-auto">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-xl font-bold sm:text-2xl">{{ t().customers.title }}</h1>
        <a class="btn btn-primary btn-sm sm:btn-md" routerLink="/customers/new">
          {{ t().customers.new }}
        </a>
      </div>

      <div class="flex flex-wrap items-center gap-4 mb-4">
      <app-search-input [placeholder]="t().customers.search" [value]="store.search()"
        (valueChange)="store.setSearch($event)" />
      <label class="label cursor-pointer gap-2 text-sm">
        <input type="checkbox" class="toggle toggle-sm"
          [checked]="store.archived()" (change)="onToggleArchived($event)" />
        {{ t().common.showArchived }}
      </label>
      </div>

      <div class="flex items-center justify-between gap-2 mb-2">
        <span class="text-sm text-base-content/50">{{ store.total() }} {{ t().common.results }}</span>
        <button class="btn btn-ghost btn-xs hidden sm:inline-flex" (click)="store.exportCsv()">
          ↓ {{ t().customers.exportCsv }}
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
                  <th appSortHeader="name" [sort]="store.sort()" (sortChange)="store.toggleSort($event)">{{ t().customers.name }}</th>
                  <th class="hidden sm:table-cell" appSortHeader="email" [sort]="store.sort()" (sortChange)="store.toggleSort($event)">{{ t().customers.email }}</th>
                  <th class="hidden md:table-cell" appSortHeader="city" [sort]="store.sort()" (sortChange)="store.toggleSort($event)">{{ t().customers.city }}</th>
                  <th class="col-fit"></th>
                </tr>
              </thead>
              <tbody>
                @for (customer of store.items(); track customer.id) {
                  <tr>
                    <td class="font-medium">
                      <a [routerLink]="['/customers', customer.id]" class="hover:text-primary hover:underline">
                        {{ displayName(customer) }}
                      </a>
                      @if (customer.phones[0]; as phone) {
                        <div class="text-xs font-normal text-base-content/50 tabular-nums">{{ phone.number }}</div>
                      }
                    </td>
                    <td class="text-base-content/60 text-sm hidden sm:table-cell">
                      {{ customer.email ?? '—' }}
                    </td>
                    <td class="text-sm hidden md:table-cell">
                      {{ customer.postalCode }} {{ customer.city }}
                    </td>
                    <td class="col-fit">
                      <div class="flex gap-1 justify-end">
                        @if (customer.isArchived) {
                          <button class="btn btn-ghost btn-sm btn-square tooltip tooltip-left text-success" (click)="store.restore(customer.id)"
                            [attr.data-tip]="t().common.restore" [attr.aria-label]="t().common.restore">
                            <app-icon name="restore" />
                          </button>
                        } @else {
                          <a class="btn btn-ghost btn-sm btn-square tooltip tooltip-left"
                            [routerLink]="['/customers', customer.id, 'edit']"
                            [attr.data-tip]="t().common.edit" [attr.aria-label]="t().common.edit">
                            <app-icon name="edit" />
                          </a>
                          <button class="btn btn-ghost btn-sm btn-square tooltip tooltip-left text-error" (click)="store.archive(customer.id)"
                            [attr.data-tip]="t().common.archive" [attr.aria-label]="t().common.archive">
                            <app-icon name="archive" />
                          </button>
                        }
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="4" class="text-center text-base-content/40 py-10">
                      {{ t().customers.noResults }}
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
export class CustomersComponent {
  protected readonly store = inject(CustomerStore);
  protected readonly t = inject(I18nService).T;
  protected readonly displayName = customerDisplayName;

  onToggleArchived(event: Event): void {
    this.store.setArchived((event.target as HTMLInputElement).checked);
  }
}
