import type { InvoiceStatus } from '../invoices/invoice.model';

interface InvoiceKpi {
  count: number;
  total: number;
}

interface RecentInvoiceItem {
  id: string;
  invoiceNumber: string | null;
  customerId: string;
  customerName: string;
  status: InvoiceStatus;
  issueDate: string | null;
  total: number;
}

export interface OverdueInvoiceItem {
  id: string;
  invoiceNumber: string | null;
  customerId: string;
  customerName: string;
  dueDate: string;
  total: number;
  reminderCount: number;
  lastReminderOn: string | null;
}

export interface DashboardStats {
  draft: InvoiceKpi;
  issued: InvoiceKpi;
  overdue: InvoiceKpi;
  paid: InvoiceKpi;
  invoiceCount: number;
  customerCount: number;
  articleCount: number;
  recentInvoices: RecentInvoiceItem[];
  overdueInvoices: OverdueInvoiceItem[];
}
