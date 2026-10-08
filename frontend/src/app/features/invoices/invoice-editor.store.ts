import { inject } from '@angular/core';
import { tapResponse } from '@ngrx/operators';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { Observable, forkJoin, map, of, switchMap, tap } from 'rxjs';
import { I18nService } from '../../core/i18n/i18n.service';
import { ARTICLE_SERVICE } from '../../core/tokens/article-service.token';
import { CUSTOMER_SERVICE } from '../../core/tokens/customer-service.token';
import { INVOICE_SERVICE } from '../../core/tokens/invoice-service.token';
import { saveFile } from '../../shared/download';
import { Article } from '../articles/article.model';
import { Customer } from '../customers/customer.model';
import { Invoice, InvoiceCreate, invoicePdfName } from './invoice.model';

interface InvoiceEditorState {
  /** null while creating, until the first save persists the draft. */
  invoice: Invoice | null;
  customer: Customer | null;
  articles: Article[];
  /** For the suggestions: what the customer bought before may be archived since. */
  archivedArticles: Article[];
  loading: boolean;
}

/** Backs the invoice editor page: one draft, created or edited for one customer. */
export const InvoiceEditorStore = signalStore(
  withState<InvoiceEditorState>({
    invoice: null, customer: null, articles: [], archivedArticles: [], loading: true,
  }),
  withMethods((
    store,
    invoices = inject(INVOICE_SERVICE),
    customers = inject(CUSTOMER_SERVICE),
    articleService = inject(ARTICLE_SERVICE),
    i18n = inject(I18nService),
  ) => {
    // Once created, the draft is updated: a retry after a failed issue must
    // not create a second one.
    const save = (data: InvoiceCreate): Observable<Invoice> => {
      const current = store.invoice();
      return (current ? invoices.update(current.id, data) : invoices.create(data)).pipe(
        tap((invoice) => patchState(store, { invoice })),
      );
    };

    return {
      /** Edit `invoiceId`, or create a draft for `customerId`. */
      load: rxMethod<{ invoiceId: string } | { customerId: string }>(
        switchMap((target) => {
          patchState(store, { loading: true });
          const existing: Observable<Invoice | null> =
            'invoiceId' in target ? invoices.getById(target.invoiceId) : of(null);
          return existing.pipe(
            switchMap((invoice) => forkJoin({
              customer: customers.getById(invoice?.customerId ?? ('customerId' in target ? target.customerId : '')),
              articles: articleService.getAll(),
              archivedArticles: articleService.getAll(true),
            }).pipe(map((loaded) => ({ invoice, ...loaded })))),
            tapResponse({
              next: (loaded) => patchState(store, loaded),
              error: () => undefined, // errorInterceptor already surfaced a toast
              finalize: () => patchState(store, { loading: false }),
            }),
          );
        }),
      ),
      // These two return what the page chains on (saved, then leave), for its rxMethod.
      saveDraft: save,
      /** A cash invoice is settled on the spot: its PDF is printed paid today. */
      issueAndPrint: (data: InvoiceCreate): Observable<Invoice> => save(data).pipe(
        switchMap((draft) => invoices.issue(draft.id)),
        switchMap((issued) => (data.paymentMethod === 'cash' ? invoices.pay(issued.id) : of(issued))),
        tap((invoice) => patchState(store, { invoice })),
        switchMap((invoice) => invoices.downloadPdf(invoice.id, i18n.locale()).pipe(
          tap((pdf) => saveFile(pdf, invoicePdfName(invoice))),
          map(() => invoice),
        )),
      ),
    };
  })
);
