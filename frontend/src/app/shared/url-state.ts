import { Signal, effect, inject, untracked } from '@angular/core';
import { ActivatedRoute, ParamMap, Params, Router, convertToParamMap } from '@angular/router';
import { PagedListState } from './paged-list';
import { Sort } from './sort';

/**
 * A list's search, filters, sort and page live in the URL: the browser's back
 * button restores the list as it was, and the address is a permalink.
 */

/** The page's query parameters; empty outside the router (unit tests). */
export function queryParams(): ParamMap {
  return inject(ActivatedRoute, { optional: true })?.snapshot.queryParamMap ?? convertToParamMap({});
}

/** The shared part of a list's state read from the URL: ?q=…&page=…&sort=…&order=… */
export function readPagedList(params: ParamMap): Partial<PagedListState<never>> {
  const state: Partial<PagedListState<never>> = {};
  const search = params.get('q');
  if (search) state.search = search;
  const page = Number(params.get('page'));
  if (Number.isInteger(page) && page > 1) state.page = page;
  const key = params.get('sort');
  if (key) state.sort = { key, order: params.get('order') === 'desc' ? 'desc' : 'asc' };
  return state;
}

interface PagedListSignals {
  search: Signal<string>;
  page: Signal<number>;
  sort: Signal<Sort | null>;
}

/** The shared part of a list's state as URL parameters; defaults are left out. */
export function pagedListParams(store: PagedListSignals): Params {
  const sort = store.sort();
  return {
    q: store.search() || null,
    page: store.page() > 1 ? store.page() : null,
    sort: sort?.key ?? null,
    order: sort?.order ?? null,
  };
}

/**
 * Keep the URL in step with the list: `params()` is re-read on every change.
 * The URL is replaced rather than pushed, so typing a search does not fill the
 * history: back leaves the list, as it was. Call it in an injection context.
 */
export function syncWithUrl(params: () => Params): void {
  const router = inject(Router, { optional: true });
  const route = inject(ActivatedRoute, { optional: true });
  if (!router || !route) return;
  effect(() => {
    const queryParams = params();
    untracked(() => router.navigate([], { relativeTo: route, queryParams, replaceUrl: true }));
  });
}
