import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { IDashboardService } from '../../core/tokens/dashboard-service.token';
import { DashboardStats } from './dashboard.model';

@Injectable()
export class MockDashboardService implements IDashboardService {
  getStats(): Observable<DashboardStats> {
    return of({
      draft: { count: 1, total: 150 },
      issued: { count: 2, total: 320 },
      overdue: { count: 1, total: 120 },
      paid: { count: 3, total: 890 },
      invoiceCount: 6,
      customerCount: 4,
      articleCount: 4,
      recentInvoices: [],
      overdueInvoices: [{
        id: 'inv-2', invoiceNumber: '2608011', customerId: '1',
        customerName: 'Martin, Alice', dueDate: '2026-08-31', total: 120,
        reminderCount: 1, lastReminderOn: '2026-09-15',
      }],
    });
  }
}
