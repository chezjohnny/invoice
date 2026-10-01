import { Injectable } from '@angular/core';
import { ITenantService } from '../../core/tokens/tenant-service.token';
import { CompanyProfile, CompanyProfileData } from './company.model';
import { normalizeIban } from './iban';
import { normalizeTwintPhone } from './twint';

const INITIAL: CompanyProfile = {
  id: 'profile-1',
  companyName: 'Cave du Lac Sàrl',
  addressLine1: 'Route du Vignoble 12',
  addressLine2: null,
  postalCode: '1400',
  city: 'Yverdon-les-Bains',
  country: 'CH',
  iban: 'CH5604835012345678009',
  twintPhone: '+41791234567',
  vatNumber: 'CHE-123.456.789 TVA',
  defaultVatRate: 0.081,
  invoicePrefix: 'FAC',
  paymentTermsDays: 30,
  isComplete: true,
};

@Injectable()
export class MockTenantService implements ITenantService {
  private profile = structuredClone(INITIAL);

  getProfile(): Promise<CompanyProfile> {
    return Promise.resolve(this.profile);
  }

  updateProfile(data: CompanyProfileData): Promise<CompanyProfile> {
    const iban = normalizeIban(data.iban ?? '') || null;
    this.profile = {
      ...this.profile,
      ...data,
      iban,
      twintPhone: normalizeTwintPhone(data.twintPhone ?? '') || null,
      isComplete: Boolean(
        data.companyName && data.addressLine1 && data.postalCode && data.city && iban
      ),
    };
    return Promise.resolve(this.profile);
  }
}
