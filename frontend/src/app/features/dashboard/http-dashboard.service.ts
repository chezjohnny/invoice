import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { IDashboardService } from '../../core/tokens/dashboard-service.token';
import { DashboardStats } from './dashboard.model';
import { InvoiceStatus } from '../invoices/invoice.model';

interface InvoiceKpiDto { count: number; total: number; }

interface RecentInvoiceDto {
  id: string;
  invoice_number: string | null;
  customer_id: string;
  customer_name: string;
  status: InvoiceStatus;
  issue_date: string | null;
  total: number;
}

interface OverdueInvoiceDto {
  id: string;
  invoice_number: string | null;
  customer_id: string;
  customer_name: string;
  due_date: string;
  total: number;
  reminder_count: number;
  last_reminder_on: string | null;
}

interface DashboardStatsDto {
  draft: InvoiceKpiDto;
  issued: InvoiceKpiDto;
  overdue: InvoiceKpiDto;
  paid: InvoiceKpiDto;
  invoice_count: number;
  customer_count: number;
  article_count: number;
  recent_invoices: RecentInvoiceDto[];
  overdue_invoices: OverdueInvoiceDto[];
}

@Injectable()
export class HttpDashboardService implements IDashboardService {
  private readonly http = inject(HttpClient);

  getStats(): Promise<DashboardStats> {
    return firstValueFrom(this.http.get<DashboardStatsDto>('/api/dashboard/stats')).then((dto) => ({
      draft: dto.draft,
      issued: dto.issued,
      overdue: dto.overdue,
      paid: dto.paid,
      invoiceCount: dto.invoice_count,
      customerCount: dto.customer_count,
      articleCount: dto.article_count,
      recentInvoices: dto.recent_invoices.map((r) => ({
        id: r.id,
        invoiceNumber: r.invoice_number,
        customerId: r.customer_id,
        customerName: r.customer_name,
        status: r.status,
        issueDate: r.issue_date,
        total: r.total,
      })),
      overdueInvoices: dto.overdue_invoices.map((o) => ({
        id: o.id,
        invoiceNumber: o.invoice_number,
        customerId: o.customer_id,
        customerName: o.customer_name,
        dueDate: o.due_date,
        total: o.total,
        reminderCount: o.reminder_count,
        lastReminderOn: o.last_reminder_on,
      })),
    }));
  }
}
