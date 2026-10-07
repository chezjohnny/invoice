import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TENANT_SERVICE } from '../../core/tokens/tenant-service.token';
import { CompanyProfile, CompanyProfileData } from './company.model';
import { SettingsComponent } from './settings.component';

const PROFILE: CompanyProfile = {
  companyName: 'Cave du Lac Sàrl',
  addressLine1: 'Route du Vignoble 12',
  addressLine2: null,
  postalCode: '1400',
  city: 'Yverdon-les-Bains',
  country: 'CH',
  iban: 'CH5604835012345678009',
  twintPhone: null,
  phone: null,
  vatNumber: null,
  defaultVatRate: 0.081,
  paymentTermsDays: 30,
  reminderTermsDays: 10,
  isComplete: true,
};

describe('SettingsComponent', () => {
  let fixture: ComponentFixture<SettingsComponent>;
  let updates: CompanyProfileData[];
  const element = () => fixture.nativeElement as HTMLElement;
  const byId = (id: string) => element().querySelector(`#${id}`) as HTMLInputElement;

  beforeEach(async () => {
    updates = [];
    TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: TENANT_SERVICE,
          useValue: {
            getProfile: async () => PROFILE,
            updateProfile: async (data: CompanyProfileData) => {
              updates.push(data);
              return { ...PROFILE, ...data };
            },
          },
        },
      ],
    });
    fixture = TestBed.createComponent(SettingsComponent);
    await fixture.whenStable();
  });

  async function type(id: string, value: string): Promise<void> {
    byId(id).value = value;
    byId(id).dispatchEvent(new Event('input'));
    await fixture.whenStable();
  }

  async function save(): Promise<void> {
    element().querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  it('shows the profile, the VAT rate as a percent', () => {
    expect(byId('settings-company-name').value).toBe('Cave du Lac Sàrl');
    expect(byId('settings-vat-rate').value).toBe('8.1');
    expect(byId('settings-terms').value).toBe('30');
  });

  it('refuses an invalid IBAN, a missing name and out-of-range terms', async () => {
    await type('settings-company-name', '  ');
    await type('settings-iban', 'CH00 1234');
    await type('settings-terms', '400');
    await save();
    expect(updates).toEqual([]);
    expect(element().querySelectorAll('.text-error').length).toBe(3);
  });

  it('saves the normalized profile', async () => {
    await type('settings-iban', 'ch56 0483 5012 3456 7800 9');
    await type('settings-twint', '079 123 45 67');
    await type('settings-country', ' ch ');
    await type('settings-vat-rate', '');
    await type('settings-reminder-terms', '15');
    await save();
    expect(updates).toEqual([{
      companyName: 'Cave du Lac Sàrl', addressLine1: 'Route du Vignoble 12', addressLine2: null,
      postalCode: '1400', city: 'Yverdon-les-Bains', country: 'CH', iban: 'CH5604835012345678009',
      twintPhone: '+41791234567', phone: null, vatNumber: null, defaultVatRate: null,
      paymentTermsDays: 30, reminderTermsDays: 15,
    }]);
  });
});
