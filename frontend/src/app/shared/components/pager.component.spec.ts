import { pageWindow } from './pager.component';

describe('pageWindow', () => {
  it('always shows 5 pages when there are enough', () => {
    expect(pageWindow(1, 10)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(2, 10)).toEqual([1, 2, 3, 4, 5]);
    expect(pageWindow(6, 10)).toEqual([4, 5, 6, 7, 8]);
    expect(pageWindow(9, 10)).toEqual([6, 7, 8, 9, 10]);
    expect(pageWindow(10, 10)).toEqual([6, 7, 8, 9, 10]);
  });

  it('shows every page when there are fewer than 5', () => {
    expect(pageWindow(2, 3)).toEqual([1, 2, 3]);
  });
});
