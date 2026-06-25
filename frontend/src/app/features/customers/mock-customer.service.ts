import { Injectable } from '@angular/core';
import { ICustomerService } from '../../core/tokens/customer-service.token';
import { Customer } from './customer.model';

const INITIAL: Customer[] = [
  {
    id: '1', firstName: 'Jean', lastName: 'Dupont',
    addressLine1: 'Rue de la Gare 12', postalCode: '1110', city: 'Morges', country: 'CH',
    email: 'jean.dupont@example.ch', phones: [{ label: 'Mobile', number: '+41 79 123 45 67' }],
    isArchived: false,
  },
  {
    id: '2', firstName: 'Marie', lastName: 'Martin',
    addressLine1: 'Avenue du Lac 5', postalCode: '1820', city: 'Montreux', country: 'CH',
    email: 'marie.martin@example.ch', phones: [],
    isArchived: false,
  },
  {
    id: '3', firstName: 'Pierre', lastName: 'Blanc',
    addressLine1: 'Chemin des Vignes 3', postalCode: '1173', city: 'Féchy', country: 'CH',
    email: null, phones: [{ label: 'Tel', number: '+41 21 800 00 01' }],
    isArchived: false,
  },
  {
    id: '4', firstName: 'Sophie', lastName: 'Renard',
    addressLine1: 'Grand-Rue 18', postalCode: '1009', city: 'Pully', country: 'CH',
    email: 'sophie.renard@example.ch', phones: [],
    isArchived: false,
  },
];

@Injectable()
export class MockCustomerService implements ICustomerService {
  private customers = structuredClone(INITIAL);
  private nextId = INITIAL.length + 1;

  getAll(): Promise<Customer[]> {
    return Promise.resolve(this.customers.filter((c) => !c.isArchived));
  }

  create(data: Omit<Customer, 'id' | 'isArchived'>): Promise<Customer> {
    const customer: Customer = { ...data, id: String(this.nextId++), isArchived: false };
    this.customers.push(customer);
    return Promise.resolve(customer);
  }

  update(id: string, data: Omit<Customer, 'id' | 'isArchived'>): Promise<Customer> {
    const index = this.customers.findIndex((c) => c.id === id);
    this.customers[index] = { ...this.customers[index], ...data };
    return Promise.resolve(this.customers[index]);
  }

  archive(id: string): Promise<void> {
    const c = this.customers.find((c) => c.id === id);
    if (c) c.isArchived = true;
    return Promise.resolve();
  }

  exportCsv(): Promise<Blob> {
    const lines = ['first_name,last_name,email,address_line1,postal_code,city,country'];
    for (const c of this.customers.filter((c) => !c.isArchived)) {
      lines.push(`${c.firstName},${c.lastName},${c.email ?? ''},${c.addressLine1},${c.postalCode},${c.city},${c.country}`);
    }
    return Promise.resolve(new Blob([lines.join('\n')], { type: 'text/csv' }));
  }
}
