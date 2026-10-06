import { signalState } from '@ngrx/signals';
import { initialPagedList, loadPage, mutateThenLoad, pagedListMethods } from './paged-list';

describe('paged list helpers', () => {
  const page = { items: ['a', 'b'], total: 2, page: 1, perPage: 20, pages: 1 };

  it('loads a page into the store', async () => {
    const store = signalState(initialPagedList<string>());
    await loadPage(store, async () => page);
    expect(store.items()).toEqual(['a', 'b']);
    expect(store.loading()).toBe(false);
  });

  it('never leaves the list dimmed when a load fails', async () => {
    const store = signalState(initialPagedList<string>());
    await expect(loadPage(store, async () => { throw new Error('offline'); })).rejects.toThrow();
    expect(store.loading()).toBe(false);
  });

  it('reloads after a change, and returns its result', async () => {
    const store = signalState(initialPagedList<string>());
    const load = vi.fn(async () => undefined);
    expect(await mutateThenLoad(store, async () => 42, load)).toBe(42);
    expect(load).toHaveBeenCalledOnce();
  });

  it('skips the reload when a change fails', async () => {
    const store = signalState(initialPagedList<string>());
    const load = vi.fn(async () => undefined);
    await expect(mutateThenLoad(store, async () => { throw new Error('409'); }, load)).rejects.toThrow();
    expect(load).not.toHaveBeenCalled();
    expect(store.loading()).toBe(false);
  });

  it('goes back to the first page on a new search or sort', async () => {
    const store = signalState({ ...initialPagedList<string>(), page: 3 });
    const methods = pagedListMethods(store, async () => undefined);
    await methods.setSearch('pinot');
    expect(store.search()).toBe('pinot');
    expect(store.page()).toBe(1);
    await methods.setPage(2);
    await methods.toggleSort('name');
    expect(store.sort()).toEqual({ key: 'name', order: 'asc' });
    expect(store.page()).toBe(1);
  });
});
