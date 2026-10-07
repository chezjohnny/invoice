import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { CUSTOMER_SERVICE } from '../../core/tokens/customer-service.token';
import { CustomerEditorComponent } from './customer-editor.component';
import { Customer } from './customer.model';
import { CustomersComponent } from './customers.component';
import { MockCustomerService } from './mock-customer.service';

class SlowCustomerService extends MockCustomerService {
  override getById(id: string): Promise<Customer> {
    return new Promise((resolve) => setTimeout(() => resolve(super.getById(id)), 20));
  }
}

describe('CustomerEditorComponent focus', () => {
  async function open(url: string): Promise<Element | null> {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([
          { path: 'customers', component: CustomersComponent },
          { path: 'customers/new', component: CustomerEditorComponent },
          { path: 'customers/:id/edit', component: CustomerEditorComponent },
        ]),
        // Answers after a while, as over the network: the form then shows late.
        { provide: CUSTOMER_SERVICE, useClass: SlowCustomerService },
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/customers');
    await harness.navigateByUrl(url);
    await new Promise((resolve) => setTimeout(resolve, 50));
    await harness.fixture.whenStable();
    return document.activeElement;
  }

  afterEach(() => vi.unstubAllGlobals());

  it('puts the cursor in the name of a new customer', async () => {
    expect((await open('/customers/new'))?.id).toBe('customer-last-name');
  });

  // The form only enters the page once the customer has loaded.
  it('puts the cursor in the name of a customer being edited', async () => {
    expect((await open('/customers/1/edit'))?.id).toBe('customer-last-name');
  });
});
