export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  pages: number;
}

export interface InvoiceKpi {
  count: number;
  total: number;
}

export interface RecentInvoiceItem {
  id: string;
  invoiceNumber: string | null;
  customerName: string;
  status: string;
  issueDate: string | null;
  total: number;
}

export interface DashboardStats {
  draft: InvoiceKpi;
  issued: InvoiceKpi;
  paid: InvoiceKpi;
  customerCount: number;
  articleCount: number;
  recentInvoices: RecentInvoiceItem[];
}
