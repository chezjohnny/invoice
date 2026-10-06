import { inject } from '@angular/core';
import { patchState, signalStore, withHooks, withMethods, withState } from '@ngrx/signals';
import { CUSTOMER_SERVICE } from '../../core/tokens/customer-service.token';
import { saveFile } from '../../shared/download';
import {
  PagedListState, initialPagedList, loadPage, mutateThenLoad, pagedListMethods,
} from '../../shared/paged-list';
import { pagedListParams, queryParams, readPagedList, syncWithUrl } from '../../shared/url-state';
import { Customer } from './customer.model';

interface CustomerState extends PagedListState<Customer> {
  archived: boolean;
}

export const CustomerStore = signalStore(
  withState<CustomerState>({ ...initialPagedList<Customer>(), archived: false }),
  withMethods((store, service = inject(CUSTOMER_SERVICE)) => {
    const load = (): Promise<void> => loadPage(store, () => service.list({
      search: store.search(),
      archived: store.archived(),
      sort: store.sort(),
      page: store.page(),
      perPage: store.perPage(),
    }));
    return {
      load,
      ...pagedListMethods(store, load),
      setArchived(archived: boolean): Promise<void> {
        patchState(store, { archived, page: 1 });
        return load();
      },
      archive(id: string): Promise<void> {
        return mutateThenLoad(store, () => service.archive(id), load);
      },
      restore(id: string): Promise<void> {
        return mutateThenLoad(store, () => service.restore(id), load);
      },
      async exportCsv(): Promise<void> {
        saveFile(await service.exportCsv(), 'customers.csv');
      },
    };
  }),
  withHooks({
    onInit(store) {
      const params = queryParams();
      patchState(store, { ...readPagedList(params), archived: params.get('archived') === 'true' });
      syncWithUrl(() => ({ ...pagedListParams(store), archived: store.archived() || null }));
      store.load();
    },
  })
);
