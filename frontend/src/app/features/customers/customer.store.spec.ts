import { provideZonelessChangeDetection } from '@angular/core';
import { of } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { CUSTOMER_SERVICE } from '../../core/tokens/customer-service.token';
import { Page } from '../../core/models/page.model';
import { Customer } from './customer.model';
import { CustomerStore } from './customer.store';

const CUSTOMERS: Customer[] = [
  {
    id: '1', firstName: 'Alice', lastName: 'Martin',
    addressLine1: 'Rue du Lac 1', addressLine2: null, postalCode: '1000', city: 'Lausanne', country: 'CH',
    email: 'alice@example.com', phones: [], isArchived: false,
  },
  {
    id: '2', firstName: 'Bob', lastName: 'Dupont',
    addressLine1: '', addressLine2: null, postalCode: '1200', city: 'Genève', country: 'CH',
    email: null, phones: [], isArchived: false,
  },
];

function makePage(items: Customer[], page = 1): Page<Customer> {
  return { items, total: items.length, page, perPage: 20, pages: Math.max(page, 1) };
}

describe('CustomerStore', () => {
  let store: InstanceType<typeof CustomerStore>;
  let customers: Customer[];

  beforeEach(() => {
    customers = structuredClone(CUSTOMERS);
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        CustomerStore,
        {
          provide: CUSTOMER_SERVICE,
          useValue: {
            list: (params: { archived?: boolean; page?: number }) =>
              of(makePage(customers.filter((c) => c.isArchived === (params.archived ?? false)), params.page)),
            archive: (id: string) => {
              const c = customers.find((c) => c.id === id);
              if (c) c.isArchived = true;
              return of(undefined);
            },
            restore: (id: string) => {
              const c = customers.find((c) => c.id === id);
              if (c) c.isArchived = false;
              return of(undefined);
            },
            exportCsv: () => of(new Blob([''], { type: 'text/csv' })),
          },
        },
      ],
    });
    store = TestBed.inject(CustomerStore);
  });

  it('loads customers on init', () => {
    store.load();
    expect(store.items().length).toBe(2);
    expect(store.total()).toBe(2);
  });

  it('setSearch resets page to 1', () => {
    store.load();
    store.setSearch('alice');
    expect(store.page()).toBe(1);
    expect(store.search()).toBe('alice');
  });

  it('archive removes customer from list', () => {
    store.load();
    store.archive('1');
    expect(store.items().find((c) => c.id === '1')).toBeUndefined();
  });

  it('shows archived customers and restores them to the active list', () => {
    store.load();
    store.archive('1');
    store.setPage(2);

    store.setArchived(true);
    expect(store.page()).toBe(1);
    expect(store.items().map((c) => c.id)).toEqual(['1']);

    store.restore('1');
    expect(store.items()).toEqual([]);

    store.setArchived(false);
    expect(store.items().some((c) => c.id === '1')).toBe(true);
  });

  it('setPage updates the page signal', () => {
    store.setPage(3);
    expect(store.page()).toBe(3);
  });
});
