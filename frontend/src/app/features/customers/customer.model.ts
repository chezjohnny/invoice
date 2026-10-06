export interface PhoneEntry {
  label: string;
  number: string;
}

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2: string | null;
  postalCode: string;
  city: string;
  country: string;
  email: string | null;
  phones: PhoneEntry[];
  isArchived: boolean;
}

/** What a form edits: everything but the id and the archived flag. */
export type CustomerData = Omit<Customer, 'id' | 'isArchived'>;

/** 'Dupont, Jean': how a customer is listed and shown; a company has no first name. */
export function customerDisplayName(customer: Pick<Customer, 'firstName' | 'lastName'>): string {
  return [customer.lastName, customer.firstName].filter(Boolean).join(', ');
}
