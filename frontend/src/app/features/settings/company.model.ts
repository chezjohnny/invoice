export interface CompanyProfile {
  id: string;
  companyName: string;
  addressLine1: string;
  addressLine2: string | null;
  postalCode: string;
  city: string;
  country: string;
  iban: string | null;
  twintPhone: string | null;
  phone: string | null;
  vatNumber: string | null;
  defaultVatRate: number | null;
  invoicePrefix: string;
  paymentTermsDays: number;
  isComplete: boolean;
}

export type CompanyProfileData = Omit<CompanyProfile, 'id' | 'isComplete'>;
