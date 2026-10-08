import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { ITenantService } from '../../core/tokens/tenant-service.token';
import { CompanyProfile, CompanyProfileData } from './company.model';
import { normalizeIban } from './iban';
import { normalizePhone } from './phone';

const INITIAL: CompanyProfile = {
  companyName: 'Cave du Lac Sàrl',
  addressLine1: 'Route du Vignoble 12',
  addressLine2: null,
  postalCode: '1400',
  city: 'Yverdon-les-Bains',
  country: 'CH',
  iban: 'CH5604835012345678009',
  twintPhone: '+41791234567',
  phone: '+41241234567',
  vatNumber: 'CHE-123.456.789 TVA',
  defaultVatRate: 0.081,
  paymentTermsDays: 30,
  reminderTermsDays: 10,
  isComplete: true,
};

@Injectable()
export class MockTenantService implements ITenantService {
  private profile = structuredClone(INITIAL);

  getProfile(): Observable<CompanyProfile> {
    return of(this.profile);
  }

  updateProfile(data: CompanyProfileData): Observable<CompanyProfile> {
    const iban = normalizeIban(data.iban ?? '') || null;
    this.profile = {
      ...this.profile,
      ...data,
      iban,
      twintPhone: normalizePhone(data.twintPhone ?? '') || null,
      phone: normalizePhone(data.phone ?? '') || null,
      isComplete: Boolean(
        data.companyName && data.addressLine1 && data.postalCode && data.city && iban
      ),
    };
    return of(this.profile);
  }
}
