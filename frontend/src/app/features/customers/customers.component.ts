import { Component, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { Customer } from './customer.model';
import { CustomerFormComponent } from './customer-form.component';
import { CustomerStore } from './customer.store';

@Component({
  selector: 'app-customers',
  providers: [CustomerStore],
  imports: [CustomerFormComponent],
  template: `
    <div class="p-6 max-w-5xl mx-auto">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold">{{ t().customers.title }}</h1>
        <div class="flex gap-2">
          <button class="btn btn-outline btn-sm" (click)="store.exportCsv()">
            {{ t().customers.exportCsv }}
          </button>
          <button class="btn btn-primary" (click)="openNew()">{{ t().customers.new }}</button>
        </div>
      </div>

      <label class="input mb-4 w-full max-w-sm flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 opacity-50" viewBox="0 0 16 16">
          <path fill-rule="evenodd" d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001q.044.06.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1 1 0 0 0-.115-.099zm-5.242 1.156a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11"/>
        </svg>
        <input type="text" [placeholder]="t().customers.search"
          [value]="store.search()" (input)="onSearch($event)" />
      </label>

      @if (store.loading()) {
        <div class="flex justify-center py-8">
          <span class="loading loading-spinner loading-md"></span>
        </div>
      } @else {
        <div class="overflow-x-auto">
          <table class="table table-zebra w-full">
            <thead>
              <tr>
                <th>{{ t().customers.name }}</th>
                <th>{{ t().customers.email }}</th>
                <th>{{ t().customers.city }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (customer of store.items(); track customer.id) {
                <tr>
                  <td class="font-medium">{{ customer.lastName }}, {{ customer.firstName }}</td>
                  <td class="text-base-content/60 text-sm">{{ customer.email ?? '—' }}</td>
                  <td class="text-sm">{{ customer.postalCode }} {{ customer.city }}</td>
                  <td class="flex gap-1">
                    <button class="btn btn-ghost btn-xs" (click)="openEdit(customer)">
                      {{ t().common.edit }}
                    </button>
                    <button class="btn btn-ghost btn-xs" (click)="store.archive(customer.id)">
                      {{ t().common.archive }}
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="4" class="text-center text-base-content/40 py-8">
                    {{ t().customers.noResults }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (store.pages() > 1) {
          <div class="flex justify-center mt-4">
            <div class="join">
              @for (p of pageRange(); track p) {
                <button class="join-item btn btn-sm"
                  [class.btn-active]="store.page() === p"
                  (click)="store.setPage(p)">{{ p }}</button>
              }
            </div>
            <span class="ml-4 text-sm text-base-content/50 self-center">
              {{ store.total() }} {{ t().common.results }}
            </span>
          </div>
        }
      }
    </div>

    @if (showForm()) {
      <dialog class="modal modal-open">
        <div class="modal-box">
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
