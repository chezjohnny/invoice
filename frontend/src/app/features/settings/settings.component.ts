import { Component, computed, inject, linkedSignal } from '@angular/core';
import { I18nService } from '../../core/i18n/i18n.service';
import { CompanyStore } from './company.store';
import { isValidQrBillIban, normalizeIban } from './iban';

@Component({
  selector: 'app-settings',
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
                <label class="fieldset-label">{{ t().settings.companyNameLabel }}</label>
                <input class="input w-full" [class.input-error]="submitted() && errors().companyName"
                  type="text" [value]="companyName()" (input)="companyName.set(asStr($event))" />
                @if (submitted() && errors().companyName) {
                  <p class="fieldset-label text-error mt-1">{{ errors().companyName }}</p>
                }
              </div>
              <div>
                <label class="fieldset-label">{{ t().settings.vatNumberLabel }}</label>
                <input class="input w-full" type="text"
                  [value]="vatNumber()" (input)="vatNumber.set(asStr($event))" />
              </div>
            </div>
          </section>

          <!-- ── Address ── -->
          <section class="card bg-base-100 shadow">
            <div class="card-body gap-4">
              <h2 class="card-title text-base">{{ t().settings.address }}</h2>
              <div>
                <label class="fieldset-label">{{ t().settings.addressLabel }}</label>
                <input class="input w-full" type="text"
                  [value]="addressLine1()" (input)="addressLine1.set(asStr($event))" />
              </div>
              <div>
                <label class="fieldset-label">{{ t().settings.address2Label }}</label>
                <input class="input w-full" type="text"
                  [value]="addressLine2()" (input)="addressLine2.set(asStr($event))" />
              </div>
              <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label class="fieldset-label">{{ t().settings.postalLabel }}</label>
                  <input class="input w-full" type="text"
                    [value]="postalCode()" (input)="postalCode.set(asStr($event))" />
                </div>
                <div class="sm:col-span-2">
                  <label class="fieldset-label">{{ t().settings.cityLabel }}</label>
                  <input class="input w-full" type="text"
                    [value]="city()" (input)="city.set(asStr($event))" />
                </div>
                <div>
                  <label class="fieldset-label">{{ t().settings.countryLabel }}</label>
                  <input class="input w-full" type="text" maxlength="2"
                    [value]="country()" (input)="country.set(asStr($event))" />
                </div>
              </div>
            </div>
          </section>

          <!-- ── Billing ── -->
          <section class="card bg-base-100 shadow">
            <div class="card-body gap-4">
              <h2 class="card-title text-base">{{ t().settings.billing }}</h2>
              <div>
                <label class="fieldset-label">{{ t().settings.ibanLabel }}</label>
                <input class="input w-full font-mono" [class.input-error]="submitted() && errors().iban"
                  type="text" [value]="iban()" (input)="iban.set(asStr($event))" />
                @if (submitted() && errors().iban) {
                  <p class="fieldset-label text-error mt-1">{{ errors().iban }}</p>
                } @else {
                  <p class="fieldset-label mt-1">{{ t().settings.ibanHint }}</p>
                }
              </div>
              <div class="sm:w-48">
                <label class="fieldset-label">{{ t().settings.vatRateLabel }}</label>
                <input class="input w-full" [class.input-error]="submitted() && errors().vatRate"
                  type="number" min="0" max="100" step="0.1"
                  [value]="vatRate()" (input)="vatRate.set(asStr($event))" />
                @if (submitted() && errors().vatRate) {
                  <p class="fieldset-label text-error mt-1">{{ errors().vatRate }}</p>
                }
              </div>
            </div>
          </section>

          <!-- ── Numbering ── -->
          <section class="card bg-base-100 shadow">
            <div class="card-body gap-4">
              <h2 class="card-title text-base">{{ t().settings.numbering }}</h2>
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label class="fieldset-label">{{ t().settings.prefixLabel }}</label>
                  <input class="input w-full" [class.input-error]="submitted() && errors().invoicePrefix"
                    type="text" maxlength="10"
                    [value]="invoicePrefix()" (input)="invoicePrefix.set(asStr($event))" />
                  @if (submitted() && errors().invoicePrefix) {
                    <p class="fieldset-label text-error mt-1">{{ errors().invoicePrefix }}</p>
                  }
                </div>
                <div>
                  <label class="fieldset-label">{{ t().settings.termsLabel }}</label>
                  <input class="input w-full" [class.input-error]="submitted() && errors().paymentTermsDays"
                    type="number" min="0" max="365" step="1"
                    [value]="paymentTermsDays()" (input)="paymentTermsDays.set(asStr($event))" />
                  @if (submitted() && errors().paymentTermsDays) {
                    <p class="fieldset-label text-error mt-1">{{ errors().paymentTermsDays }}</p>
                  }
                </div>
                <div>
                  <label class="fieldset-label">{{ t().settings.nextNumberLabel }}</label>
                  <input class="input w-full" type="text" disabled
                    [value]="store.profile()?.invoiceNextNumber ?? ''" />
                  <p class="fieldset-label mt-1 font-mono">{{ nextNumberHint() }}</p>
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

  constructor() {
    // Never edit a stale profile: the shell loads it once at sign-in, while
    // invoice_next_number moves server-side on every issue — and this is also
    // what recovers the page when that initial load failed.
    this.store.load();
  }

  protected readonly companyName = linkedSignal(() => this.store.profile()?.companyName ?? '');
  protected readonly addressLine1 = linkedSignal(() => this.store.profile()?.addressLine1 ?? '');
  protected readonly addressLine2 = linkedSignal(() => this.store.profile()?.addressLine2 ?? '');
  protected readonly postalCode = linkedSignal(() => this.store.profile()?.postalCode ?? '');
  protected readonly city = linkedSignal(() => this.store.profile()?.city ?? '');
  protected readonly country = linkedSignal(() => this.store.profile()?.country ?? 'CH');
  protected readonly iban = linkedSignal(() => this.store.profile()?.iban ?? '');
  protected readonly vatNumber = linkedSignal(() => this.store.profile()?.vatNumber ?? '');
  protected readonly vatRate = linkedSignal(() => {
    const rate = this.store.profile()?.defaultVatRate;
    // The rate is a 4-decimal fraction; *100 alone shows 0.037 as 3.6999999999999997.
    return rate != null ? String(Math.round(rate * 1e6) / 1e4) : '';
  });
  protected readonly invoicePrefix = linkedSignal(
    () => this.store.profile()?.invoicePrefix ?? 'INV'
  );
  protected readonly paymentTermsDays = linkedSignal(() =>
    String(this.store.profile()?.paymentTermsDays ?? 30)
  );
  protected readonly submitted = linkedSignal(() => {
    this.store.profile();
    return false;
  });

  protected readonly errors = computed(() => ({
    companyName:
      this.companyName().trim() === '' ? this.t().settings.companyNameRequired : null,
    invoicePrefix:
      this.invoicePrefix().trim() === '' ? this.t().settings.prefixRequired : null,
    iban: (() => {
      const value = normalizeIban(this.iban());
      if (value === '') return null;
      return isValidQrBillIban(value) ? null : this.t().settings.invalidIban;
    })(),
    vatRate: (() => {
      const value = this.vatRate().trim();
      if (value === '') return null;
      const rate = parseFloat(value);
      return Number.isFinite(rate) && rate >= 0 && rate <= 100
        ? null
        : this.t().settings.invalidVatRate;
    })(),
    paymentTermsDays: (() => {
      const days = parseInt(this.paymentTermsDays(), 10);
      return Number.isInteger(days) && days >= 0 && days <= 365
        ? null
        : this.t().settings.invalidTerms;
    })(),
  }));

  protected readonly isValid = computed(() =>
    Object.values(this.errors()).every((e) => e === null)
  );

  protected readonly nextNumberHint = computed(() => {
    const profile = this.store.profile();
    if (!profile) return '';
    const prefix = this.invoicePrefix().trim() || profile.invoicePrefix;
    const number = String(profile.invoiceNextNumber).padStart(4, '0');
    const year = new Date().getFullYear();
    return this.t().settings.nextNumberHint.replace('{n}', `${prefix}-${year}-${number}`);
  });

  protected asStr(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  protected async submit(event: Event): Promise<void> {
    event.preventDefault();
    this.submitted.set(true);
    if (!this.isValid()) return;
    const iban = normalizeIban(this.iban());
    const vatRate = this.vatRate().trim();
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
      vatNumber: vatNumber !== '' ? vatNumber : null,
      defaultVatRate: vatRate !== '' ? parseFloat(vatRate) / 100 : null,
      invoicePrefix: this.invoicePrefix().trim(),
      paymentTermsDays: parseInt(this.paymentTermsDays(), 10),
    });
  }
}
