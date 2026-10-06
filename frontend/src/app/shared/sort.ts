import { HttpParams } from '@angular/common/http';

export type SortOrder = 'asc' | 'desc';

export interface Sort {
  key: string;
  order: SortOrder;
}

/** Clicking a column cycles: ascending, descending, then back to the default order. */
export function nextSort(current: Sort | null, key: string): Sort | null {
  if (current?.key !== key) return { key, order: 'asc' };
  return current.order === 'asc' ? { key, order: 'desc' } : null;
}

export function withSort(params: HttpParams, sort: Sort | null | undefined): HttpParams {
  return sort ? params.set('sort', sort.key).set('order', sort.order) : params;
}

/** Client-side mirror of the API sort, for the mock services: empty values last. */
export function sortItems<T>(
  items: T[],
  sort: Sort | null | undefined,
  keys: Record<string, (item: T) => string | number | null>,
): T[] {
  const value = sort ? keys[sort.key] : undefined;
  if (!sort || !value) return items;
  const direction = sort.order === 'asc' ? 1 : -1;
  return [...items].sort((a, b) => {
    const x = value(a);
    const y = value(b);
    if (x === y) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    const diff = typeof x === 'string' ? x.localeCompare(String(y)) : x - Number(y);
    return diff * direction;
  });
}
