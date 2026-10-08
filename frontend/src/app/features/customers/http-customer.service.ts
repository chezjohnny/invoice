import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { CustomerListParams, ICustomerService } from '../../core/tokens/customer-service.token';
import { Page, PageDto, toPage } from '../../core/models/page.model';
import { withSort } from '../../shared/sort';
import { Customer, CustomerData } from './customer.model';

interface PhoneDto {
  label: string;
  number: string;
}

interface CustomerDto {
  id: string;
  first_name: string;
  last_name: string;
  address_line1: string;
  address_line2: string | null;
  postal_code: string;
  city: string;
  country: string;
  email: string | null;
  phones: PhoneDto[];
  is_archived: boolean;
}


@Injectable()
export class HttpCustomerService implements ICustomerService {
  private readonly http = inject(HttpClient);

  list(params: CustomerListParams): Observable<Page<Customer>> {
    const httpParams = new HttpParams()
      .set('search', params.search ?? '')
      .set('archived', String(params.archived ?? false))
      .set('page', String(params.page ?? 1))
      .set('per_page', String(params.perPage ?? 20));
    return this.http.get<PageDto<CustomerDto>>('/api/customers', {
      params: withSort(httpParams, params.sort),
    }).pipe(map((dto) => toPage(dto, this.toCustomer)));
  }

  getById(id: string): Observable<Customer> {
    return this.http.get<CustomerDto>(`/api/customers/${id}`).pipe(map(this.toCustomer));
  }

  create(data: CustomerData): Observable<Customer> {
    return this.http.post<CustomerDto>('/api/customers', this.toDto(data)).pipe(map(this.toCustomer));
  }

  update(id: string, data: CustomerData): Observable<Customer> {
    return this.http.put<CustomerDto>(`/api/customers/${id}`, this.toDto(data)).pipe(map(this.toCustomer));
  }

  archive(id: string): Observable<void> {
    return this.http.patch<void>(`/api/customers/${id}/archive`, {});
  }

  restore(id: string): Observable<void> {
    return this.http.patch<void>(`/api/customers/${id}/restore`, {});
  }

  exportCsv(): Observable<Blob> {
    return this.http.get('/api/customers/export.csv', { responseType: 'blob' });
  }

  private toCustomer(dto: CustomerDto): Customer {
    return {
      id: dto.id,
      firstName: dto.first_name,
      lastName: dto.last_name,
      addressLine1: dto.address_line1,
      addressLine2: dto.address_line2,
      postalCode: dto.postal_code,
      city: dto.city,
      country: dto.country,
      email: dto.email,
      phones: dto.phones,
      isArchived: dto.is_archived,
    };
  }

  private toDto(data: CustomerData) {
    return {
      first_name: data.firstName,
      last_name: data.lastName,
      address_line1: data.addressLine1,
      address_line2: data.addressLine2,
      postal_code: data.postalCode,
      city: data.city,
      country: data.country,
      email: data.email,
      phones: data.phones,
    };
  }
}
