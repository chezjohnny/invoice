import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
  },
  {
    path: 'articles/new',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/articles/article-editor.component').then((m) => m.ArticleEditorComponent),
  },
  {
    path: 'articles/:id/edit',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/articles/article-editor.component').then((m) => m.ArticleEditorComponent),
  },
  {
    path: 'articles',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/articles/articles.component').then((m) => m.ArticlesComponent),
  },
  {
    path: 'stock-withdrawals/new',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/stock-withdrawals/stock-withdrawal-editor.component').then(
        (m) => m.StockWithdrawalEditorComponent,
      ),
  },
  {
    path: 'stock-withdrawals',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/stock-withdrawals/stock-withdrawals.component').then(
        (m) => m.StockWithdrawalsComponent,
      ),
  },
  {
    path: 'customers',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/customers/customers.component').then((m) => m.CustomersComponent),
  },
  // Before 'customers/:id', which would read 'new' as a customer id.
  {
    path: 'customers/new',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/customers/customer-editor.component').then((m) => m.CustomerEditorComponent),
  },
  {
    path: 'customers/:id/edit',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/customers/customer-editor.component').then((m) => m.CustomerEditorComponent),
  },
  {
    path: 'customers/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/customers/customer-detail.component').then((m) => m.CustomerDetailComponent),
  },
  {
    path: 'invoices/new',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/invoices/invoice-editor.component').then((m) => m.InvoiceEditorComponent),
  },
  {
    path: 'invoices/:id/edit',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/invoices/invoice-editor.component').then((m) => m.InvoiceEditorComponent),
  },
  {
    path: 'invoices',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/invoices/invoices.component').then((m) => m.InvoicesComponent),
  },
  {
    path: 'settings',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/settings/settings.component').then((m) => m.SettingsComponent),
  },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
];
