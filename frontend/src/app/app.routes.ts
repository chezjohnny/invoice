import { Routes } from '@angular/router';
import { authGuard } from './core/auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'articles',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/articles/articles.component').then((m) => m.ArticlesComponent),
  },
  {
    path: 'customers',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/customers/customers.component').then((m) => m.CustomersComponent),
  },
  {
    path: 'invoices',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/invoices/invoices.component').then((m) => m.InvoicesComponent),
  },
  { path: '', redirectTo: 'login', pathMatch: 'full' },
];
