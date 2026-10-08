import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { CustomerListParams, ICustomerService } from '../../core/tokens/customer-service.token';
import { Page } from '../../core/models/page.model';
import { sortItems } from '../../shared/sort';
import { Customer, CustomerData } from './customer.model';

const INITIAL: Customer[] = [
  {
    id: '1', firstName: 'Jean', lastName: 'Dupont',
    addressLine1: 'Rue de la Gare 12', addressLine2: null, postalCode: '1110', city: 'Morges', country: 'CH',
    email: 'jean.dupont@example.ch', phones: [{ label: 'Mobile', number: '+41 79 123 45 67' }],
    isArchived: false,
  },
  {
    id: '2', firstName: 'Marie', lastName: 'Martin',
    addressLine1: 'Avenue du Lac 5', addressLine2: null, postalCode: '1820', city: 'Montreux', country: 'CH',
    email: 'marie.martin@example.ch', phones: [],
    isArchived: false,
  },
  {
    id: '3', firstName: 'Pierre', lastName: 'Blanc',
    addressLine1: 'Chemin des Vignes 3', addressLine2: null, postalCode: '1173', city: 'Féchy', country: 'CH',
    email: null, phones: [{ label: 'Tel', number: '+41 21 800 00 01' }],
    isArchived: false,
  },
  {
    id: '4', firstName: 'Sophie', lastName: 'Renard',
    addressLine1: 'Grand-Rue 18', addressLine2: null, postalCode: '1009', city: 'Pully', country: 'CH',
    email: 'sophie.renard@example.ch', phones: [],
    isArchived: false,
  },
  {
    id: '5', firstName: 'Luc', lastName: 'Favre',
    addressLine1: 'Route de Lausanne 40', addressLine2: null, postalCode: '1180', city: 'Rolle', country: 'CH',
    email: null, phones: [],
    isArchived: true,
  },
  {
    id: '6', firstName: '', lastName: 'Garage du Lac SA',
    addressLine1: 'Route du Lac 2', addressLine2: 'Par Mme Anne Dupuis', postalCode: '1932',
    city: 'Bovernier', country: 'CH', email: null, phones: [],
    isArchived: false,
  },
];

@Injectable()
export class MockCustomerService implements ICustomerService {
  private customers = structuredClone(INITIAL);
  private nextId = INITIAL.length + 1;

  list(params: CustomerListParams): Observable<Page<Customer>> {
    const search = (params.search ?? '').toLowerCase();
    const page = params.page ?? 1;
    const perPage = params.perPage ?? 20;
    const filtered = this.customers.filter((c) => {
      if (c.isArchived !== (params.archived ?? false)) return false;
      if (!search) return true;
      // Simplified mirror of the API phone search: digits only, +41 read as a leading 0.
      const digits = (n: string) => n.replace(/^\s*\+41/, '0').replace(/\D/g, '');
      if (/^\+?[\d\s().\-/]+$/.test(search) && digits(search).length >= 3) {
        return c.phones.some((p) => digits(p.number).includes(digits(search)));
      }
      return (
        c.lastName.toLowerCase().includes(search) ||
        c.firstName.toLowerCase().includes(search) ||
        (c.email?.toLowerCase().includes(search) ?? false)
      );
    }).reverse();
    const sorted = sortItems(filtered, params.sort, {
      name: (c) => `${c.lastName} ${c.firstName}`.toLowerCase(),
      email: (c) => c.email?.toLowerCase() ?? null,
      city: (c) => c.city.toLowerCase(),
    });
    const total = sorted.length;
    const items = sorted.slice((page - 1) * perPage, page * perPage);
    const pages = Math.max(1, Math.ceil(total / perPage));
    return of({ items, total, page, perPage, pages });
  }

  getById(id: string): Observable<Customer> {
    const customer = this.customers.find((c) => c.id === id);
    if (!customer) return throwError(() => new Error(`Customer ${id} not found`));
    return of(customer);
  }

  create(data: CustomerData): Observable<Customer> {
    const customer: Customer = { ...data, id: String(this.nextId++), isArchived: false };
    this.customers.push(customer);
    return of(customer);
  }

  update(id: string, data: CustomerData): Observable<Customer> {
    const index = this.customers.findIndex((c) => c.id === id);
    this.customers[index] = { ...this.customers[index], ...data };
    return of(this.customers[index]);
  }

  archive(id: string): Observable<void> {
    const c = this.customers.find((c) => c.id === id);
    if (c) c.isArchived = true;
    return of(undefined);
  }

  restore(id: string): Observable<void> {
    const c = this.customers.find((c) => c.id === id);
    if (c) c.isArchived = false;
    return of(undefined);
  }

  exportCsv(): Observable<Blob> {
    const lines = ['first_name,last_name,email,address_line1,address_line2,postal_code,city,country'];
    for (const c of this.customers.filter((c) => !c.isArchived)) {
      lines.push(
        `${c.firstName},${c.lastName},${c.email ?? ''},${c.addressLine1},${c.addressLine2 ?? ''},${c.postalCode},${c.city},${c.country}`
      );
    }
    return of(new Blob([lines.join('\n')], { type: 'text/csv' }));
  }
}
