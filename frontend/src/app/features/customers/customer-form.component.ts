import { Component, computed, inject, input, linkedSignal, output } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { FormActionsComponent } from '../../shared/components/form-actions.component';
import { inputValue } from '../../shared/events';
import { Customer, PhoneEntry, CustomerData } from './customer.model';


@Component({
  selector: 'app-customer-form',
  imports: [FormActionsComponent],
  template: `
    <form (submit)="submit($event)">
      <h1 class="text-xl font-bold sm:text-2xl mb-5">
        {{ customer() ? t().customers.editTitle : t().customers.newTitle }}
      </h1>

      <fieldset class="fieldset gap-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="fieldset-label" for="customer-last-name">{{ t().customers.lastNameLabel }}</label>
            <input id="customer-last-name" class="input w-full" [class.input-error]="submitted() && errors().lastName"
              type="text" [value]="lastName()" (input)="lastName.set(inputValue($event))" />
            @if (submitted() && errors().lastName) {
              <p class="fieldset-label text-error mt-1">{{ errors().lastName }}</p>
            }
          </div>
          <div>
            <label class="fieldset-label" for="customer-first-name">{{ t().customers.firstNameLabel }}</label>
            <input id="customer-first-name" class="input w-full"
              type="text" [value]="firstName()" (input)="firstName.set(inputValue($event))" />
          </div>
        </div>

        <div>
          <label class="fieldset-label" for="customer-email">{{ t().customers.emailLabel }}</label>
          <input id="customer-email" class="input w-full" [class.input-error]="submitted() && errors().email"
            type="email" [value]="email()" (input)="email.set(inputValue($event))" />
          @if (submitted() && errors().email) {
            <p class="fieldset-label text-error mt-1">{{ errors().email }}</p>
          }
        </div>

        <div>
          <label class="fieldset-label" for="customer-address">{{ t().customers.addressLabel }}</label>
          <input id="customer-address" class="input w-full" type="text"
            [value]="addressLine1()" (input)="addressLine1.set(inputValue($event))" />
        </div>

        <div>
          <label class="fieldset-label" for="customer-address2">{{ t().customers.address2Label }}</label>
          <input id="customer-address2" class="input w-full" type="text"
            [value]="addressLine2()" (input)="addressLine2.set(inputValue($event))" />
        </div>

        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="fieldset-label" for="customer-postal">{{ t().customers.postalLabel }}</label>
            <input id="customer-postal" class="input w-full" type="text"
              [value]="postalCode()" (input)="postalCode.set(inputValue($event))" />
          </div>
          <div class="col-span-2">
            <label class="fieldset-label" for="customer-city">{{ t().customers.cityLabel }}</label>
            <input id="customer-city" class="input w-full" type="text"
              [value]="city()" (input)="city.set(inputValue($event))" />
          </div>
        </div>

        <div class="w-24">
          <label class="fieldset-label" for="customer-country">{{ t().customers.countryLabel }}</label>
          <input id="customer-country" class="input w-full" type="text" maxlength="2"
            [value]="country()" (input)="country.set(inputValue($event))" />
        </div>

        <div>
          <span class="fieldset-label">{{ t().customers.phonesLabel }}</span>
          @for (phone of phones(); track $index) {
            <div class="flex gap-2 mb-2">
              <input type="text" placeholder="Label" class="input input-bordered w-28"
                [value]="phone.label"
                (input)="updatePhone($index, 'label', inputValue($event))" />
              <input type="tel" placeholder="Number" class="input input-bordered flex-1"
                [value]="phone.number"
                (input)="updatePhone($index, 'number', inputValue($event))" />
              <button type="button" class="btn btn-square btn-ghost btn-sm text-error"
                (click)="removePhone($index)">✕</button>
            </div>
          }
          <button type="button" class="btn btn-ghost btn-sm mt-1" (click)="addPhone()">
            {{ t().customers.addPhone }}
          </button>
        </div>
      </fieldset>

      <app-form-actions (cancelled)="cancelled.emit()">
        <!-- A new customer usually calls to order: straight on to the invoice -->
        @if (!customer()) {
          <button type="button" class="btn btn-outline" (click)="submitForInvoice()">
            {{ t().customers.saveAndInvoice }}
          </button>
        }
      </app-form-actions>
    </form>
  `,
})
export class CustomerFormComponent {
  readonly customer = input<Customer | null>(null);
  readonly saved = output<CustomerData>();
  /** Saved from "Save & create invoice": only offered for a new customer. */
  readonly savedForInvoice = output<CustomerData>();
  readonly cancelled = output<void>();

  protected readonly t = inject(I18nService).T;
  protected readonly inputValue = inputValue;

  protected readonly firstName = linkedSignal(() => this.customer()?.firstName ?? '');
  protected readonly lastName = linkedSignal(() => this.customer()?.lastName ?? '');
  protected readonly email = linkedSignal(() => this.customer()?.email ?? '');
  protected readonly addressLine1 = linkedSignal(() => this.customer()?.addressLine1 ?? '');
  protected readonly addressLine2 = linkedSignal(() => this.customer()?.addressLine2 ?? '');
  protected readonly postalCode = linkedSignal(() => this.customer()?.postalCode ?? '');
  protected readonly city = linkedSignal(() => this.customer()?.city ?? '');
  protected readonly country = linkedSignal(() => this.customer()?.country ?? 'CH');
  protected readonly phones = linkedSignal<PhoneEntry[]>(() => this.customer()?.phones ?? []);
  protected readonly submitted = linkedSignal(() => { this.customer(); return false; });

  protected readonly errors = computed(() => ({
    lastName: this.lastName().trim() === '' ? this.t().customers.lastNameRequired : null,
    email: (() => {
      const v = this.email().trim();
      if (v === '') return null;
      return v.includes('@') ? null : this.t().customers.invalidEmail;
    })(),
  }));

  protected readonly isValid = computed(() =>
    Object.values(this.errors()).every((e) => e === null)
  );

  protected addPhone(): void {
    this.phones.update((phones) => [...phones, { label: '', number: '' }]);
  }

  protected removePhone(index: number): void {
    this.phones.update((phones) => phones.filter((_, i) => i !== index));
  }

  protected updatePhone(index: number, field: 'label' | 'number', value: string): void {
    this.phones.update((phones) =>
      phones.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  }

  submit(event: Event): void {
    event.preventDefault();
    const data = this.validPayload();
    if (data) this.saved.emit(data);
  }

  protected submitForInvoice(): void {
    const data = this.validPayload();
    if (data) this.savedForInvoice.emit(data);
  }

  private validPayload(): CustomerData | null {
    this.submitted.set(true);
    if (!this.isValid()) return null;
    const emailVal = this.email().trim();
    const addressLine2 = this.addressLine2().trim();
    return {
      firstName: this.firstName().trim(),
      lastName: this.lastName().trim(),
      email: emailVal !== '' ? emailVal : null,
      addressLine1: this.addressLine1().trim(),
      addressLine2: addressLine2 !== '' ? addressLine2 : null,
      postalCode: this.postalCode().trim(),
      city: this.city().trim(),
      country: this.country().trim() || 'CH',
      phones: this.phones(),
    };
  }
}
