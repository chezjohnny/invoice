import { InjectionToken } from '@angular/core';
import type { DashboardStats } from '../../features/dashboard/dashboard.model';

export interface IDashboardService {
  getStats(): Promise<DashboardStats>;
}

export const DASHBOARD_SERVICE = new InjectionToken<IDashboardService>('DashboardService');
