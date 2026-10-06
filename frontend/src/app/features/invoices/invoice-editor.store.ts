import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
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
  loading: boolean;
}

/** Backs the invoice editor page: one draft, created or edited for one customer. */
export const InvoiceEditorStore = signalStore(
  withState<InvoiceEditorState>({ invoice: null, customer: null, articles: [], loading: true }),
  withMethods((
    store,
    invoices = inject(INVOICE_SERVICE),
    customers = inject(CUSTOMER_SERVICE),
    articleService = inject(ARTICLE_SERVICE),
    i18n = inject(I18nService),
  ) => {
    // Once created, the draft is updated: a retry after a failed issue must
    // not create a second one.
    async function save(data: InvoiceCreate): Promise<Invoice> {
      const current = store.invoice();
      const invoice = current ? await invoices.update(current.id, data) : await invoices.create(data);
      patchState(store, { invoice });
      return invoice;
    }

    return {
      /** Edit `invoiceId`, or create a draft for `customerId`. */
      async load(target: { invoiceId: string } | { customerId: string }): Promise<void> {
        patchState(store, { loading: true });
        try {
          const invoice = 'invoiceId' in target ? await invoices.getById(target.invoiceId) : null;
          const customerId = invoice?.customerId ?? ('customerId' in target ? target.customerId : '');
          const [customer, articles] = await Promise.all([
            customers.getById(customerId),
            articleService.getAll(),
          ]);
          patchState(store, { invoice, customer, articles });
        } finally {
          patchState(store, { loading: false });
        }
      },
      async saveDraft(data: InvoiceCreate): Promise<void> {
        await save(data);
      },
      /** A cash invoice is settled on the spot: its PDF is printed paid today. */
      async issueAndPrint(data: InvoiceCreate): Promise<void> {
        const draft = await save(data);
        let invoice = await invoices.issue(draft.id);
        if (data.paymentMethod === 'cash') invoice = await invoices.pay(draft.id);
        patchState(store, { invoice });
        saveFile(await invoices.downloadPdf(invoice.id, i18n.locale()), invoicePdfName(invoice));
      },
    };
  })
);
