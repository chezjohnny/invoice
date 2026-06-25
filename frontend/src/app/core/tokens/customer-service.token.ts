import { InjectionToken } from '@angular/core';
import type { Customer } from '../../features/customers/customer.model';

export interface ICustomerService {
  getAll(): Promise<Customer[]>;
  create(data: Omit<Customer, 'id' | 'isArchived'>): Promise<Customer>;
  update(id: string, data: Omit<Customer, 'id' | 'isArchived'>): Promise<Customer>;
  archive(id: string): Promise<void>;
  exportCsv(): Promise<Blob>;
}

export const CUSTOMER_SERVICE = new InjectionToken<ICustomerService>('CustomerService');
