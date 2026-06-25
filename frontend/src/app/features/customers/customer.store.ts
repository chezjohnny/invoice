import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import { setAllEntities, setEntity, updateEntity, withEntities } from '@ngrx/signals/entities';
import { CUSTOMER_SERVICE } from '../../core/tokens/customer-service.token';
import { Customer } from './customer.model';

export const CustomerStore = signalStore(
  withEntities<Customer>(),
  withState({ filter: '' }),
  withComputed(({ entities, filter }) => ({
    filteredCustomers: computed(() =>
      entities().filter(
        (c) =>
          !c.isArchived &&
          `${c.firstName} ${c.lastName}`.toLowerCase().includes(filter().toLowerCase())
      )
    ),
  })),
  withMethods((store, service = inject(CUSTOMER_SERVICE)) => ({
    async load(): Promise<void> {
      const customers = await service.getAll();
      patchState(store, setAllEntities(customers));
    },
    async createCustomer(data: Omit<Customer, 'id' | 'isArchived'>): Promise<void> {
      const customer = await service.create(data);
      patchState(store, setEntity(customer));
    },
    async updateCustomer(id: string, data: Omit<Customer, 'id' | 'isArchived'>): Promise<void> {
      const customer = await service.update(id, data);
      patchState(store, setEntity(customer));
    },
    async archive(id: string): Promise<void> {
      await service.archive(id);
      patchState(store, updateEntity({ id, changes: { isArchived: true } }));
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
    setFilter(value: string): void {
      patchState(store, { filter: value });
    },
  })),
  withHooks({ onInit(store) { store.load(); } })
);
