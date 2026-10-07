import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CustomerData } from './customer.model';
import { CustomerFormComponent } from './customer-form.component';

describe('CustomerFormComponent', () => {
  let fixture: ComponentFixture<CustomerFormComponent>;
  let saved: CustomerData[];
  let forInvoice: CustomerData[];
  const element = () => fixture.nativeElement as HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [CustomerFormComponent],
      providers: [provideZonelessChangeDetection()],
    });
    fixture = TestBed.createComponent(CustomerFormComponent);
    saved = [];
    forInvoice = [];
    fixture.componentInstance.saved.subscribe((data) => saved.push(data));
    fixture.componentInstance.savedForInvoice.subscribe((data) => forInvoice.push(data));
    await fixture.whenStable();
  });

  async function type(input: HTMLInputElement, value: string): Promise<void> {
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }
  const byId = (id: string) => element().querySelector(`#${id}`) as HTMLInputElement;

  async function save(): Promise<void> {
    element().querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  it('needs a name, a valid email and country', async () => {
    await type(byId('customer-email'), 'not-an-email');
    await type(byId('customer-country'), 'Suisse');
    await save();
    expect(saved).toEqual([]);
    expect(element().querySelectorAll('.text-error').length).toBe(3);
  });

  it('saves a company, its empty phone rows left out', async () => {
    await type(byId('customer-last-name'), ' Garage du Lac SA ');
    await type(byId('customer-country'), 'li');
    const addPhone = [...element().querySelectorAll('button')].find((b) => b.textContent?.includes('+'))!;
    addPhone.click();
    addPhone.click();
    await fixture.whenStable();
    const [label, number] = [...element().querySelectorAll('input[type="text"].input-bordered, input[type="tel"]')] as HTMLInputElement[];
    await type(label, 'Bureau');
    await type(number, '024 123 45 67');
    await save();
    expect(saved).toEqual([{
      firstName: '', lastName: 'Garage du Lac SA', email: null, addressLine1: '', addressLine2: null,
      postalCode: '', city: '', country: 'LI', phones: [{ label: 'Bureau', number: '024 123 45 67' }],
    }]);
  });

  it('saves and goes on to an invoice for a new customer', async () => {
    await type(byId('customer-last-name'), 'Dupont');
    const button = [...element().querySelectorAll('button')].find((b) => b.classList.contains('btn-outline'))!;
    button.click();
    await fixture.whenStable();
    expect(forInvoice.map((c) => c.lastName)).toEqual(['Dupont']);
  });
});
