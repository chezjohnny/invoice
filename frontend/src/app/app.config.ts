import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { environment } from '../environments/environment';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { ARTICLE_SERVICE } from './core/tokens/article-service.token';
import { CUSTOMER_SERVICE } from './core/tokens/customer-service.token';
import { DASHBOARD_SERVICE } from './core/tokens/dashboard-service.token';
import { INVOICE_SERVICE } from './core/tokens/invoice-service.token';
import { HttpArticleService } from './features/articles/http-article.service';
import { MockArticleService } from './features/articles/mock-article.service';
import { HttpCustomerService } from './features/customers/http-customer.service';
import { MockCustomerService } from './features/customers/mock-customer.service';
import { HttpDashboardService } from './features/dashboard/http-dashboard.service';
import { MockDashboardService } from './features/dashboard/mock-dashboard.service';
import { HttpInvoiceService } from './features/invoices/http-invoice.service';
import { MockInvoiceService } from './features/invoices/mock-invoice.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideHttpClient(withFetch(), withInterceptors([errorInterceptor, authInterceptor])),
    provideRouter(routes),
    { provide: ARTICLE_SERVICE, useClass: environment.useMock ? MockArticleService : HttpArticleService },
    { provide: CUSTOMER_SERVICE, useClass: environment.useMock ? MockCustomerService : HttpCustomerService },
    { provide: INVOICE_SERVICE, useClass: environment.useMock ? MockInvoiceService : HttpInvoiceService },
    { provide: DASHBOARD_SERVICE, useClass: environment.useMock ? MockDashboardService : HttpDashboardService },
  ],
};
