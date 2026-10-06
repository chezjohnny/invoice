export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  perPage: number;
  pages: number;
}

/** A page as the API sends it (snake_case). */
export interface PageDto<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export function toPage<D, T>(dto: PageDto<D>, toItem: (item: D) => T): Page<T> {
  return {
    items: dto.items.map(toItem),
    total: dto.total,
    page: dto.page,
    perPage: dto.per_page,
    pages: dto.pages,
  };
}
