import { inject } from '@angular/core';
import { tapResponse } from '@ngrx/operators';
import { patchState, signalStore, withHooks, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { exhaustMap } from 'rxjs';
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
    const load = loadPage(store, () => service.list({
      search: store.search(),
      archived: store.archived(),
      sort: store.sort(),
      page: store.page(),
      perPage: store.perPage(),
    }));
    return {
      load,
      ...pagedListMethods(store, load),
      setArchived(archived: boolean): void {
        patchState(store, { archived, page: 1 });
        load();
      },
      archive: mutateThenLoad(store, (id: string) => service.archive(id), load),
      restore: mutateThenLoad(store, (id: string) => service.restore(id), load),
      exportCsv: rxMethod<void>(
        exhaustMap(() => service.exportCsv().pipe(
          tapResponse({ next: (csv) => saveFile(csv, 'customers.csv'), error: () => undefined }),
        )),
      ),
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
