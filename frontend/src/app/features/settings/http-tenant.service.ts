import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ITenantService } from '../../core/tokens/tenant-service.token';
import { CompanyProfile, CompanyProfileData } from './company.model';

interface CompanyProfileDto {
  company_name: string;
  address_line1: string;
  address_line2: string | null;
  postal_code: string;
  city: string;
  country: string;
  iban: string | null;
  twint_phone: string | null;
  phone: string | null;
  vat_number: string | null;
  default_vat_rate: string | null;
  payment_terms_days: number;
  reminder_terms_days: number;
  is_complete: boolean;
}

const PROFILE_URL = '/api/tenant/profile';

@Injectable()
export class HttpTenantService implements ITenantService {
  private readonly http = inject(HttpClient);

  getProfile(): Observable<CompanyProfile> {
    return this.http.get<CompanyProfileDto>(PROFILE_URL).pipe(map((dto) => this.toProfile(dto)));
  }

  updateProfile(data: CompanyProfileData): Observable<CompanyProfile> {
    return this.http.put<CompanyProfileDto>(PROFILE_URL, this.toDto(data)).pipe(map((dto) => this.toProfile(dto)));
  }

  private toProfile(dto: CompanyProfileDto): CompanyProfile {
    return {
      companyName: dto.company_name,
      addressLine1: dto.address_line1,
      addressLine2: dto.address_line2,
      postalCode: dto.postal_code,
      city: dto.city,
      country: dto.country,
      iban: dto.iban,
      twintPhone: dto.twint_phone,
      phone: dto.phone,
      vatNumber: dto.vat_number,
      defaultVatRate: dto.default_vat_rate != null ? parseFloat(dto.default_vat_rate) : null,
      paymentTermsDays: dto.payment_terms_days,
      reminderTermsDays: dto.reminder_terms_days,
      isComplete: dto.is_complete,
    };
  }

  private toDto(data: CompanyProfileData) {
    return {
      company_name: data.companyName,
      address_line1: data.addressLine1,
      address_line2: data.addressLine2,
      postal_code: data.postalCode,
      city: data.city,
      country: data.country,
      iban: data.iban,
      twint_phone: data.twintPhone,
      phone: data.phone,
      vat_number: data.vatNumber,
      default_vat_rate: data.defaultVatRate,
      payment_terms_days: data.paymentTermsDays,
      reminder_terms_days: data.reminderTermsDays,
    };
  }
}
