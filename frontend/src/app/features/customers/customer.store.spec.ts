import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CUSTOMER_SERVICE } from '../../core/tokens/customer-service.token';
import { Page } from '../../core/models/page.model';
import { Customer } from './customer.model';
import { CustomerStore } from './customer.store';

const CUSTOMERS: Customer[] = [
  {
    id: '1', firstName: 'Alice', lastName: 'Martin',
    addressLine1: 'Rue du Lac 1', postalCode: '1000', city: 'Lausanne', country: 'CH',
    email: 'alice@example.com', phones: [], isArchived: false,
  },
  {
    id: '2', firstName: 'Bob', lastName: 'Dupont',
    addressLine1: '', postalCode: '1200', city: 'Genève', country: 'CH',
    email: null, phones: [], isArchived: false,
  },
];

function makePage(items: Customer[]): Page<Customer> {
  return { items, total: items.length, page: 1, perPage: 20, pages: 1 };
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
            list: async () => makePage(customers.filter((c) => !c.isArchived)),
            create: async (data: Omit<Customer, 'id' | 'isArchived'>) => {
              const c = { ...data, id: 'new-id', isArchived: false };
              customers.push(c);
              return c;
            },
            update: async (id: string, data: Omit<Customer, 'id' | 'isArchived'>) => {
              const idx = customers.findIndex((c) => c.id === id);
              customers[idx] = { ...customers[idx], ...data };
              return customers[idx];
            },
            archive: async (id: string) => {
              const c = customers.find((c) => c.id === id);
              if (c) c.isArchived = true;
            },
            exportCsv: async () => new Blob([''], { type: 'text/csv' }),
          },
        },
      ],
    });
    store = TestBed.inject(CustomerStore);
  });

  it('loads customers on init', async () => {
    await store.load();
    expect(store.items().length).toBe(2);
    expect(store.total()).toBe(2);
  });

  it('setSearch resets page to 1', async () => {
    await store.load();
    store.setSearch('alice');
    expect(store.page()).toBe(1);
    expect(store.search()).toBe('alice');
  });

  it('createCustomer reloads the list', async () => {
    await store.load();
    await store.createCustomer({
      firstName: 'New', lastName: 'Customer',
      addressLine1: '', postalCode: '', city: '', country: 'CH', email: null, phones: [],
    });
    expect(store.items().some((c) => c.id === 'new-id')).toBe(true);
  });

  it('updateCustomer reflects changes after reload', async () => {
    await store.load();
    await store.updateCustomer('1', {
      firstName: 'Alice', lastName: 'Updated',
      addressLine1: '', postalCode: '', city: '', country: 'CH', email: null, phones: [],
    });
    expect(store.items().find((c) => c.id === '1')?.lastName).toBe('Updated');
  });

  it('archive removes customer from list', async () => {
    await store.load();
    await store.archive('1');
    expect(store.items().find((c) => c.id === '1')).toBeUndefined();
  });

  it('setPage updates the page signal', () => {
    store.setPage(3);
    expect(store.page()).toBe(3);
  });
});
