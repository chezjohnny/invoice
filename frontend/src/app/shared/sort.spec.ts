import { nextSort, sortItems } from './sort';

describe('nextSort', () => {
  it('cycles ascending, descending, then back to the default order', () => {
    const asc = nextSort(null, 'name');
    expect(asc).toEqual({ key: 'name', order: 'asc' });
    const desc = nextSort(asc, 'name');
    expect(desc).toEqual({ key: 'name', order: 'desc' });
    expect(nextSort(desc, 'name')).toBeNull();
  });

  it('starts ascending on another column', () => {
    expect(nextSort({ key: 'name', order: 'desc' }, 'city')).toEqual({ key: 'city', order: 'asc' });
  });
});

describe('sortItems', () => {
  const items = [{ n: 2 }, { n: null }, { n: 1 }];
  const keys = { n: (i: { n: number | null }) => i.n };

  it('keeps empty values last in both directions', () => {
    expect(sortItems(items, { key: 'n', order: 'asc' }, keys).map((i) => i.n)).toEqual([1, 2, null]);
    expect(sortItems(items, { key: 'n', order: 'desc' }, keys).map((i) => i.n)).toEqual([2, 1, null]);
  });

  it('leaves the order untouched without a sort', () => {
    expect(sortItems(items, null, keys)).toBe(items);
  });
});
