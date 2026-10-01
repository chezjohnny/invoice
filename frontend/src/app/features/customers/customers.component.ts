import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { Customer } from './customer.model';
import { CustomerFormComponent } from './customer-form.component';
import { CustomerStore } from './customer.store';
import { PagerComponent } from '../../shared/components/pager.component';
import { SearchInputComponent } from '../../shared/components/search-input.component';
import { SortHeaderComponent } from '../../shared/components/sort-header.component';

@Component({
  selector: 'app-customers',
  providers: [CustomerStore],
  imports: [CustomerFormComponent, RouterLink, PagerComponent, SortHeaderComponent, SearchInputComponent],
  template: `
    <div class="p-4 md:p-6 max-w-5xl mx-auto">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-xl font-bold sm:text-2xl">{{ t().customers.title }}</h1>
        <div class="flex gap-2">
          <button class="btn btn-outline btn-sm hidden sm:flex" (click)="store.exportCsv()">
            {{ t().customers.exportCsv }}
          </button>
          <button class="btn btn-primary btn-sm sm:btn-md" (click)="openNew()">
            {{ t().customers.new }}
          </button>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-4 mb-4">
      <app-search-input [placeholder]="t().customers.search" [value]="store.search()"
        (search)="store.setSearch($event)" />
      <label class="label cursor-pointer gap-2 text-sm">
        <input type="checkbox" class="toggle toggle-sm"
          [checked]="store.archived()" (change)="onToggleArchived($event)" />
        {{ t().common.showArchived }}
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
                  <th appSortHeader="name" [sort]="store.sort()" (sortChange)="store.toggleSort($event)">{{ t().customers.name }}</th>
                  <th class="hidden sm:table-cell" appSortHeader="email" [sort]="store.sort()" (sortChange)="store.toggleSort($event)">{{ t().customers.email }}</th>
                  <th class="hidden md:table-cell" appSortHeader="city" [sort]="store.sort()" (sortChange)="store.toggleSort($event)">{{ t().customers.city }}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (customer of store.items(); track customer.id) {
                  <tr>
                    <td class="font-medium">
                      <a [routerLink]="['/customers', customer.id]" class="hover:text-primary hover:underline">
                        {{ customer.lastName }}, {{ customer.firstName }}
                      </a>
                    </td>
                    <td class="text-base-content/60 text-sm hidden sm:table-cell">
                      {{ customer.email ?? '—' }}
                    </td>
                    <td class="text-sm hidden md:table-cell">
                      {{ customer.postalCode }} {{ customer.city }}
                    </td>
                    <td>
                      <div class="flex gap-1 justify-end">
                        @if (customer.isArchived) {
                          <button class="btn btn-ghost btn-sm text-success" (click)="store.restore(customer.id)">
                            {{ t().common.restore }}
                          </button>
                        } @else {
                          <button class="btn btn-ghost btn-sm" (click)="openEdit(customer)">
                            {{ t().common.edit }}
                          </button>
                          <button class="btn btn-ghost btn-sm text-error" (click)="store.archive(customer.id)">
                            {{ t().common.archive }}
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

        <app-pager [page]="store.page()" [pages]="store.pages()" [total]="store.total()"
          (pageChange)="store.setPage($event)" />
      }
    </div>

    @if (showForm()) {
      <dialog class="modal modal-open">
        <div class="modal-box w-full max-w-lg">
          <app-customer-form
            [customer]="editingCustomer()"
            (saved)="onSaved($event)"
            (cancelled)="closeForm()"
          />
        </div>
        <div class="modal-backdrop" (click)="closeForm()"></div>
      </dialog>
    }
  `,
})
export class CustomersComponent {
  protected readonly store = inject(CustomerStore);
  protected readonly t = inject(I18nService).T;
  protected readonly showForm = signal(false);
  protected readonly editingCustomer = signal<Customer | null>(null);


  onToggleArchived(event: Event): void {
    this.store.setArchived((event.target as HTMLInputElement).checked);
  }

  openNew(): void {
    this.editingCustomer.set(null);
    this.showForm.set(true);
  }

  openEdit(customer: Customer): void {
    this.editingCustomer.set(customer);
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
  }

  async onSaved(data: Omit<Customer, 'id' | 'isArchived'>): Promise<void> {
    const editing = this.editingCustomer();
    if (editing) {
      await this.store.updateCustomer(editing.id, data);
    } else {
      await this.store.createCustomer(data);
    }
    this.closeForm();
  }
}
