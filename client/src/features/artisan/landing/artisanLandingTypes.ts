import type { Dispatch, SetStateAction } from 'react';
import type { User } from 'firebase/auth';
import type { ActionRunner } from '../../../appTypes';
import type {
  Artisan,
  ArtisanKycSubmission,
  AvailabilitySlot,
  Category,
  Offering,
  PortfolioImage,
} from '../../../types';

export type ArtisanSetupState = {
  fullName: string;
  businessName: string;
  categoryId: string;
  location: string;
  area: string;
  lat: string;
  lng: string;
  title: string;
  priceFrom: string;
  description: string;
  documentNumber: string;
  address: string;
};

export type ServicePackageDraft = {
  localId: string;
  categoryId: string;
  title: string;
  priceFrom: string;
  description: string;
};

export const ARTISAN_SETUP_STEPS = [
  { id: 'basic', label: 'Basic info', shortLabel: 'Basic' },
  { id: 'pricing', label: 'Services & pricing', shortLabel: 'Pricing' },
  { id: 'portfolio', label: 'Portfolio', shortLabel: 'Photos' },
  { id: 'submit', label: 'Availability & submit', shortLabel: 'Submit' },
] as const;

export type ArtisanLandingProps = {
  token: string;
  categories: Category[];
  offerings: Offering[];
  /** Passed from HomePage; onboarding flow does not use these yet. */
  bookings?: unknown[];
  firebaseUser: User | null;
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
  openBookings?: () => void;
  openMessages?: () => void;
  openReviews?: () => void;
  openProfile?: () => void;
};

export type ArtisanLandingModel = {
  displayName: string;
  accountEmail: string | null;
  phase: string;
  step: number;
  setStep: (step: number | ((current: number) => number)) => void;
  busy: boolean;
  runAction: ActionRunner;
  categories: Category[];
  setup: ArtisanSetupState;
  updateSetup: (field: keyof ArtisanSetupState, value: string) => void;
  agreed: boolean;
  setAgreed: (value: boolean) => void;
  servicePackages: ServicePackageDraft[];
  updateServicePackage: (
    localId: string,
    field: 'categoryId' | 'title' | 'priceFrom' | 'description',
    value: string
  ) => void;
  addServicePackage: () => void;
  removeServicePackage: (localId: string) => void;
  portfolioImages: PortfolioImage[];
  uploadingPortfolio: boolean;
  uploadPortfolioFile: (file: File, displayOrder: number) => Promise<void>;
  uploadPortfolioFiles: (files: File[]) => Promise<void>;
  removePortfolioImage: (imageId: string) => Promise<void>;
  selectedDays: number[];
  setSelectedDays: Dispatch<SetStateAction<number[]>>;
  startTime: string;
  setStartTime: (value: string) => void;
  endTime: string;
  setEndTime: (value: string) => void;
  kycDocumentFile: File | null;
  setKycDocumentFile: (file: File | null) => void;
  submitAgreed: boolean;
  setSubmitAgreed: (value: boolean) => void;
  kycSubmission: ArtisanKycSubmission | null;
  profile: Artisan | null;
  saveBasicInfo: () => Promise<void>;
  saveOffering: () => Promise<void>;
  submitForVerification: () => Promise<void>;
  openSetupEditor: () => void;
  useCurrentLocation: () => Promise<void>;
};
