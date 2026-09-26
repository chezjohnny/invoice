import { InjectionToken } from '@angular/core';
import type { CompanyProfile, CompanyProfileData } from '../../features/settings/company.model';

export interface ITenantService {
  getProfile(): Promise<CompanyProfile>;
  updateProfile(data: CompanyProfileData): Promise<CompanyProfile>;
}

export const TENANT_SERVICE = new InjectionToken<ITenantService>('TenantService');
