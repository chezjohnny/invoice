import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ICustomerService } from '../../core/tokens/customer-service.token';
import { Customer, PhoneEntry } from './customer.model';

interface PhoneDto {
  label: string;
  number: string;
}

interface CustomerDto {
  id: string;
  tenant_id: string;
  first_name: string;
  last_name: string;
  address_line1: string;
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

  getAll(): Promise<Customer[]> {
    return firstValueFrom(this.http.get<CustomerDto[]>('/api/customers')).then((dtos) =>
      dtos.map(this.toCustomer)
    );
  }

  create(data: Omit<Customer, 'id' | 'isArchived'>): Promise<Customer> {
    return firstValueFrom(
      this.http.post<CustomerDto>('/api/customers', this.toDto(data))
    ).then(this.toCustomer);
  }

  update(id: string, data: Omit<Customer, 'id' | 'isArchived'>): Promise<Customer> {
    return firstValueFrom(
      this.http.put<CustomerDto>(`/api/customers/${id}`, this.toDto(data))
    ).then(this.toCustomer);
  }

  archive(id: string): Promise<void> {
    return firstValueFrom(this.http.patch<void>(`/api/customers/${id}/archive`, {}));
  }

  exportCsv(): Promise<Blob> {
    return firstValueFrom(
      this.http.get('/api/customers/export.csv', { responseType: 'blob' })
    );
  }

  private toCustomer(dto: CustomerDto): Customer {
    return {
      id: dto.id,
      firstName: dto.first_name,
      lastName: dto.last_name,
      addressLine1: dto.address_line1,
      postalCode: dto.postal_code,
      city: dto.city,
      country: dto.country,
      email: dto.email,
      phones: dto.phones,
      isArchived: dto.is_archived,
    };
  }

  private toDto(data: Omit<Customer, 'id' | 'isArchived'>) {
    return {
      first_name: data.firstName,
      last_name: data.lastName,
      address_line1: data.addressLine1,
      postal_code: data.postalCode,
      city: data.city,
      country: data.country,
      email: data.email,
      phones: data.phones,
    };
  }
}
