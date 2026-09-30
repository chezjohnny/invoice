import { InjectionToken } from '@angular/core';
import type { Customer } from '../../features/customers/customer.model';
import type { Page } from '../models/page.model';
import type { Sort } from '../../shared/sort';

export interface CustomerListParams {
  search?: string;
  archived?: boolean;
  sort?: Sort | null;
  page?: number;
  perPage?: number;
}

export interface ICustomerService {
  list(params: CustomerListParams): Promise<Page<Customer>>;
  getById(id: string): Promise<Customer>;
  create(data: Omit<Customer, 'id' | 'isArchived'>): Promise<Customer>;
  update(id: string, data: Omit<Customer, 'id' | 'isArchived'>): Promise<Customer>;
  archive(id: string): Promise<void>;
  restore(id: string): Promise<void>;
  exportCsv(): Promise<Blob>;
}

export const CUSTOMER_SERVICE = new InjectionToken<ICustomerService>('CustomerService');
