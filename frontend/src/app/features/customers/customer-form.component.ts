import { Component, inject, input, linkedSignal, output } from '@angular/core';
import { FormField, FormRoot, email, form, submit } from '@angular/forms/signals';
import { I18nService } from '../../core/i18n/i18n.service';
import { AutofocusDirective } from '../../shared/autofocus.directive';
import { FieldErrorComponent } from '../../shared/components/field-error.component';
import { FormActionsComponent } from '../../shared/components/form-actions.component';
import { countryCode, requiredText } from '../../shared/form-errors';
import { Customer, CustomerData, PhoneEntry } from './customer.model';

interface CustomerModel {
  lastName: string;
  firstName: string;
  email: string;
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  city: string;
  country: string;
  phones: PhoneEntry[];
}

@Component({
  selector: 'app-customer-form',
  imports: [AutofocusDirective, FieldErrorComponent, FormActionsComponent, FormField, FormRoot],
  template: `
    <form [formRoot]="customerForm">
      <h1 class="text-xl font-bold sm:text-2xl mb-5">
        {{ customer() ? t().customers.editTitle : t().customers.newTitle }}
      </h1>

      <fieldset class="fieldset gap-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label class="fieldset-label" for="customer-last-name">{{ t().customers.lastNameLabel }}</label>
            <input id="customer-last-name" appAutofocus class="input w-full" type="text" [formField]="customerForm.lastName" />
            <app-field-error [field]="customerForm.lastName" />
          </div>
          <div>
            <label class="fieldset-label" for="customer-first-name">{{ t().customers.firstNameLabel }}</label>
            <input id="customer-first-name" class="input w-full" type="text" [formField]="customerForm.firstName" />
          </div>
        </div>

        <div>
          <label class="fieldset-label" for="customer-email">{{ t().customers.emailLabel }}</label>
          <input id="customer-email" class="input w-full" type="email" [formField]="customerForm.email" />
          <app-field-error [field]="customerForm.email" />
        </div>

        <div>
          <label class="fieldset-label" for="customer-address">{{ t().customers.addressLabel }}</label>
          <input id="customer-address" class="input w-full" type="text" [formField]="customerForm.addressLine1" />
        </div>

        <div>
          <label class="fieldset-label" for="customer-address2">{{ t().customers.address2Label }}</label>
          <input id="customer-address2" class="input w-full" type="text" [formField]="customerForm.addressLine2" />
        </div>

        <div class="grid grid-cols-3 gap-3">
          <div>
            <label class="fieldset-label" for="customer-postal">{{ t().customers.postalLabel }}</label>
            <input id="customer-postal" class="input w-full" type="text" [formField]="customerForm.postalCode" />
          </div>
          <div class="col-span-2">
            <label class="fieldset-label" for="customer-city">{{ t().customers.cityLabel }}</label>
            <input id="customer-city" class="input w-full" type="text" [formField]="customerForm.city" />
          </div>
        </div>

        <div>
          <label class="fieldset-label" for="customer-country">{{ t().customers.countryLabel }}</label>
          <input id="customer-country" class="input w-24" type="text" [formField]="customerForm.country" />
          <app-field-error [field]="customerForm.country" />
        </div>

        <div>
          <span class="fieldset-label">{{ t().customers.phonesLabel }}</span>
          @for (phone of customerForm.phones; track $index) {
            <div class="flex gap-2 mb-2">
              <input type="text" class="input input-bordered w-28"
                [placeholder]="t().customers.phoneKind" [attr.aria-label]="t().customers.phoneKind"
                [formField]="phone.label" />
              <input type="tel" class="input input-bordered flex-1"
                [placeholder]="t().customers.phoneNumber" [attr.aria-label]="t().customers.phoneNumber"
                [formField]="phone.number" />
              <button type="button" class="btn btn-square btn-ghost btn-sm text-error"
                [attr.aria-label]="t().common.delete" (click)="removePhone($index)">✕</button>
            </div>
          }
          <button type="button" class="btn btn-ghost btn-sm mt-1" (click)="addPhone()">
            {{ t().customers.addPhone }}
          </button>
        </div>
      </fieldset>

      <app-form-actions [busy]="busy()" (cancelled)="cancelled.emit()">
        <!-- A new customer usually calls to order: straight on to the invoice -->
        @if (!customer()) {
          <button type="button" class="btn btn-outline" [disabled]="busy()" (click)="saveForInvoice()">
            {{ t().customers.saveAndInvoice }}
          </button>
        }
      </app-form-actions>
    </form>
  `,
})
export class CustomerFormComponent {
  readonly customer = input<Customer | null>(null);
  readonly busy = input(false);
  readonly saved = output<CustomerData>();
  /** Saved from "Save & create invoice": only offered for a new customer. */
  readonly savedForInvoice = output<CustomerData>();
  readonly cancelled = output<void>();

  protected readonly t = inject(I18nService).T;

  protected readonly model = linkedSignal<CustomerModel>(() => {
    const c = this.customer();
    return {
      lastName: c?.lastName ?? '',
      firstName: c?.firstName ?? '',
      email: c?.email ?? '',
      addressLine1: c?.addressLine1 ?? '',
      addressLine2: c?.addressLine2 ?? '',
      postalCode: c?.postalCode ?? '',
      city: c?.city ?? '',
      country: c?.country ?? 'CH',
      phones: c?.phones ?? [],
    };
  });

  protected readonly customerForm = form(
    this.model,
    (path) => {
      requiredText(path.lastName, () => this.t().customers.lastNameRequired);
      email(path.email, { message: () => this.t().customers.invalidEmail });
      countryCode(path.country, () => this.t().common.invalidCountry);
    },
    { submission: { action: async () => this.saved.emit(this.payload()) } }
  );

  protected addPhone(): void {
    this.model.update((m) => ({ ...m, phones: [...m.phones, { label: '', number: '' }] }));
  }

  protected removePhone(index: number): void {
    this.model.update((m) => ({ ...m, phones: m.phones.filter((_, i) => i !== index) }));
  }

  protected saveForInvoice(): void {
    submit(this.customerForm, async () => this.savedForInvoice.emit(this.payload()));
  }

  private payload(): CustomerData {
    const m = this.model();
    const optional = (text: string) => text.trim() || null;
    return {
      firstName: m.firstName.trim(),
      lastName: m.lastName.trim(),
      email: optional(m.email),
      addressLine1: m.addressLine1.trim(),
      addressLine2: optional(m.addressLine2),
      postalCode: m.postalCode.trim(),
      city: m.city.trim(),
      country: m.country.trim().toUpperCase() || 'CH',
      // A row added then left empty is not a phone.
      phones: m.phones
        .map((p) => ({ label: p.label.trim(), number: p.number.trim() }))
        .filter((p) => p.number !== ''),
    };
  }
}
