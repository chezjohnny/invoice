import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { Component, provideZonelessChangeDetection } from '@angular/core';
import { Observable, delay } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { CUSTOMER_SERVICE } from '../../core/tokens/customer-service.token';
import { CustomerEditorComponent } from './customer-editor.component';
import { Customer } from './customer.model';
import { CustomersComponent } from './customers.component';
import { MockCustomerService } from './mock-customer.service';

class SlowCustomerService extends MockCustomerService {
  override getById(id: string): Observable<Customer> {
    return super.getById(id).pipe(delay(20));
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

@Component({ template: '' })
class Blank {}

describe('CustomerEditorComponent saving', () => {
  it('saves a new customer for an invoice: the invoice opens, the customer page under it', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideLocationMocks(),
        provideRouter([
          { path: 'customers', component: Blank },
          { path: 'customers/new', component: CustomerEditorComponent },
          { path: 'customers/:id', component: Blank },
          { path: 'invoices/new', component: Blank },
        ]),
        { provide: CUSTOMER_SERVICE, useClass: MockCustomerService },
      ],
    });
    const harness = await RouterTestingHarness.create();
    // As at the app's start: the router then follows the browser's back button.
    TestBed.inject(Router).initialNavigation();
    await harness.navigateByUrl('/customers');
    await harness.navigateByUrl('/customers/new');
    const element = harness.routeNativeElement!;
    const name = element.querySelector<HTMLInputElement>('#customer-last-name')!;
    name.value = 'Café du Pont';
    name.dispatchEvent(new Event('input'));
    await harness.fixture.whenStable();

    [...element.querySelectorAll('button')].find((b) => b.classList.contains('btn-outline'))!.click();
    await harness.fixture.whenStable();
    const router = TestBed.inject(Router);
    const id = router.parseUrl(router.url).queryParams['customer'];
    expect(router.url).toBe(`/invoices/new?customer=${id}&returnTo=%2Fcustomers%2F${id}`);

    // Leaving the invoice lands on the customer's page, not on the emptied form.
    TestBed.inject(Location).back();
    // The router takes up a "back" in a setTimeout, then navigates.
    await new Promise((resolve) => setTimeout(resolve));
    await harness.fixture.whenStable();
    expect(router.url).toBe(`/customers/${id}`);
  });
});
