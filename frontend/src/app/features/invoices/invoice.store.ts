import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import { setAllEntities, setEntity, withEntities } from '@ngrx/signals/entities';
import { INVOICE_SERVICE } from '../../core/tokens/invoice-service.token';
import { Invoice, InvoiceCreate, InvoiceUpdate } from './invoice.model';

export const InvoiceStore = signalStore(
  withEntities<Invoice>(),
  withState({ statusFilter: 'all' }),
  withComputed(({ entities, statusFilter }) => ({
    filteredInvoices: computed(() => {
      const f = statusFilter();
      return entities().filter((i) => f === 'all' || i.status === f);
    }),
  })),
  withMethods((store, service = inject(INVOICE_SERVICE)) => ({
    async load(): Promise<void> {
      const invoices = await service.getAll();
      patchState(store, setAllEntities(invoices));
    },
    async createInvoice(data: InvoiceCreate): Promise<void> {
      const invoice = await service.create(data);
      patchState(store, setEntity(invoice));
    },
    async updateInvoice(id: string, data: InvoiceUpdate): Promise<void> {
      const invoice = await service.update(id, data);
      patchState(store, setEntity(invoice));
    },
    async issue(id: string): Promise<void> {
      const invoice = await service.issue(id);
      patchState(store, setEntity(invoice));
    },
    async pay(id: string): Promise<void> {
      const invoice = await service.pay(id);
      patchState(store, setEntity(invoice));
    },
    async cancel(id: string): Promise<void> {
      const invoice = await service.cancel(id);
      patchState(store, setEntity(invoice));
    },
    async downloadPdf(id: string): Promise<void> {
      const blob = await service.downloadPdf(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'invoice.pdf';
      a.click();
      URL.revokeObjectURL(url);
    },
    setStatusFilter(value: string): void {
      patchState(store, { statusFilter: value });
    },
  })),
  withHooks({ onInit(store) { store.load(); } })
);
