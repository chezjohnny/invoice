import { inject } from '@angular/core';
import { patchState, signalStore, withHooks, withMethods, withState } from '@ngrx/signals';
import { ARTICLE_SERVICE } from '../../core/tokens/article-service.token';
import { saveFile } from '../../shared/download';
import {
  PagedListState, initialPagedList, loadPage, mutateThenLoad, pagedListMethods,
} from '../../shared/paged-list';
import { pagedListParams, queryParams, readPagedList, syncWithUrl } from '../../shared/url-state';
import { ArticleListItem } from './article.model';

interface ArticleState extends PagedListState<ArticleListItem> {
  archived: boolean;
  /** null = all time. */
  salesYear: number | null;
  /** 1–4 within `salesYear`; null = the whole year. */
  salesQuarter: number | null;
  salesYears: number[];
  /** The stock column turns into inputs for counting the stock. */
  inventoryMode: boolean;
}

export const ArticleStore = signalStore(
  withState<ArticleState>({
    ...initialPagedList<ArticleListItem>(),
    archived: false,
    salesYear: null,
    salesQuarter: null,
    salesYears: [],
    inventoryMode: false,
  }),
  withMethods((store, service = inject(ARTICLE_SERVICE)) => {
    const load = (): Promise<void> => loadPage(store, () => service.list({
      search: store.search(),
      archived: store.archived(),
      salesYear: store.salesYear(),
      salesQuarter: store.salesQuarter(),
      sort: store.sort(),
      page: store.page(),
      perPage: store.perPage(),
    }));

    return {
      load,
      ...pagedListMethods(store, load),
      async loadSalesYears(): Promise<void> {
        patchState(store, { salesYears: await service.salesYears() });
      },
      setArchived(archived: boolean): Promise<void> {
        // Archived articles are not counted: leave the inventory with the active list.
        patchState(store, { archived, page: 1, ...(archived && { inventoryMode: false }) });
        return load();
      },
      setSalesYear(salesYear: number | null): Promise<void> {
        // A quarter only makes sense within a year.
        patchState(store, { salesYear, ...(salesYear === null && { salesQuarter: null }) });
        return load();
      },
      setSalesQuarter(salesQuarter: number | null): Promise<void> {
        patchState(store, { salesQuarter });
        return load();
      },
      setInventoryMode(inventoryMode: boolean): void {
        patchState(store, { inventoryMode });
      },
      /**
       * Sets the counted stock and patches the row in place, without reloading:
       * the list stays usable while counting article after article.
       */
      async countStock(article: ArticleListItem, countedQuantity: number): Promise<void> {
        const { name, description, unitPrice, vatRateOverride } = article;
        const saved = await service.update(article.id, {
          name, description, unitPrice, vatRateOverride, stockQuantity: countedQuantity,
        });
        patchState(store, {
          items: store.items().map((a) => (a.id === article.id ? { ...a, stockQuantity: saved.stockQuantity } : a)),
        });
      },
      /** What is listed (active or archived) over the sales period, named like the API's file. */
      async exportCsv(): Promise<void> {
        const archived = store.archived();
        const salesYear = store.salesYear();
        const salesQuarter = store.salesQuarter();
        let name = archived ? 'articles-archived' : 'articles';
        if (salesYear !== null) name += `-${salesYear}` + (salesQuarter === null ? '' : `-Q${salesQuarter}`);
        saveFile(await service.exportCsv(archived, { salesYear, salesQuarter }), `${name}.csv`);
      },
      archive(id: string): Promise<void> {
        return mutateThenLoad(store, () => service.archive(id), load);
      },
      restore(id: string): Promise<void> {
        return mutateThenLoad(store, () => service.restore(id), load);
      },
    };
  }),
  withHooks({
    onInit(store) {
      const params = queryParams();
      const year = Number(params.get('year')) || null;
      const quarter = Number(params.get('quarter'));
      patchState(store, {
        ...readPagedList(params),
        archived: params.get('archived') === 'true',
        salesYear: year,
        // A quarter only makes sense within a year.
        salesQuarter: year && quarter >= 1 && quarter <= 4 ? quarter : null,
      });
      syncWithUrl(() => ({
        ...pagedListParams(store),
        archived: store.archived() || null,
        year: store.salesYear(),
        quarter: store.salesQuarter(),
      }));
      store.load();
      store.loadSalesYears();
    },
  })
);
