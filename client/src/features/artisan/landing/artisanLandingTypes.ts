import type { Dispatch, SetStateAction } from 'react';
import type { User } from 'firebase/auth';
import type { ActionRunner } from '../../../appTypes';
import type {
  Artisan,
  ArtisanKycSubmission,
  AvailabilitySlot,
  ApiUser,
  Category,
  Offering,
  PortfolioImage,
} from '../../../types';
import type { LocationListItem } from '../../../types/location';

export type ArtisanSetupSubPhase = 'wizard' | 'verification';

export type ArtisanSetupState = {
  fullName: string;
  businessName: string;
  categoryId: string;
  location: string;
  area: string;
  locationId: string;
  locationLabel: string;
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
  { id: 'basic', label: 'About you', shortLabel: 'About' },
  { id: 'service', label: 'Your service', shortLabel: 'Service' },
  { id: 'golive', label: 'Go live', shortLabel: 'Go live' },
] as const;

export type ArtisanLandingProps = {
  token: string;
  me: ApiUser | null;
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
  setupSubPhase: ArtisanSetupSubPhase;
  progressPercent: number;
  resumeMessage: string | null;
  busy: boolean;
  runAction: ActionRunner;
  categories: Category[];
  setup: ArtisanSetupState;
  updateSetup: (field: keyof ArtisanSetupState, value: string) => void;
  applyCatalogLocation: (item: LocationListItem) => void;
  agreed: boolean;
  setAgreed: (value: boolean) => void;
  servicePackages: ServicePackageDraft[];
  updateServicePackage: (
    localId: string,
    field: 'categoryId' | 'title' | 'priceFrom' | 'description',
    value: string
  ) => void;
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
  saveAvailabilityAndContinue: () => Promise<void>;
  submitKycVerification: () => Promise<void>;
  openSetupEditor: () => void;
  useCurrentLocation: () => Promise<void>;
  saveAndExit: () => void;
  backToGoLiveFromVerification: () => void;
  token: string;
};
