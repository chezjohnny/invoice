import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { tapResponse } from '@ngrx/operators';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { exhaustMap } from 'rxjs';
import { I18nService } from '../../core/i18n/i18n.service';
import { EditorPageComponent } from '../../shared/components/editor-page.component';
import { injectEditorExit } from '../../shared/editor-exit';
import { CompanyStore } from '../settings/company.store';
import { InvoiceFormComponent } from './invoice-form.component';
import { InvoiceCreate } from './invoice.model';
import { InvoiceEditorStore } from './invoice-editor.store';

/**
 * Full page to create (`/invoices/new?customer=…`) or edit (`/invoices/:id/edit`)
 * a draft: room for the keyboard on a phone, and the back button cancels.
 * `?returnTo=` is where to go once done, the customer's page by default.
 */
@Component({
  selector: 'app-invoice-editor',
  providers: [InvoiceEditorStore],
  imports: [EditorPageComponent, InvoiceFormComponent],
  template: `
    <app-editor-page [loading]="store.loading()" [wide]="true" (back)="leave()">
      @if (store.customer(); as customer) {
        @if (store.invoice()?.status && store.invoice()!.status !== 'draft') {
          <p class="text-base-content/60 py-8 text-center">{{ t().invoices.onlyDraftEditable }}</p>
        } @else {
          <app-invoice-form
            [invoice]="store.invoice()"
            [customer]="customer"
            [articles]="store.articles()"
            [archivedArticles]="store.archivedArticles()"
            [canIssue]="!company.isIncomplete()"
            [defaultVatRate]="company.profile()?.defaultVatRate ?? null"
            [busy]="saving()"
            (saved)="save({ data: $event, issue: false })"
            (cancelled)="leave()"
            (issuedAndPrinted)="save({ data: $event, issue: true })"
          />
        }
      }
    </app-editor-page>
  `,
})
export class InvoiceEditorComponent {
  protected readonly store = inject(InvoiceEditorStore);
  protected readonly company = inject(CompanyStore);
  protected readonly t = inject(I18nService).T;
  protected readonly saving = signal(false);
  private readonly route = inject(ActivatedRoute);
  protected readonly leave = injectEditorExit(() => this.returnTo());

  protected readonly returnTo = computed(() => {
    const target = this.route.snapshot.queryParamMap.get('returnTo');
    // Only an in-app path: never bounce to another site.
    if (target?.startsWith('/') && !target.startsWith('//')) return target;
    const customerId = this.store.customer()?.id;
    return customerId ? `/customers/${customerId}` : '/invoices';
  });

  constructor() {
    const params = this.route.snapshot;
    const invoiceId = params.paramMap.get('id');
    this.store.load(
      invoiceId ? { invoiceId } : { customerId: params.queryParamMap.get('customer') ?? '' }
    );
  }

  /** Saves the draft (and issues it), then leaves; a second click while saving is ignored. */
  protected readonly save = rxMethod<{ data: InvoiceCreate; issue: boolean }>(
    exhaustMap(({ data, issue }) => {
      this.saving.set(true);
      return (issue ? this.store.issueAndPrint(data) : this.store.saveDraft(data)).pipe(
        tapResponse({
          next: () => this.leave(),
          error: () => undefined, // errorInterceptor already surfaced a toast
          finalize: () => this.saving.set(false),
        }),
      );
    }),
  );
}
