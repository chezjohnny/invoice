import { inject } from '@angular/core';
import { tapResponse } from '@ngrx/operators';
import { patchState, signalStore, withHooks, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { Observable, mergeMap, tap } from 'rxjs';
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

/** `print`: download the receipt once paid, the paper copy for the accounts. */
interface PayRequest {
  id: string;
  payment: Payment;
  print: boolean;
}

interface ReminderPdf {
  invoice: Invoice;
  /** 1 for the first reminder, 2 for the second… */
  number: number;
}

export const InvoiceStore = signalStore(
  withState<InvoiceState>({ ...initialPagedList<Invoice>(), statusFilter: 'all', customerId: null }),
  withMethods((store, service = inject(INVOICE_SERVICE), i18n = inject(I18nService)) => {
    const load = loadPage(store, () => {
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

    // Downloads run side by side (mergeMap); a failed one leaves the others.
    const download = <A>(file: (arg: A) => Observable<unknown>) => rxMethod<A>(
      mergeMap((arg) => file(arg).pipe(tapResponse({ next: () => undefined, error: () => undefined }))),
    );
    const downloadPdf = download((invoice: Invoice) =>
      service.downloadPdf(invoice.id, i18n.locale()).pipe(tap((pdf) => saveFile(pdf, invoicePdfName(invoice)))),
    );
    const printReminder = download(({ invoice, number }: ReminderPdf) =>
      service.downloadReminderPdf(invoice.id, number, i18n.locale()).pipe(
        tap((pdf) => saveFile(pdf, reminderPdfName(invoice, number))),
      ),
    );

    return {
      load,
      ...pagedListMethods(store, load),
      setStatusFilter(value: string): void {
        patchState(store, { statusFilter: value, page: 1 });
        load();
      },
      pay: mutateThenLoad(
        store,
        ({ id, payment }: PayRequest) => service.pay(id, payment),
        load,
        (paid, { print }) => {
          if (print) downloadPdf(paid);
        },
      ),
      setPaymentDate: mutateThenLoad(
        store, ({ id, paidAt }: { id: string; paidAt: string }) => service.updatePaymentDate(id, paidAt), load,
      ),
      setPaymentMethod: mutateThenLoad(
        store,
        ({ id, paymentMethod }: { id: string; paymentMethod: PaymentMethod }) =>
          service.updatePaymentMethod(id, paymentMethod),
        load,
      ),
      cancel: mutateThenLoad(store, (id: string) => service.cancel(id), load),
      delete: mutateThenLoad(store, (id: string) => service.delete(id), load, () => {
        // The last invoice of a page gone: show the previous page rather than an empty one.
        if (store.items().length === 1 && store.page() > 1) patchState(store, { page: store.page() - 1 });
      }),
      /** The invoices of one customer, for the customer's page. */
      showCustomer(customerId: string): void {
        patchState(store, { customerId });
        load();
      },
      downloadPdf,
      /** Records the next reminder, then downloads it to print and send. */
      createReminder: mutateThenLoad(
        store, (id: string) => service.createReminder(id), load,
        (invoice) => printReminder({ invoice, number: invoice.reminders.length }),
      ),
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
