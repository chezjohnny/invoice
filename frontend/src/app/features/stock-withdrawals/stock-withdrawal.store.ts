import { inject } from '@angular/core';
import { patchState, signalStore, withHooks, withMethods, withState } from '@ngrx/signals';
import { STOCK_WITHDRAWAL_SERVICE } from '../../core/tokens/stock-withdrawal-service.token';
import {
  PagedListState, initialPagedList, loadPage, mutateThenLoad, pagedListMethods,
} from '../../shared/paged-list';
import { pagedListParams, queryParams, readPagedList, syncWithUrl } from '../../shared/url-state';
import { STOCK_WITHDRAWAL_REASONS, StockWithdrawal, StockWithdrawalReason } from './stock-withdrawal.model';

interface StockWithdrawalState extends PagedListState<StockWithdrawal> {
  /** null = every reason. */
  reasonFilter: StockWithdrawalReason | null;
}

export const StockWithdrawalStore = signalStore(
  withState<StockWithdrawalState>({ ...initialPagedList<StockWithdrawal>(), reasonFilter: null }),
  withMethods((store, service = inject(STOCK_WITHDRAWAL_SERVICE)) => {
    const load = loadPage(store, () => service.list({
      search: store.search(),
      reason: store.reasonFilter(),
      sort: store.sort(),
      page: store.page(),
      perPage: store.perPage(),
    }));

    return {
      load,
      ...pagedListMethods(store, load),
      setReasonFilter(reasonFilter: StockWithdrawalReason | null): void {
        patchState(store, { reasonFilter, page: 1 });
        load();
      },
      delete: mutateThenLoad(store, (id: string) => service.delete(id), load),
    };
  }),
  withHooks({
    onInit(store) {
      const params = queryParams();
      const reason = params.get('reason');
      patchState(store, {
        ...readPagedList(params),
        reasonFilter: STOCK_WITHDRAWAL_REASONS.find((r) => r === reason) ?? null,
      });
      syncWithUrl(() => ({ ...pagedListParams(store), reason: store.reasonFilter() }));
      store.load();
    },
  })
);
