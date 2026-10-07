import { Component, inject, linkedSignal } from '@angular/core';
import { FormField, FormRoot, SchemaPath, form, max, min, required, validate } from '@angular/forms/signals';
import { I18nService } from '../../core/i18n/i18n.service';
import { AutofocusDirective } from '../../shared/autofocus.directive';
import { FieldErrorComponent } from '../../shared/components/field-error.component';
import { countryCode, integer, percent, requiredText, showsError } from '../../shared/form-errors';
import { percentOf, rateOf } from '../../shared/percent';
import { CompanyStore } from './company.store';
import { isValidQrBillIban, normalizeIban } from './iban';
import { isValidPhone, isValidTwintPhone, normalizePhone } from './phone';

interface ProfileModel {
  companyName: string;
  vatNumber: string;
  addressLine1: string;
  addressLine2: string;
  postalCode: string;
  city: string;
  country: string;
  iban: string;
  phone: string;
  twintPhone: string;
  /** 8.1 for 8.1 %; null: not VAT-registered. */
  vatPercent: number | null;
  paymentTermsDays: number | null;
  reminderTermsDays: number | null;
}

@Component({
  selector: 'app-settings',
  imports: [AutofocusDirective, FieldErrorComponent, FormField, FormRoot],
  template: `
    <div class="p-4 md:p-6 max-w-3xl mx-auto">
      <h1 class="text-xl font-bold sm:text-2xl mb-6">{{ t().settings.title }}</h1>

      @if (store.loading() && !store.profile()) {
        <div class="flex justify-center py-12">
          <span class="loading loading-spinner loading-lg"></span>
        </div>
      } @else if (!store.profile()) {
        <div role="alert" class="alert alert-error">
          <span>{{ t().settings.loadError }}</span>
          <button class="btn btn-sm" (click)="store.load()">{{ t().common.retry }}</button>
        </div>
      } @else {
        <form [formRoot]="profileForm" class="flex flex-col gap-4">
          <!-- ── Identity ── -->
          <section class="card bg-base-100 shadow">
            <div class="card-body gap-4">
              <h2 class="card-title text-base">{{ t().settings.identity }}</h2>
              <div>
                <label class="fieldset-label" for="settings-company-name">{{ t().settings.companyNameLabel }}</label>
                <input id="settings-company-name" appAutofocus class="input w-full" type="text"
                  [formField]="profileForm.companyName" />
                <app-field-error [field]="profileForm.companyName" />
              </div>
              <div>
                <label class="fieldset-label" for="settings-vat-number">{{ t().settings.vatNumberLabel }}</label>
                <input id="settings-vat-number" class="input w-full" type="text" [formField]="profileForm.vatNumber" />
              </div>
            </div>
          </section>

          <!-- ── Address ── -->
          <section class="card bg-base-100 shadow">
            <div class="card-body gap-4">
              <h2 class="card-title text-base">{{ t().settings.address }}</h2>
              <div>
                <label class="fieldset-label" for="settings-address">{{ t().settings.addressLabel }}</label>
                <input id="settings-address" class="input w-full" type="text" [formField]="profileForm.addressLine1" />
              </div>
              <div>
                <label class="fieldset-label" for="settings-address2">{{ t().settings.address2Label }}</label>
                <input id="settings-address2" class="input w-full" type="text" [formField]="profileForm.addressLine2" />
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label class="fieldset-label" for="settings-postal">{{ t().settings.postalLabel }}</label>
                  <input id="settings-postal" class="input w-full" type="text" [formField]="profileForm.postalCode" />
                </div>
                <div class="sm:col-span-2">
                  <label class="fieldset-label" for="settings-city">{{ t().settings.cityLabel }}</label>
                  <input id="settings-city" class="input w-full" type="text" [formField]="profileForm.city" />
                </div>
                <div>
                  <label class="fieldset-label" for="settings-country">{{ t().settings.countryLabel }}</label>
                  <input id="settings-country" class="input w-full" type="text"
                    [formField]="profileForm.country" />
                  <app-field-error [field]="profileForm.country" />
                </div>
              </div>
            </div>
          </section>

          <!-- ── Billing ── -->
          <section class="card bg-base-100 shadow">
            <div class="card-body gap-4">
              <h2 class="card-title text-base">{{ t().settings.billing }}</h2>
              <div>
                <label class="fieldset-label" for="settings-iban">{{ t().settings.ibanLabel }}</label>
                <input id="settings-iban" class="input w-full font-mono" type="text"
                  [formField]="profileForm.iban" />
                <app-field-error [field]="profileForm.iban" />
                @if (!showsError(profileForm.iban)) {
                  <p class="fieldset-label mt-1">{{ t().settings.ibanHint }}</p>
                }
              </div>
              <div class="sm:w-64">
                <label class="fieldset-label" for="settings-phone">{{ t().settings.phoneLabel }}</label>
                <input id="settings-phone" class="input w-full font-mono" type="tel" placeholder="024 123 45 67"
                  [formField]="profileForm.phone" />
                <app-field-error [field]="profileForm.phone" />
                @if (!showsError(profileForm.phone)) {
                  <p class="fieldset-label mt-1">{{ t().settings.phoneHint }}</p>
                }
              </div>
              <div class="sm:w-64">
                <label class="fieldset-label" for="settings-twint">{{ t().settings.twintLabel }}</label>
                <input id="settings-twint" class="input w-full font-mono" type="tel" placeholder="079 123 45 67"
                  [formField]="profileForm.twintPhone" />
                <app-field-error [field]="profileForm.twintPhone" />
                @if (!showsError(profileForm.twintPhone)) {
                  <p class="fieldset-label mt-1">{{ t().settings.twintHint }}</p>
                }
              </div>
              <div class="sm:w-48">
                <label class="fieldset-label" for="settings-vat-rate">{{ t().settings.vatRateLabel }}</label>
                <input id="settings-vat-rate" class="input w-full" type="number" step="0.1"
                  [formField]="profileForm.vatPercent" />
                <app-field-error [field]="profileForm.vatPercent" />
              </div>
            </div>
          </section>

          <!-- ── Deadlines ── -->
          <section class="card bg-base-100 shadow">
            <div class="card-body gap-4">
              <h2 class="card-title text-base">{{ t().settings.deadlines }}</h2>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="fieldset-label" for="settings-terms">{{ t().settings.termsLabel }}</label>
                  <input id="settings-terms" class="input w-full" type="number" step="1"
                    [formField]="profileForm.paymentTermsDays" />
                  <app-field-error [field]="profileForm.paymentTermsDays" />
                </div>
                <div>
                  <label class="fieldset-label" for="settings-reminder-terms">{{ t().settings.reminderTermsLabel }}</label>
                  <input id="settings-reminder-terms" class="input w-full" type="number" step="1"
                    [formField]="profileForm.reminderTermsDays" />
                  <app-field-error [field]="profileForm.reminderTermsDays" />
                </div>
              </div>
            </div>
          </section>

          <div class="flex justify-end">
            <button type="submit" class="btn btn-primary" [disabled]="store.saving()">
              @if (store.saving()) { <span class="loading loading-spinner loading-xs"></span> }
              {{ t().common.save }}
            </button>
          </div>
        </form>
      }
    </div>
  `,
})
export class SettingsComponent {
  protected readonly store = inject(CompanyStore);
  protected readonly t = inject(I18nService).T;
  protected readonly showsError = showsError;

  constructor() {
    // Never edit a stale profile: the shell loads it once at sign-in — and this
    // is also what recovers the page when that initial load failed.
    this.store.load();
  }

  protected readonly model = linkedSignal<ProfileModel>(() => {
    const p = this.store.profile();
    return {
      companyName: p?.companyName ?? '',
      vatNumber: p?.vatNumber ?? '',
      addressLine1: p?.addressLine1 ?? '',
      addressLine2: p?.addressLine2 ?? '',
      postalCode: p?.postalCode ?? '',
      city: p?.city ?? '',
      country: p?.country ?? 'CH',
      iban: p?.iban ?? '',
      phone: p?.phone ?? '',
      twintPhone: p?.twintPhone ?? '',
      vatPercent: percentOf(p?.defaultVatRate),
      paymentTermsDays: p?.paymentTermsDays ?? 30,
      reminderTermsDays: p?.reminderTermsDays ?? 10,
    };
  });

  protected readonly profileForm = form(
    this.model,
    (path) => {
      requiredText(path.companyName, () => this.t().settings.companyNameRequired);
      countryCode(path.country, () => this.t().common.invalidCountry);
      this.optional(path.iban, normalizeIban, isValidQrBillIban, () => this.t().settings.invalidIban);
      this.optional(path.phone, normalizePhone, isValidPhone, () => this.t().settings.invalidPhone);
      this.optional(path.twintPhone, normalizePhone, isValidTwintPhone, () => this.t().settings.invalidTwint);
      percent(path.vatPercent, () => this.t().common.invalidPercent);
      this.days(path.paymentTermsDays);
      this.days(path.reminderTermsDays);
    },
    { submission: { action: () => this.save() } }
  );

  /** An optional field: empty, or valid once normalized. */
  private optional(
    path: SchemaPath<string>,
    normalize: (value: string) => string,
    isValid: (value: string) => boolean,
    message: () => string,
  ): void {
    validate(path, ({ value }) => {
      const normalized = normalize(value());
      return normalized === '' || isValid(normalized) ? undefined : { kind: 'invalid', message: message() };
    });
  }

  /** A number of days, from 0 to 365. */
  private days(path: SchemaPath<number | null>): void {
    const message = () => this.t().settings.invalidTerms;
    required(path, { message });
    min(path, 0, { message });
    max(path, 365, { message });
    integer(path, message);
  }

  private async save(): Promise<void> {
    const m = this.model();
    const optional = (text: string) => text.trim() || null;
    await this.store.save({
      companyName: m.companyName.trim(),
      addressLine1: m.addressLine1.trim(),
      addressLine2: optional(m.addressLine2),
      postalCode: m.postalCode.trim(),
      city: m.city.trim(),
      country: m.country.trim().toUpperCase() || 'CH',
      iban: normalizeIban(m.iban) || null,
      twintPhone: normalizePhone(m.twintPhone) || null,
      phone: normalizePhone(m.phone) || null,
      vatNumber: optional(m.vatNumber),
      defaultVatRate: rateOf(m.vatPercent),
      paymentTermsDays: m.paymentTermsDays ?? 30,
      reminderTermsDays: m.reminderTermsDays ?? 10,
    });
  }
}
