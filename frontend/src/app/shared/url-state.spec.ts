import { signal } from '@angular/core';
import { convertToParamMap } from '@angular/router';
import { Sort } from './sort';
import { pagedListParams, readPagedList } from './url-state';

describe('list state in the URL', () => {
  it('reads the search, page and sort', () => {
    const params = convertToParamMap({ q: 'pinot', page: '3', sort: 'name', order: 'desc' });
    expect(readPagedList(params)).toEqual({
      search: 'pinot', page: 3, sort: { key: 'name', order: 'desc' },
    });
  });

  it('ignores missing or invalid values', () => {
    expect(readPagedList(convertToParamMap({ page: 'abc' }))).toEqual({});
    expect(readPagedList(convertToParamMap({ page: '1', sort: 'total' }))).toEqual({
      sort: { key: 'total', order: 'asc' },
    });
  });

  it('writes only what differs from the defaults', () => {
    const list = { search: signal(''), page: signal(1), sort: signal<Sort | null>(null) };
    expect(pagedListParams(list)).toEqual({ q: null, page: null, sort: null, order: null });
    list.search.set('pinot');
    list.page.set(2);
    list.sort.set({ key: 'date', order: 'desc' });
    expect(pagedListParams(list)).toEqual({ q: 'pinot', page: 2, sort: 'date', order: 'desc' });
  });
});
