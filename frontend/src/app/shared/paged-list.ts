import { Signal } from '@angular/core';
import { tapResponse } from '@ngrx/operators';
import { WritableStateSource, patchState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { Observable, concatMap, switchMap } from 'rxjs';
import { Page } from '../core/models/page.model';
import { Sort, nextSort } from './sort';

/** The state every server-paged list shares, extended by each store's own filters. */
export interface PagedListState<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  pages: number;
  search: string;
  /** null = the API's default order. */
  sort: Sort | null;
  loading: boolean;
}

export function initialPagedList<T>(): PagedListState<T> {
  return { items: [], total: 0, page: 1, perPage: 20, pages: 1, search: '', sort: null, loading: false };
}

type ListSource<T> = WritableStateSource<PagedListState<T>> & { sort: Signal<Sort | null> };

/** Fetch a page into the store; a failed call never leaves the list dimmed. */
export async function loadPage<T>(store: ListSource<T>, fetch: () => Promise<Page<T>>): Promise<void> {
  patchState(store, { loading: true });
  try {
    patchState(store, await fetch());
  } finally {
    patchState(store, { loading: false });
  }
}

/**
 * Run a change, then reload the list. A change can legitimately fail (a 409
 * when it was already made in another tab): the list then stays usable.
 */
export async function mutateThenLoad<T, R>(
  store: ListSource<T>, action: () => Promise<R>, load: () => Promise<void>,
): Promise<R> {
  patchState(store, { loading: true });
  let result: R;
  try {
    result = await action();
  } catch (error) {
    patchState(store, { loading: false });
    throw error;
  }
  await load();
  return result;
}

/** Search, sort and paging of a list, each reloading it through the store's load(). */
export function pagedListMethods<T>(store: ListSource<T>, load: () => Promise<void>) {
  return {
    setSearch(search: string): Promise<void> {
      patchState(store, { search, page: 1 });
      return load();
    },
    toggleSort(key: string): Promise<void> {
      patchState(store, { sort: nextSort(store.sort(), key), page: 1 });
      return load();
    },
    setPage(page: number): Promise<void> {
      patchState(store, { page });
      return load();
    },
  };
}

// Observable versions of the above, for the stores moved to rxMethod (articles,
// customers so far); the Promise ones go once every store has moved.

/**
 * Loads a page each time it is called. A request still running is cancelled
 * (switchMap): a slow answer never overwrites a newer one.
 */
export function rxLoadPage<T>(store: ListSource<T>, fetch: () => Observable<Page<T>>) {
  return rxMethod<void>(
    switchMap(() => {
      // Inside switchMap, not before it: the cancelled request's finalize runs first.
      patchState(store, { loading: true });
      return fetch().pipe(
        tapResponse({
          next: (page) => patchState(store, page),
          error: () => undefined, // errorInterceptor already surfaced a toast
          finalize: () => patchState(store, { loading: false }),
        }),
      );
    }),
  );
}

/**
 * Runs each change in turn (concatMap), then reloads the list. A change can
 * legitimately fail (a 409 when it was already made in another tab): the list
 * then stays usable.
 */
export function rxMutateThenLoad<T, A>(
  store: ListSource<T>, action: (arg: A) => Observable<unknown>, load: () => void,
) {
  return rxMethod<A>(
    concatMap((arg) => {
      patchState(store, { loading: true });
      return action(arg).pipe(
        tapResponse({
          next: () => load(),
          error: () => patchState(store, { loading: false }),
        }),
      );
    }),
  );
}

/** Search, sort and paging of a list, each reloading it through the store's load(). */
export function rxPagedListMethods<T>(store: ListSource<T>, load: () => void) {
  return {
    setSearch(search: string): void {
      patchState(store, { search, page: 1 });
      load();
    },
    toggleSort(key: string): void {
      patchState(store, { sort: nextSort(store.sort(), key), page: 1 });
      load();
    },
    setPage(page: number): void {
      patchState(store, { page });
      load();
    },
  };
}
