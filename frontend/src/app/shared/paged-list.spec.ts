import { TestBed } from '@angular/core/testing';
import { signalState } from '@ngrx/signals';
import { Subject, of, throwError } from 'rxjs';
import { Page } from '../core/models/page.model';
import { initialPagedList, loadPage, mutateThenLoad, pagedListMethods } from './paged-list';

describe('paged list helpers', () => {
  const page = { items: ['a', 'b'], total: 2, page: 1, perPage: 20, pages: 1 };
  // rxMethod lives in an injection context, as in a store.
  const inContext = <R>(fn: () => R): R => TestBed.runInInjectionContext(fn);

  it('loads a page into the store', () => {
    const store = signalState(initialPagedList<string>());
    inContext(() => loadPage(store, () => of(page)))();
    expect(store.items()).toEqual(['a', 'b']);
    expect(store.loading()).toBe(false);
  });

  it('never leaves the list dimmed when a load fails', () => {
    const store = signalState(initialPagedList<string>());
    inContext(() => loadPage(store, () => throwError(() => new Error('offline'))))();
    expect(store.loading()).toBe(false);
  });

  it('keeps the list loading while a newer request replaces a cancelled one', () => {
    const store = signalState(initialPagedList<string>());
    const answers: Subject<Page<string>>[] = [];
    const load = inContext(() => loadPage(store, () => {
      const answer = new Subject<Page<string>>();
      answers.push(answer);
      return answer;
    }));
    load();
    load();
    expect(store.loading()).toBe(true);
    answers[1].next(page);
    answers[1].complete();
    expect(store.loading()).toBe(false);
  });

  it('reloads after a change, after its own next step', () => {
    const store = signalState(initialPagedList<string>());
    const steps: string[] = [];
    const change = inContext(() => mutateThenLoad(
      store, (n: number) => of(n * 2), () => steps.push('load'), (result) => steps.push(`then ${result}`),
    ));
    change(21);
    expect(steps).toEqual(['then 42', 'load']);
  });

  it('skips the reload when a change fails, the list usable', () => {
    const store = signalState(initialPagedList<string>());
    const load = vi.fn();
    inContext(() => mutateThenLoad(store, () => throwError(() => new Error('409')), load))(undefined);
    expect(load).not.toHaveBeenCalled();
    expect(store.loading()).toBe(false);
  });

  it('goes back to the first page on a new search or sort', () => {
    const store = signalState({ ...initialPagedList<string>(), page: 3 });
    const methods = pagedListMethods(store, () => undefined);
    methods.setSearch('pinot');
    expect(store.search()).toBe('pinot');
    expect(store.page()).toBe(1);
    methods.setPage(2);
    methods.toggleSort('name');
    expect(store.sort()).toEqual({ key: 'name', order: 'asc' });
    expect(store.page()).toBe(1);
  });
});
