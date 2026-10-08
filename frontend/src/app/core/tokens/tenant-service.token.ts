import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';
import type { CompanyProfile, CompanyProfileData } from '../../features/settings/company.model';

export interface ITenantService {
  getProfile(): Observable<CompanyProfile>;
  updateProfile(data: CompanyProfileData): Observable<CompanyProfile>;
}

export const TENANT_SERVICE = new InjectionToken<ITenantService>('TenantService');
