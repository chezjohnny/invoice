import { inject } from '@angular/core';
import { tapResponse } from '@ngrx/operators';
import { patchState, signalStore, withHooks, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { exhaustMap, mergeMap, switchMap } from 'rxjs';
import { ARTICLE_SERVICE } from '../../core/tokens/article-service.token';
import { saveFile } from '../../shared/download';
import {
  PagedListState, initialPagedList, rxLoadPage, rxMutateThenLoad, rxPagedListMethods,
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
  /** The articles counted during this inventory, ticked next to their input. */
  counted: string[];
}

/** A counted quantity, saved as the article's stock. */
interface StockCount {
  article: ArticleListItem;
  quantity: number;
}

export const ArticleStore = signalStore(
  withState<ArticleState>({
    ...initialPagedList<ArticleListItem>(),
    archived: false,
    salesYear: null,
    salesQuarter: null,
    salesYears: [],
    inventoryMode: false,
    counted: [],
  }),
  withMethods((store, service = inject(ARTICLE_SERVICE)) => {
    const load = rxLoadPage(store, () => service.list({
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
      ...rxPagedListMethods(store, load),
      loadSalesYears: rxMethod<void>(
        switchMap(() => service.salesYears().pipe(
          tapResponse({ next: (salesYears) => patchState(store, { salesYears }), error: () => undefined }),
        )),
      ),
      setArchived(archived: boolean): void {
        // Archived articles are not counted: leave the inventory with the active list.
        patchState(store, { archived, page: 1, ...(archived && { inventoryMode: false }) });
        load();
      },
      setSalesYear(salesYear: number | null): void {
        // A quarter only makes sense within a year.
        patchState(store, { salesYear, ...(salesYear === null && { salesQuarter: null }) });
        load();
      },
      setSalesQuarter(salesQuarter: number | null): void {
        patchState(store, { salesQuarter });
        load();
      },
      setInventoryMode(inventoryMode: boolean): void {
        patchState(store, { inventoryMode });
      },
      /**
       * Sets the counted stock and patches the row in place, without reloading:
       * the list stays usable while counting article after article, each saved
       * as soon as it is typed (mergeMap).
       */
      countStock: rxMethod<StockCount>(
        mergeMap(({ article, quantity }) => {
          const { name, description, unitPrice, vatRateOverride } = article;
          return service.update(article.id, {
            name, description, unitPrice, vatRateOverride, stockQuantity: quantity,
          }).pipe(
            tapResponse({
              next: (saved) => patchState(store, {
                items: store.items().map((a) => (a.id === article.id ? { ...a, stockQuantity: saved.stockQuantity } : a)),
                counted: [...store.counted(), article.id],
              }),
              error: () => undefined,
            }),
          );
        }),
      ),
      /** What is listed (active or archived) over the sales period, named like the API's file. */
      exportCsv: rxMethod<void>(
        exhaustMap(() => {
          const archived = store.archived();
          const salesYear = store.salesYear();
          const salesQuarter = store.salesQuarter();
          let name = archived ? 'articles-archived' : 'articles';
          if (salesYear !== null) name += `-${salesYear}` + (salesQuarter === null ? '' : `-Q${salesQuarter}`);
          return service.exportCsv(archived, { salesYear, salesQuarter }).pipe(
            tapResponse({ next: (csv) => saveFile(csv, `${name}.csv`), error: () => undefined }),
          );
        }),
      ),
      archive: rxMutateThenLoad(store, (id: string) => service.archive(id), load),
      restore: rxMutateThenLoad(store, (id: string) => service.restore(id), load),
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
