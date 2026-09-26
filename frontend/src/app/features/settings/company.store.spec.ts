import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NotificationService } from '../../core/notifications/notification.service';
import { TENANT_SERVICE } from '../../core/tokens/tenant-service.token';
import { CompanyProfile, CompanyProfileData } from './company.model';
import { CompanyStore } from './company.store';

const INCOMPLETE: CompanyProfile = {
  id: 'p1',
  companyName: 'Cave Test',
  addressLine1: '',
  addressLine2: null,
  postalCode: '',
  city: '',
  country: 'CH',
  iban: null,
  vatNumber: null,
  defaultVatRate: null,
  invoicePrefix: 'INV',
  paymentTermsDays: 30,
  invoiceNextNumber: 1,
  isComplete: false,
};

const DATA: CompanyProfileData = {
  companyName: 'Cave du Lac Sàrl',
  addressLine1: 'Route du Vignoble 12',
  addressLine2: null,
  postalCode: '1400',
  city: 'Yverdon-les-Bains',
  country: 'CH',
  iban: 'CH5604835012345678009',
  vatNumber: null,
  defaultVatRate: 0.081,
  invoicePrefix: 'FAC',
  paymentTermsDays: 30,
};

describe('CompanyStore', () => {
  let store: InstanceType<typeof CompanyStore>;
  let profile: CompanyProfile;
  let failNext: boolean;

  beforeEach(() => {
    profile = structuredClone(INCOMPLETE);
    failNext = false;
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: TENANT_SERVICE,
          useValue: {
            getProfile: async () => {
              if (failNext) throw new Error('boom');
              return profile;
            },
            updateProfile: async (data: CompanyProfileData) => {
              if (failNext) throw new Error('boom');
              profile = {
                ...profile,
                ...data,
                isComplete: Boolean(
                  data.companyName && data.addressLine1 && data.postalCode && data.city && data.iban
                ),
              };
              return profile;
            },
          },
        },
      ],
    });
    store = TestBed.inject(CompanyStore);
  });

  it('starts empty and reports no completeness before loading', () => {
    expect(store.profile()).toBeNull();
    expect(store.isIncomplete()).toBe(false);
  });

  it('flags an incomplete profile after load', async () => {
    await store.load();
    expect(store.profile()?.companyName).toBe('Cave Test');
    expect(store.isIncomplete()).toBe(true);
    expect(store.loading()).toBe(false);
  });

  it('clears the incomplete flag once the profile is saved', async () => {
    await store.load();
    await store.save(DATA);
    expect(store.profile()?.iban).toBe('CH5604835012345678009');
    expect(store.isIncomplete()).toBe(false);
    expect(store.saving()).toBe(false);
  });

  it('notifies on a successful save', async () => {
    const notify = TestBed.inject(NotificationService);
    await store.load();
    await store.save(DATA);
    expect(notify.notifications().some((n) => n.kind === 'success')).toBe(true);
  });

  it('resets the loading flags when the backend fails', async () => {
    failNext = true;
    await store.load();
    expect(store.profile()).toBeNull();
    expect(store.loading()).toBe(false);

    await store.save(DATA);
    expect(store.saving()).toBe(false);
  });
});
