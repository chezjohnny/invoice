import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
} from '@angular/core';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { environment } from '../environments/environment';
import { ARTICLE_SERVICE } from './core/tokens/article-service.token';
import { HttpArticleService } from './features/articles/http-article.service';
import { MockArticleService } from './features/articles/mock-article.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideHttpClient(withFetch()),
    provideRouter(routes),
    { provide: ARTICLE_SERVICE, useClass: environment.useMock ? MockArticleService : HttpArticleService },
  ],
};
