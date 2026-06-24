import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from '@ngrx/signals';
import { setAllEntities, setEntity, updateEntity, withEntities } from '@ngrx/signals/entities';
import { ARTICLE_SERVICE } from '../../core/tokens/article-service.token';
import { Article } from './article.model';

export const ArticleStore = signalStore(
  withEntities<Article>(),
  withState({ filter: '' }),
  withComputed(({ entities, filter }) => ({
    filteredArticles: computed(() =>
      entities().filter(
        (a) => !a.isArchived && a.name.toLowerCase().includes(filter().toLowerCase())
      )
    ),
  })),
  withMethods((store, service = inject(ARTICLE_SERVICE)) => ({
    async load(): Promise<void> {
      const articles = await service.getAll();
      patchState(store, setAllEntities(articles));
    },
    async createArticle(data: Omit<Article, 'id' | 'isArchived'>): Promise<void> {
      const article = await service.create(data);
      patchState(store, setEntity(article));
    },
    async updateArticle(id: string, data: Omit<Article, 'id' | 'isArchived'>): Promise<void> {
      const article = await service.update(id, data);
      patchState(store, setEntity(article));
    },
    async archive(id: string): Promise<void> {
      await service.archive(id);
      patchState(store, updateEntity({ id, changes: { isArchived: true } }));
    },
    setFilter(value: string): void {
      patchState(store, { filter: value });
    },
  })),
  withHooks({
    onInit(store) {
      store.load();
    },
  })
);
