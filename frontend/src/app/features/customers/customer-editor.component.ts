import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { EditorPageComponent } from '../../shared/components/editor-page.component';
import { CUSTOMER_SERVICE } from '../../core/tokens/customer-service.token';
import { injectEditorExit } from '../../shared/editor-exit';
import { CustomerFormComponent } from './customer-form.component';
import { Customer, CustomerData } from './customer.model';


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
        (saved)="onSaved($event)"
        (savedForInvoice)="onSavedForInvoice($event)"
        (cancelled)="leave()"
      />
    </app-editor-page>
  `,
})
export class CustomerEditorComponent {
  private readonly customerService = inject(CUSTOMER_SERVICE);
  private readonly router = inject(Router);
  private readonly customerId = inject(ActivatedRoute).snapshot.paramMap.get('id');
  protected readonly leave = injectEditorExit(() =>
    this.customerId ? `/customers/${this.customerId}` : '/customers'
  );
  /** null while creating. */
  protected readonly customer = signal<Customer | null>(null);
  protected readonly loading = signal(this.customerId !== null);

  constructor() {
    if (this.customerId) {
      this.customerService.getById(this.customerId).then((customer) => {
        this.customer.set(customer);
        this.loading.set(false);
      });
    }
  }

  protected async onSaved(data: CustomerData): Promise<void> {
    if (this.customerId) {
      await this.customerService.update(this.customerId, data);
      this.leave();
    } else {
      // Straight to the new customer's page: the next step is usually their invoice.
      await this.openCreated(data);
    }
  }

  protected async onSavedForInvoice(data: CustomerData): Promise<void> {
    const customer = await this.openCreated(data);
    // On top of the customer's page, so that leaving the invoice lands there.
    await this.router.navigate(['/invoices/new'], {
      queryParams: { customer: customer.id, returnTo: `/customers/${customer.id}` },
    });
  }

  // The new customer's page replaces this form in the history: back from it
  // returns to where the customer was created from, never to an emptied form.
  private async openCreated(data: CustomerData): Promise<Customer> {
    const customer = await this.customerService.create(data);
    await this.router.navigate(['/customers', customer.id], { replaceUrl: true });
    return customer;
  }
}
