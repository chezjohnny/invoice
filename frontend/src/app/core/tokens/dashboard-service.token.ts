import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';
import type { DashboardStats } from '../../features/dashboard/dashboard.model';

export interface IDashboardService {
  getStats(): Observable<DashboardStats>;
}

export const DASHBOARD_SERVICE = new InjectionToken<IDashboardService>('DashboardService');
