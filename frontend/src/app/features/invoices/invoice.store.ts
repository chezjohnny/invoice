import { inject } from '@angular/core';
import { patchState, signalStore, withHooks, withMethods, withState } from '@ngrx/signals';
import { INVOICE_SERVICE } from '../../core/tokens/invoice-service.token';
import { Invoice, InvoiceCreate, InvoiceUpdate } from './invoice.model';

interface InvoiceState {
  items: Invoice[];
  total: number;
  page: number;
  perPage: number;
  pages: number;
  search: string;
  statusFilter: string;
  loading: boolean;
}

export const InvoiceStore = signalStore(
  withState<InvoiceState>({
    items: [],
    total: 0,
    page: 1,
    perPage: 20,
    pages: 1,
    search: '',
    statusFilter: 'all',
    loading: false,
  }),
  withMethods((store, service = inject(INVOICE_SERVICE)) => {
    async function load(): Promise<void> {
      patchState(store, { loading: true });
      const status = store.statusFilter();
      try {
        const result = await service.list({
          search: store.search(),
          status: status === 'all' ? '' : status,
          page: store.page(),
          perPage: store.perPage(),
        });
        patchState(store, { ...result, loading: false });
      } catch (error) {
        patchState(store, { loading: false });
        throw error;
      }
    }

    // A mutation can legitimately fail — issuing with an incomplete company
    // profile is rejected with a 422 — and the list must never stay stuck
    // behind its spinner when it does.
    async function mutate<T>(action: () => Promise<T>): Promise<T> {
      patchState(store, { loading: true });
      try {
        const result = await action();
        await load();
        return result;
      } catch (error) {
        patchState(store, { loading: false });
        throw error;
      }
    }

    async function print(id: string): Promise<void> {
      const blob = await service.downloadPdf(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'invoice.pdf';
      a.click();
      URL.revokeObjectURL(url);
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
      setStatusFilter(value: string): Promise<void> {
        patchState(store, { statusFilter: value, page: 1 });
        return load();
      },
      createInvoice(data: InvoiceCreate): Promise<Invoice> {
        return mutate(() => service.create(data));
      },
      async issueAndPrint(id: string): Promise<void> {
        await mutate(async () => {
          await service.issue(id);
          await print(id);
        });
      },
      async updateInvoice(id: string, data: InvoiceUpdate): Promise<void> {
        await mutate(() => service.update(id, data));
      },
      async issue(id: string): Promise<void> {
        await mutate(() => service.issue(id));
      },
      async pay(id: string): Promise<void> {
        await mutate(() => service.pay(id));
      },
      async cancel(id: string): Promise<void> {
        await mutate(() => service.cancel(id));
      },
      downloadPdf: print,
    };
  }),
  withHooks({ onInit(store) { store.load(); } })
);
