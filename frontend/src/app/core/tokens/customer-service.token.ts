import { InjectionToken } from '@angular/core';
import type { Observable } from 'rxjs';
import type { Customer, CustomerData } from '../../features/customers/customer.model';
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
  list(params: CustomerListParams): Observable<Page<Customer>>;
  getById(id: string): Observable<Customer>;
  create(data: CustomerData): Observable<Customer>;
  update(id: string, data: CustomerData): Observable<Customer>;
  archive(id: string): Observable<void>;
  restore(id: string): Observable<void>;
  exportCsv(): Observable<Blob>;
}

export const CUSTOMER_SERVICE = new InjectionToken<ICustomerService>('CustomerService');
