import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { I18nService } from '../../core/i18n/i18n.service';
import { EditorPageComponent } from '../../shared/components/editor-page.component';
import { once } from '../../shared/busy';
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
            (saved)="onSaved($event)"
            (cancelled)="leave()"
            (issuedAndPrinted)="onIssuedAndPrinted($event)"
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

  protected onSaved(data: InvoiceCreate): Promise<void> {
    return once(this.saving, async () => {
      await this.store.saveDraft(data);
      this.leave();
    });
  }

  protected onIssuedAndPrinted(data: InvoiceCreate): Promise<void> {
    return once(this.saving, async () => {
      await this.store.issueAndPrint(data);
      this.leave();
    });
  }
}
