import { registerLocaleData } from '@angular/common';
import localeDeCh from '@angular/common/locales/de-CH';
import {
  ApplicationConfig,
  LOCALE_ID,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideFormErrorClasses } from './shared/form-errors';
import { environment } from '../environments/environment';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { ARTICLE_SERVICE } from './core/tokens/article-service.token';
import { STOCK_WITHDRAWAL_SERVICE } from './core/tokens/stock-withdrawal-service.token';
import { CUSTOMER_SERVICE } from './core/tokens/customer-service.token';
import { DASHBOARD_SERVICE } from './core/tokens/dashboard-service.token';
import { INVOICE_SERVICE } from './core/tokens/invoice-service.token';
import { TENANT_SERVICE } from './core/tokens/tenant-service.token';
import { HttpArticleService } from './features/articles/http-article.service';
import { MockArticleService } from './features/articles/mock-article.service';
import { HttpStockWithdrawalService } from './features/stock-withdrawals/http-stock-withdrawal.service';
import { MockStockWithdrawalService } from './features/stock-withdrawals/mock-stock-withdrawal.service';
import { HttpCustomerService } from './features/customers/http-customer.service';
import { MockCustomerService } from './features/customers/mock-customer.service';
import { HttpDashboardService } from './features/dashboard/http-dashboard.service';
import { MockDashboardService } from './features/dashboard/mock-dashboard.service';
import { HttpInvoiceService } from './features/invoices/http-invoice.service';
import { MockInvoiceService } from './features/invoices/mock-invoice.service';
import { HttpTenantService } from './features/settings/http-tenant.service';
import { MockTenantService } from './features/settings/mock-tenant.service';

// Amounts as written in Switzerland, in every language: CHF 1’250.50. Dates
// follow the UI language on their own (shared/dates.ts).
registerLocaleData(localeDeCh);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideHttpClient(withFetch(), withInterceptors([errorInterceptor, authInterceptor])),
    provideRouter(routes),
    provideFormErrorClasses(),
    { provide: LOCALE_ID, useValue: 'de-CH' },
    { provide: ARTICLE_SERVICE, useClass: environment.useMock ? MockArticleService : HttpArticleService },
    { provide: CUSTOMER_SERVICE, useClass: environment.useMock ? MockCustomerService : HttpCustomerService },
    { provide: INVOICE_SERVICE, useClass: environment.useMock ? MockInvoiceService : HttpInvoiceService },
    {
      provide: STOCK_WITHDRAWAL_SERVICE,
      useClass: environment.useMock ? MockStockWithdrawalService : HttpStockWithdrawalService,
    },
    { provide: DASHBOARD_SERVICE, useClass: environment.useMock ? MockDashboardService : HttpDashboardService },
    { provide: TENANT_SERVICE, useClass: environment.useMock ? MockTenantService : HttpTenantService },
  ],
};
