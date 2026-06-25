import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { IDashboardService } from '../../core/tokens/dashboard-service.token';
import { DashboardStats } from '../../core/models/page.model';

interface InvoiceKpiDto { count: number; total: number; }

interface RecentInvoiceDto {
  id: string;
  invoice_number: string | null;
  customer_name: string;
  status: string;
  issue_date: string | null;
  total: number;
}

interface DashboardStatsDto {
  draft: InvoiceKpiDto;
  issued: InvoiceKpiDto;
  paid: InvoiceKpiDto;
  customer_count: number;
  article_count: number;
  recent_invoices: RecentInvoiceDto[];
}

@Injectable()
export class HttpDashboardService implements IDashboardService {
  private readonly http = inject(HttpClient);

  getStats(): Promise<DashboardStats> {
    return firstValueFrom(this.http.get<DashboardStatsDto>('/api/dashboard/stats')).then((dto) => ({
      draft: dto.draft,
      issued: dto.issued,
      paid: dto.paid,
      customerCount: dto.customer_count,
      articleCount: dto.article_count,
      recentInvoices: dto.recent_invoices.map((r) => ({
        id: r.id,
        invoiceNumber: r.invoice_number,
        customerName: r.customer_name,
        status: r.status,
        issueDate: r.issue_date,
        total: r.total,
      })),
    }));
  }
}
