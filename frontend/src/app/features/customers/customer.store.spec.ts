import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CUSTOMER_SERVICE } from '../../core/tokens/customer-service.token';
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
  {
    id: '3', firstName: 'Old', lastName: 'Client',
    addressLine1: '', postalCode: '', city: '', country: 'CH',
    email: null, phones: [], isArchived: true,
  },
];

describe('CustomerStore', () => {
  let store: InstanceType<typeof CustomerStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        CustomerStore,
        {
          provide: CUSTOMER_SERVICE,
          useValue: {
            getAll: async () => structuredClone(CUSTOMERS),
            create: async (data: Omit<Customer, 'id' | 'isArchived'>) => ({
              ...data, id: 'new-id', isArchived: false,
            }),
            update: async (id: string, data: Omit<Customer, 'id' | 'isArchived'>) => ({
              ...data, id, isArchived: false,
            }),
            archive: async () => {},
            exportCsv: async () => new Blob([''], { type: 'text/csv' }),
          },
        },
      ],
    });
    store = TestBed.inject(CustomerStore);
  });

  it('loads all customers', async () => {
    await store.load();
    expect(store.entities().length).toBe(3);
  });

  it('filteredCustomers excludes archived', async () => {
    await store.load();
    expect(store.filteredCustomers().length).toBe(2);
  });

  it('filters by name case-insensitively', async () => {
    await store.load();
    store.setFilter('martin');
    expect(store.filteredCustomers().length).toBe(1);
    expect(store.filteredCustomers()[0].lastName).toBe('Martin');
  });

  it('filters by first name', async () => {
    await store.load();
    store.setFilter('bob');
    expect(store.filteredCustomers().length).toBe(1);
    expect(store.filteredCustomers()[0].firstName).toBe('Bob');
  });

  it('archive removes customer from filtered list', async () => {
    await store.load();
    await store.archive('1');
    expect(store.filteredCustomers().find((c) => c.id === '1')).toBeUndefined();
    expect(store.entities().find((c) => c.id === '1')?.isArchived).toBe(true);
  });

  it('createCustomer adds a new entity', async () => {
    await store.load();
    await store.createCustomer({
      firstName: 'New', lastName: 'Customer',
      addressLine1: '', postalCode: '', city: '', country: 'CH', email: null, phones: [],
    });
    expect(store.filteredCustomers().some((c) => c.firstName === 'New')).toBe(true);
  });

  it('updateCustomer updates an existing entity', async () => {
    await store.load();
    await store.updateCustomer('1', {
      firstName: 'Alice', lastName: 'Updated',
      addressLine1: '', postalCode: '', city: '', country: 'CH', email: null, phones: [],
    });
    expect(store.entities().find((c) => c.id === '1')?.lastName).toBe('Updated');
  });
});
