import { Component, computed, inject, linkedSignal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { inputValue } from '../../shared/events';
import { isPercent, percentFromRate, rateFromPercent } from '../../shared/percent';
import { CompanyStore } from './company.store';
import { isValidQrBillIban, normalizeIban } from './iban';
import { isValidPhone, isValidTwintPhone, normalizePhone } from './phone';
import { AutofocusDirective } from '../../shared/autofocus.directive';

function validTerms(value: string): boolean {
  const days = Number(value);
  return Number.isInteger(days) && days >= 0 && days <= 365;
}

@Component({
  selector: 'app-settings',
  imports: [AutofocusDirective],
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
        <form (submit)="submit($event)" class="flex flex-col gap-4">
          <!-- ── Identity ── -->
          <section class="card bg-base-100 shadow">
            <div class="card-body gap-4">
              <h2 class="card-title text-base">{{ t().settings.identity }}</h2>
              <div>
                <label class="fieldset-label" for="settings-company-name">{{ t().settings.companyNameLabel }}</label>
                <input id="settings-company-name" appAutofocus class="input w-full" [class.input-error]="submitted() && errors().companyName"
                  type="text" [value]="companyName()" (input)="companyName.set(inputValue($event))" />
                @if (submitted() && errors().companyName) {
                  <p class="fieldset-label text-error mt-1">{{ errors().companyName }}</p>
                }
              </div>
              <div>
                <label class="fieldset-label" for="settings-vat-number">{{ t().settings.vatNumberLabel }}</label>
                <input id="settings-vat-number" class="input w-full" type="text"
                  [value]="vatNumber()" (input)="vatNumber.set(inputValue($event))" />
              </div>
            </div>
          </section>

          <!-- ── Address ── -->
          <section class="card bg-base-100 shadow">
            <div class="card-body gap-4">
              <h2 class="card-title text-base">{{ t().settings.address }}</h2>
              <div>
                <label class="fieldset-label" for="settings-address">{{ t().settings.addressLabel }}</label>
                <input id="settings-address" class="input w-full" type="text"
                  [value]="addressLine1()" (input)="addressLine1.set(inputValue($event))" />
              </div>
              <div>
                <label class="fieldset-label" for="settings-address2">{{ t().settings.address2Label }}</label>
                <input id="settings-address2" class="input w-full" type="text"
                  [value]="addressLine2()" (input)="addressLine2.set(inputValue($event))" />
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label class="fieldset-label" for="settings-postal">{{ t().settings.postalLabel }}</label>
                  <input id="settings-postal" class="input w-full" type="text"
                    [value]="postalCode()" (input)="postalCode.set(inputValue($event))" />
                </div>
                <div class="sm:col-span-2">
                  <label class="fieldset-label" for="settings-city">{{ t().settings.cityLabel }}</label>
                  <input id="settings-city" class="input w-full" type="text"
                    [value]="city()" (input)="city.set(inputValue($event))" />
                </div>
                <div>
                  <label class="fieldset-label" for="settings-country">{{ t().settings.countryLabel }}</label>
                  <input id="settings-country" class="input w-full" type="text" maxlength="2"
                    [value]="country()" (input)="country.set(inputValue($event))" />
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
                <input id="settings-iban" class="input w-full font-mono" [class.input-error]="submitted() && errors().iban"
                  type="text" [value]="iban()" (input)="iban.set(inputValue($event))" />
                @if (submitted() && errors().iban) {
                  <p class="fieldset-label text-error mt-1">{{ errors().iban }}</p>
                } @else {
                  <p class="fieldset-label mt-1">{{ t().settings.ibanHint }}</p>
                }
              </div>
              <div class="sm:w-64">
                <label class="fieldset-label" for="settings-phone">{{ t().settings.phoneLabel }}</label>
                <input id="settings-phone" class="input w-full font-mono" [class.input-error]="submitted() && errors().phone"
                  type="tel" placeholder="024 123 45 67"
                  [value]="phone()" (input)="phone.set(inputValue($event))" />
                @if (submitted() && errors().phone) {
                  <p class="fieldset-label text-error mt-1">{{ errors().phone }}</p>
                } @else {
                  <p class="fieldset-label mt-1">{{ t().settings.phoneHint }}</p>
                }
              </div>
              <div class="sm:w-64">
                <label class="fieldset-label" for="settings-twint">{{ t().settings.twintLabel }}</label>
                <input id="settings-twint" class="input w-full font-mono" [class.input-error]="submitted() && errors().twintPhone"
                  type="tel" placeholder="079 123 45 67"
                  [value]="twintPhone()" (input)="twintPhone.set(inputValue($event))" />
                @if (submitted() && errors().twintPhone) {
                  <p class="fieldset-label text-error mt-1">{{ errors().twintPhone }}</p>
                } @else {
                  <p class="fieldset-label mt-1">{{ t().settings.twintHint }}</p>
                }
              </div>
              <div class="sm:w-48">
                <label class="fieldset-label" for="settings-vat-rate">{{ t().settings.vatRateLabel }}</label>
                <input id="settings-vat-rate" class="input w-full" [class.input-error]="submitted() && errors().vatRate"
                  type="number" min="0" max="100" step="0.1"
                  [value]="vatRate()" (input)="vatRate.set(inputValue($event))" />
                @if (submitted() && errors().vatRate) {
                  <p class="fieldset-label text-error mt-1">{{ errors().vatRate }}</p>
                }
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
                  <input id="settings-terms" class="input w-full" [class.input-error]="submitted() && errors().paymentTermsDays"
                    type="number" min="0" max="365" step="1"
                    [value]="paymentTermsDays()" (input)="paymentTermsDays.set(inputValue($event))" />
                  @if (submitted() && errors().paymentTermsDays) {
                    <p class="fieldset-label text-error mt-1">{{ errors().paymentTermsDays }}</p>
                  }
                </div>
                <div>
                  <label class="fieldset-label" for="settings-reminder-terms">{{ t().settings.reminderTermsLabel }}</label>
                  <input id="settings-reminder-terms" class="input w-full" [class.input-error]="submitted() && errors().reminderTermsDays"
                    type="number" min="0" max="365" step="1"
                    [value]="reminderTermsDays()" (input)="reminderTermsDays.set(inputValue($event))" />
                  @if (submitted() && errors().reminderTermsDays) {
                    <p class="fieldset-label text-error mt-1">{{ errors().reminderTermsDays }}</p>
                  }
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
  protected readonly inputValue = inputValue;

  constructor() {
    // Never edit a stale profile: the shell loads it once at sign-in — and this
    // is also what recovers the page when that initial load failed.
    this.store.load();
  }

  protected readonly companyName = linkedSignal(() => this.store.profile()?.companyName ?? '');
  protected readonly addressLine1 = linkedSignal(() => this.store.profile()?.addressLine1 ?? '');
  protected readonly addressLine2 = linkedSignal(() => this.store.profile()?.addressLine2 ?? '');
  protected readonly postalCode = linkedSignal(() => this.store.profile()?.postalCode ?? '');
  protected readonly city = linkedSignal(() => this.store.profile()?.city ?? '');
  protected readonly country = linkedSignal(() => this.store.profile()?.country ?? 'CH');
  protected readonly iban = linkedSignal(() => this.store.profile()?.iban ?? '');
  protected readonly twintPhone = linkedSignal(() => this.store.profile()?.twintPhone ?? '');
  protected readonly phone = linkedSignal(() => this.store.profile()?.phone ?? '');
  protected readonly vatNumber = linkedSignal(() => this.store.profile()?.vatNumber ?? '');
  protected readonly vatRate = linkedSignal(() => percentFromRate(this.store.profile()?.defaultVatRate));
  protected readonly paymentTermsDays = linkedSignal(() =>
    String(this.store.profile()?.paymentTermsDays ?? 30)
  );
  protected readonly reminderTermsDays = linkedSignal(() =>
    String(this.store.profile()?.reminderTermsDays ?? 10)
  );
  protected readonly submitted = linkedSignal(() => {
    this.store.profile();
    return false;
  });

  protected readonly errors = computed(() => ({
    companyName:
      this.companyName().trim() === '' ? this.t().settings.companyNameRequired : null,
    iban: (() => {
      const value = normalizeIban(this.iban());
      if (value === '') return null;
      return isValidQrBillIban(value) ? null : this.t().settings.invalidIban;
    })(),
    phone: (() => {
      const value = normalizePhone(this.phone());
      if (value === '') return null;
      return isValidPhone(value) ? null : this.t().settings.invalidPhone;
    })(),
    twintPhone: (() => {
      const value = normalizePhone(this.twintPhone());
      if (value === '') return null;
      return isValidTwintPhone(value) ? null : this.t().settings.invalidTwint;
    })(),
    vatRate: isPercent(this.vatRate()) ? null : this.t().common.invalidPercent,
    paymentTermsDays: validTerms(this.paymentTermsDays()) ? null : this.t().settings.invalidTerms,
    reminderTermsDays: validTerms(this.reminderTermsDays()) ? null : this.t().settings.invalidTerms,
  }));

  protected readonly isValid = computed(() =>
    Object.values(this.errors()).every((e) => e === null)
  );

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    this.submitted.set(true);
    if (!this.isValid()) return;
    const iban = normalizeIban(this.iban());
    const twintPhone = normalizePhone(this.twintPhone());
    const phone = normalizePhone(this.phone());
    const addressLine2 = this.addressLine2().trim();
    const vatNumber = this.vatNumber().trim();
    await this.store.save({
      companyName: this.companyName().trim(),
      addressLine1: this.addressLine1().trim(),
      addressLine2: addressLine2 !== '' ? addressLine2 : null,
      postalCode: this.postalCode().trim(),
      city: this.city().trim(),
      country: this.country().trim().toUpperCase() || 'CH',
      iban: iban !== '' ? iban : null,
      twintPhone: twintPhone !== '' ? twintPhone : null,
      phone: phone !== '' ? phone : null,
      vatNumber: vatNumber !== '' ? vatNumber : null,
      defaultVatRate: rateFromPercent(this.vatRate()),
      paymentTermsDays: parseInt(this.paymentTermsDays(), 10),
      reminderTermsDays: parseInt(this.reminderTermsDays(), 10),
    });
  }
}
