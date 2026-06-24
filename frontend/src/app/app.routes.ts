import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'articles',
    loadComponent: () =>
      import('./features/articles/articles.component').then((m) => m.ArticlesComponent),
  },
  { path: '', redirectTo: 'articles', pathMatch: 'full' },
];
