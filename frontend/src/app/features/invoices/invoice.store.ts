import { inject } from '@angular/core';
import { patchState, signalStore, withHooks, withMethods, withState } from '@ngrx/signals';
import { INVOICE_SERVICE } from '../../core/tokens/invoice-service.token';
import {
  PagedListState, initialPagedList, loadPage, mutateThenLoad, pagedListMethods,
} from '../../shared/paged-list';
import { pagedListParams, queryParams, readPagedList, syncWithUrl } from '../../shared/url-state';
import { I18nService } from '../../core/i18n/i18n.service';
import { saveFile } from '../../shared/download';
import { INVOICE_STATUSES, Invoice, Payment, PaymentMethod, invoicePdfName, reminderPdfName } from './invoice.model';

interface InvoiceState extends PagedListState<Invoice> {
  statusFilter: string;
  /** Only this customer's invoices, on the customer's page; null = every customer. */
  customerId: string | null;
}

export const InvoiceStore = signalStore(
  withState<InvoiceState>({ ...initialPagedList<Invoice>(), statusFilter: 'all', customerId: null }),
  withMethods((store, service = inject(INVOICE_SERVICE), i18n = inject(I18nService)) => {
    const load = (): Promise<void> => loadPage(store, () => {
      const status = store.statusFilter();
      return service.list({
        search: store.search(),
        status: status === 'all' ? '' : status,
        customerId: store.customerId() ?? undefined,
        sort: store.sort(),
        page: store.page(),
        perPage: store.perPage(),
      });
    });
    const mutate = <R>(action: () => Promise<R>): Promise<R> => mutateThenLoad(store, action, load);

    async function printReminder(invoice: Invoice, number: number): Promise<void> {
      saveFile(
        await service.downloadReminderPdf(invoice.id, number, i18n.locale()),
        reminderPdfName(invoice, number),
      );
    }

    async function printPdf(invoice: Invoice): Promise<void> {
      saveFile(await service.downloadPdf(invoice.id, i18n.locale()), invoicePdfName(invoice));
    }

    return {
      load,
      ...pagedListMethods(store, load),
      setStatusFilter(value: string): Promise<void> {
        patchState(store, { statusFilter: value, page: 1 });
        return load();
      },
      /** `print`: download the receipt once paid, the paper copy for the accounts. */
      async pay(id: string, payment: Payment, print = false): Promise<void> {
        const paid = await mutate(() => service.pay(id, payment));
        if (print) await printPdf(paid);
      },
      async setPaymentDate(id: string, paidAt: string): Promise<void> {
        await mutate(() => service.updatePaymentDate(id, paidAt));
      },
      async setPaymentMethod(id: string, paymentMethod: PaymentMethod): Promise<void> {
        await mutate(() => service.updatePaymentMethod(id, paymentMethod));
      },
      async cancel(id: string): Promise<void> {
        await mutate(() => service.cancel(id));
      },
      async delete(id: string): Promise<void> {
        await mutate(() => service.delete(id));
        // The last invoice of a page gone: show the previous page rather than an empty one.
        if (store.items().length === 0 && store.page() > 1) {
          patchState(store, { page: store.page() - 1 });
          await load();
        }
      },
      /** The invoices of one customer, for the customer's page. */
      showCustomer(customerId: string): Promise<void> {
        patchState(store, { customerId });
        return load();
      },
      downloadPdf: printPdf,
      /** Records the next reminder, then downloads it to print and send. */
      async createReminder(id: string): Promise<void> {
        const invoice = await mutate(() => service.createReminder(id));
        await printReminder(invoice, invoice.reminders.length);
      },
      printReminder,
    };
  }),
  withHooks({
    // No load here: the page using the store loads it, with or without a customer.
    onInit(store) {
      // ?status= also comes from the dashboard's links (draft, issued, paid).
      const params = queryParams();
      const status = INVOICE_STATUSES.find((s) => s === params.get('status'));
      patchState(store, { ...readPagedList(params), statusFilter: status ?? 'all' });
      syncWithUrl(() => ({
        ...pagedListParams(store),
        status: store.statusFilter() === 'all' ? null : store.statusFilter(),
      }));
    },
  })
);
