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
      const result = await service.list({
        search: store.search(),
        status: status === 'all' ? '' : status,
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
      setStatusFilter(value: string): Promise<void> {
        patchState(store, { statusFilter: value, page: 1 });
        return load();
      },
      async createInvoice(data: InvoiceCreate): Promise<Invoice> {
        patchState(store, { loading: true });
        const invoice = await service.create(data);
        await load();
        return invoice;
      },
      async issueAndPrint(id: string): Promise<void> {
        patchState(store, { loading: true });
        await service.issue(id);
        const blob = await service.downloadPdf(id);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'invoice.pdf';
        a.click();
        URL.revokeObjectURL(url);
        await load();
      },
      async updateInvoice(id: string, data: InvoiceUpdate): Promise<void> {
        patchState(store, { loading: true });
        await service.update(id, data);
        await load();
      },
      async issue(id: string): Promise<void> {
        patchState(store, { loading: true });
        await service.issue(id);
        await load();
      },
      async pay(id: string): Promise<void> {
        patchState(store, { loading: true });
        await service.pay(id);
        await load();
      },
      async cancel(id: string): Promise<void> {
        patchState(store, { loading: true });
        await service.cancel(id);
        await load();
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
    };
  }),
  withHooks({ onInit(store) { store.load(); } })
);
