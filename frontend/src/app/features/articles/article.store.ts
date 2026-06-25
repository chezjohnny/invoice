import { inject } from '@angular/core';
import { patchState, signalStore, withHooks, withMethods, withState } from '@ngrx/signals';
import { ARTICLE_SERVICE } from '../../core/tokens/article-service.token';
import { Article } from './article.model';

interface ArticleState {
  items: Article[];
  total: number;
  page: number;
  perPage: number;
  pages: number;
  search: string;
  loading: boolean;
}

export const ArticleStore = signalStore(
  withState<ArticleState>({
    items: [],
    total: 0,
    page: 1,
    perPage: 20,
    pages: 1,
    search: '',
    loading: false,
  }),
  withMethods((store, service = inject(ARTICLE_SERVICE)) => {
    async function load(): Promise<void> {
      patchState(store, { loading: true });
      const result = await service.list({
        search: store.search(),
        page: store.page(),
        perPage: store.perPage(),
      });
      patchState(store, { ...result, loading: false });
    }
    return {
      load,
      setSearch(search: string): Promise<void> {
        patchState(store, { search, page: 1 });
        return load();
      },
      setPage(page: number): Promise<void> {
        patchState(store, { page });
        return load();
      },
      async createArticle(data: Omit<Article, 'id' | 'isArchived'>): Promise<void> {
        await service.create(data);
        await load();
      },
      async updateArticle(id: string, data: Omit<Article, 'id' | 'isArchived'>): Promise<void> {
        await service.update(id, data);
        await load();
      },
      async archive(id: string): Promise<void> {
        await service.archive(id);
        await load();
      },
    };
  }),
  withHooks({ onInit(store) { store.load(); } })
);
