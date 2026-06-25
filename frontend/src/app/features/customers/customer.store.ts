import { inject } from '@angular/core';
import { patchState, signalStore, withHooks, withMethods, withState } from '@ngrx/signals';
import { CUSTOMER_SERVICE } from '../../core/tokens/customer-service.token';
import { Customer } from './customer.model';

interface CustomerState {
  items: Customer[];
  total: number;
  page: number;
  perPage: number;
  pages: number;
  search: string;
  loading: boolean;
}

export const CustomerStore = signalStore(
  withState<CustomerState>({
    items: [],
    total: 0,
    page: 1,
    perPage: 20,
    pages: 1,
    search: '',
    loading: false,
  }),
  withMethods((store, service = inject(CUSTOMER_SERVICE)) => {
    async function load(): Promise<void> {
      patchState(store, { loading: true });
      const result = await service.list({
        search: store.search(),
        page: store.page(),
        perPage: store.perPage(),
      });
      patchState(store, { ...result, loading: false });
    }
    return {
      load,
      setSearch(search: string): Promise<void> {
        patchState(store, { search, page: 1 });
        return load();
      },
      setPage(page: number): Promise<void> {
        patchState(store, { page });
        return load();
      },
      async createCustomer(data: Omit<Customer, 'id' | 'isArchived'>): Promise<void> {
        await service.create(data);
        await load();
      },
      async updateCustomer(id: string, data: Omit<Customer, 'id' | 'isArchived'>): Promise<void> {
        await service.update(id, data);
        await load();
      },
      async archive(id: string): Promise<void> {
        await service.archive(id);
        await load();
      },
      async exportCsv(): Promise<void> {
        const blob = await service.exportCsv();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'customers.csv';
        a.click();
        URL.revokeObjectURL(url);
      },
    };
  }),
  withHooks({ onInit(store) { store.load(); } })
);
