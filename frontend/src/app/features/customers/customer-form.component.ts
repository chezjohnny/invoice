import { Component, computed, inject, input, linkedSignal, output } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { Customer, PhoneEntry } from './customer.model';

type CustomerData = Omit<Customer, 'id' | 'isArchived'>;

@Component({
  selector: 'app-customer-form',
  template: `
    <form (submit)="submit($event)">
      <h3 class="text-lg font-semibold mb-5">
        {{ customer() ? t().customers.editTitle : t().customers.newTitle }}
      </h3>

      <fieldset class="fieldset gap-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="fieldset-label">{{ t().customers.firstNameLabel }}</label>
            <input class="input w-full" [class.input-error]="submitted() && errors().firstName"
              type="text" [value]="firstName()" (input)="firstName.set(asStr($event))" />
            @if (submitted() && errors().firstName) {
              <p class="fieldset-label text-error mt-1">{{ errors().firstName }}</p>
            }
          </div>
          <div>
            <label class="fieldset-label">{{ t().customers.lastNameLabel }}</label>
            <input class="input w-full" [class.input-error]="submitted() && errors().lastName"
              type="text" [value]="lastName()" (input)="lastName.set(asStr($event))" />
            @if (submitted() && errors().lastName) {
              <p class="fieldset-label text-error mt-1">{{ errors().lastName }}</p>
            }
          </div>
        </div>

        <div>
          <label class="fieldset-label">{{ t().customers.emailLabel }}</label>
          <input class="input w-full" [class.input-error]="submitted() && errors().email"
            type="email" [value]="email()" (input)="email.set(asStr($event))" />
          @if (submitted() && errors().email) {
            <p class="fieldset-label text-error mt-1">{{ errors().email }}</p>
          }
        </div>

        <div>
          <label class="fieldset-label">{{ t().customers.addressLabel }}</label>
          <input class="input w-full" type="text"
            [value]="addressLine1()" (input)="addressLine1.set(asStr($event))" />
        </div>

        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="fieldset-label">{{ t().customers.postalLabel }}</label>
            <input class="input w-full" type="text"
              [value]="postalCode()" (input)="postalCode.set(asStr($event))" />
          </div>
          <div class="col-span-2">
            <label class="fieldset-label">{{ t().customers.cityLabel }}</label>
            <input class="input w-full" type="text"
              [value]="city()" (input)="city.set(asStr($event))" />
          </div>
        </div>

        <div class="w-24">
          <label class="fieldset-label">{{ t().customers.countryLabel }}</label>
          <input class="input w-full" type="text" maxlength="2"
            [value]="country()" (input)="country.set(asStr($event))" />
        </div>

        <div>
          <label class="fieldset-label">{{ t().customers.phonesLabel }}</label>
          @for (phone of phones(); track $index) {
            <div class="flex gap-2 mb-2">
              <input type="text" placeholder="Label" class="input input-bordered w-28"
                [value]="phone.label"
                (input)="updatePhone($index, 'label', asStr($event))" />
              <input type="tel" placeholder="Number" class="input input-bordered flex-1"
                [value]="phone.number"
                (input)="updatePhone($index, 'number', asStr($event))" />
              <button type="button" class="btn btn-square btn-ghost btn-sm text-error"
                (click)="removePhone($index)">✕</button>
            </div>
          }
          <button type="button" class="btn btn-ghost btn-sm mt-1" (click)="addPhone()">
            {{ t().customers.addPhone }}
          </button>
        </div>
      </fieldset>

      <div class="flex justify-end gap-2 mt-6">
        <button type="button" class="btn btn-ghost" (click)="cancelled.emit()">
          {{ t().common.cancel }}
        </button>
        <button type="submit" class="btn btn-primary">{{ t().common.save }}</button>
      </div>
    </form>
  `,
})
export class CustomerFormComponent {
  readonly customer = input<Customer | null>(null);
  readonly saved = output<CustomerData>();
  readonly cancelled = output<void>();

  protected readonly t = inject(I18nService).T;

  protected readonly firstName = linkedSignal(() => this.customer()?.firstName ?? '');
  protected readonly lastName = linkedSignal(() => this.customer()?.lastName ?? '');
  protected readonly email = linkedSignal(() => this.customer()?.email ?? '');
  protected readonly addressLine1 = linkedSignal(() => this.customer()?.addressLine1 ?? '');
  protected readonly postalCode = linkedSignal(() => this.customer()?.postalCode ?? '');
  protected readonly city = linkedSignal(() => this.customer()?.city ?? '');
  protected readonly country = linkedSignal(() => this.customer()?.country ?? 'CH');
  protected readonly phones = linkedSignal<PhoneEntry[]>(() => this.customer()?.phones ?? []);
  protected readonly submitted = linkedSignal(() => { this.customer(); return false; });

  protected readonly errors = computed(() => ({
    firstName: this.firstName().trim() === '' ? this.t().customers.firstNameRequired : null,
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

  protected asStr(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  submit(event: Event): void {
    event.preventDefault();
    this.submitted.set(true);
    if (!this.isValid()) return;
    const emailVal = this.email().trim();
    this.saved.emit({
      firstName: this.firstName().trim(),
      lastName: this.lastName().trim(),
      email: emailVal !== '' ? emailVal : null,
      addressLine1: this.addressLine1().trim(),
      postalCode: this.postalCode().trim(),
      city: this.city().trim(),
      country: this.country().trim() || 'CH',
      phones: this.phones(),
    });
  }
}
