import { Location } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { tapResponse } from '@ngrx/operators';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { exhaustMap } from 'rxjs';
import { EditorPageComponent } from '../../shared/components/editor-page.component';
import { CUSTOMER_SERVICE } from '../../core/tokens/customer-service.token';
import { injectEditorExit } from '../../shared/editor-exit';
import { CustomerFormComponent } from './customer-form.component';
import { Customer, CustomerData } from './customer.model';


/** What the form saved, and whether a new invoice for the customer comes next. */
interface Save {
  data: CustomerData;
  thenInvoice: boolean;
}

/**
 * Full page to create (`/customers/new`) or edit (`/customers/:id/edit`) a
 * customer: room for the keyboard on a phone, and the back button cancels.
 */
@Component({
  selector: 'app-customer-editor',
  imports: [EditorPageComponent, CustomerFormComponent],
  template: `
    <app-editor-page [loading]="loading()" (back)="leave()">
      <app-customer-form
        [customer]="customer()"
        [busy]="saving()"
        (saved)="save({ data: $event, thenInvoice: false })"
        (savedForInvoice)="save({ data: $event, thenInvoice: true })"
        (cancelled)="leave()"
      />
    </app-editor-page>
  `,
})
export class CustomerEditorComponent {
  private readonly customerService = inject(CUSTOMER_SERVICE);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly customerId = inject(ActivatedRoute).snapshot.paramMap.get('id');
  protected readonly leave = injectEditorExit(() =>
    this.customerId ? `/customers/${this.customerId}` : '/customers'
  );
  // While creating there are no params: nothing to load.
  private readonly loaded = rxResource({
    params: () => this.customerId ?? undefined,
    stream: ({ params: id }) => this.customerService.getById(id),
  });
  /** null while creating. */
  protected readonly customer = computed(() => (this.loaded.hasValue() ? this.loaded.value() : null));
  protected readonly loading = this.loaded.isLoading;
  protected readonly saving = signal(false);

  /** Saves, then moves on; a second click while saving is ignored (exhaustMap). */
  protected readonly save = rxMethod<Save>(
    exhaustMap(({ data, thenInvoice }) => {
      this.saving.set(true);
      const saved = this.customerId
        ? this.customerService.update(this.customerId, data)
        : this.customerService.create(data);
      return saved.pipe(
        tapResponse({
          next: (customer) => (this.customerId ? this.leave() : this.openCreated(customer, thenInvoice)),
          error: () => undefined, // errorInterceptor already surfaced a toast
          finalize: () => this.saving.set(false),
        }),
      );
    }),
  );

  // The new customer's page replaces this form in the history: back from it
  // returns to where the customer was created from, never to an emptied form.
  // Straight to it, as the next step is usually their invoice; or, with
  // `thenInvoice`, it only takes the form's place in the history, under the new
  // invoice, so that leaving the invoice lands on it: one navigation, as this
  // page and its subscriptions are gone once the first one ends.
  private openCreated(customer: Customer, thenInvoice: boolean): void {
    const page = `/customers/${customer.id}`;
    if (!thenInvoice) {
      this.router.navigateByUrl(page, { replaceUrl: true });
      return;
    }
    this.location.replaceState(page);
    this.router.navigate(['/invoices/new'], { queryParams: { customer: customer.id, returnTo: page } });
  }
}
