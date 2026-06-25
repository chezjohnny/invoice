import { InjectionToken } from '@angular/core';
import type { DashboardStats } from '../models/page.model';

export interface IDashboardService {
  getStats(): Promise<DashboardStats>;
}

export const DASHBOARD_SERVICE = new InjectionToken<IDashboardService>('DashboardService');
