import { Injectable } from '@angular/core';
import { IDashboardService } from '../../core/tokens/dashboard-service.token';
import { DashboardStats } from '../../core/models/page.model';

@Injectable()
export class MockDashboardService implements IDashboardService {
  getStats(): Promise<DashboardStats> {
    return Promise.resolve({
      draft: { count: 1, total: 150 },
      issued: { count: 2, total: 320 },
      paid: { count: 3, total: 890 },
      customerCount: 4,
      articleCount: 4,
      recentInvoices: [],
    });
  }
}
