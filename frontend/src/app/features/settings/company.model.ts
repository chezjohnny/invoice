export interface CompanyProfile {
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
  paymentTermsDays: number;
  /** New deadline a payment reminder gives, counted from its date. */
  reminderTermsDays: number;
  isComplete: boolean;
}

export type CompanyProfileData = Omit<CompanyProfile, 'isComplete'>;
