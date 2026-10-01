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
