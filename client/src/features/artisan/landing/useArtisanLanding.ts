import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import {
  computeOnboardingProgress,
  computeResumeState,
} from '../../../lib/artisanOnboarding';
import { ensureArtisanApplicantOnServer, markArtisanApplicantSubmitted } from '../../../lib/artisanApplication';
import { artisanVerificationPhase, isPostSetupVerificationPhase } from '../../../lib/artisanVerification';
import { locationErrorMessage, readBrowserLocation } from '../../../lib/geolocation';
import { inferNigeriaState } from '../../../lib/inferNigeriaState';
import { uploadKycImage } from '../../../lib/kycUpload';
import { validateKycForm, validateLegalName } from '../../../lib/kycValidation';
import { uploadPortfolioImage } from '../../../lib/portfolioUpload';
import { validateImageFileForPick } from '../../../lib/imageFile';
import {
  artisanLocationFromCatalogItem,
  artisanLocationFromGps,
  artisanLocationFromProfile,
} from '../../../lib/artisanLocationSelection';
import type { LocationListItem } from '../../../types/location';
import type {
  Artisan,
  ArtisanKycSubmission,
  AvailabilitySlot,
  PortfolioImage,
} from '../../../types';
import type { ArtisanLandingModel, ArtisanLandingProps, ArtisanSetupSubPhase } from './artisanLandingTypes';

const SAVED_NOTICE = 'Saved — you can come back anytime.';

export function useArtisanLanding({
  token,
  me,
  categories,
  offerings,
  firebaseUser,
  busy,
  runAction,
  refresh,
}: ArtisanLandingProps): ArtisanLandingModel {
  const [profile, setProfile] = useState<Artisan | null>(null);
  const [portfolioImages, setPortfolioImages] = useState<PortfolioImage[]>([]);
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([]);
  const [kycSubmission, setKycSubmission] = useState<ArtisanKycSubmission | null>(null);
  const [step, setStep] = useState(1);
  const [setupSubPhase, setSetupSubPhase] = useState<ArtisanSetupSubPhase>('wizard');
  const [resumeMessage, setResumeMessage] = useState<string | null>(null);
  const [uploadingPortfolio, setUploadingPortfolio] = useState(false);
  const [kycDocumentFile, setKycDocumentFile] = useState<File | null>(null);
  const initialProfileLocation = artisanLocationFromProfile(me?.state || 'Lagos', me?.area);
  const [setup, setSetup] = useState({
    fullName: firebaseUser?.displayName || '',
    businessName: '',
    categoryId: '',
    location: initialProfileLocation.state,
    area: initialProfileLocation.area,
    locationId: initialProfileLocation.locationId,
    locationLabel: initialProfileLocation.locationLabel,
    lat: String(initialProfileLocation.lat),
    lng: String(initialProfileLocation.lng),
    title: 'Basic inspection',
    priceFrom: '',
    description: '',
    documentNumber: '',
    address: me?.address || 'Lagos',
  });
  const [servicePackages, setServicePackages] = useState([
    {
      localId: 'package-1',
      categoryId: '',
      title: '',
      priceFrom: '',
      description: '',
    },
  ]);
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('12:00');
  const [agreed, setAgreed] = useState(false);
  const [submitAgreed, setSubmitAgreed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [forceSetup, setForceSetup] = useState(false);

  const kycStatus = kycSubmission?.status ?? 'NOT_SUBMITTED';
  const displayName = profile?.displayName || firebaseUser?.displayName || 'Artisan';
  const accountEmail = firebaseUser?.email || me?.email || null;
  const verificationPhase = artisanVerificationPhase({ profile, kycStatus, hydrated });
  const phase =
    forceSetup && (verificationPhase === 'rejected' || verificationPhase === 'changes_requested')
      ? 'setup'
      : verificationPhase;
  const progressPercent = computeOnboardingProgress(step, setupSubPhase);

  function openSetupEditor() {
    setForceSetup(true);
    setSetupSubPhase('verification');
    setStep(3);
  }

  useEffect(() => {
    let mounted = true;
    setHydrated(false);

    Promise.all([
      api<{ profile: Artisan }>('/artisans/me', { token }).catch(() => ({ profile: null as unknown as Artisan })),
      api<{ images: PortfolioImage[] }>('/artisans/portfolio-images/me', { token }).catch(() => ({ images: [] })),
      api<{ slots: AvailabilitySlot[] }>('/artisans/availability-slots/me', { token }).catch(() => ({ slots: [] })),
      api<{ submission: ArtisanKycSubmission | null }>('/artisans/kyc', { token }),
    ])
      .then(([profileResponse, imageResponse, slotResponse, kycResponse]) => {
        if (!mounted) return;

        const nextProfile = profileResponse.profile || null;
        const nextOfferings = offerings;
        const nextSlots = slotResponse.slots;
        const nextKyc = kycResponse.submission;

        setProfile(nextProfile);
        setPortfolioImages(imageResponse.images);
        setAvailabilitySlots(nextSlots);
        setKycSubmission(nextKyc);

        const nextPhase = artisanVerificationPhase({
          profile: nextProfile,
          kycStatus: nextKyc?.status ?? 'NOT_SUBMITTED',
          hydrated: true,
        });
        if (isPostSetupVerificationPhase(nextPhase) && me?.firebaseUid) {
          markArtisanApplicantSubmitted(me.firebaseUid);
        }

        const resume = computeResumeState({
          profile: nextProfile,
          offerings: nextOfferings,
          availabilitySlots: nextSlots,
          kycSubmission: nextKyc,
        });

        setStep(resume.step);
        setSetupSubPhase(resume.subPhase);

        const firstName = (firebaseUser?.displayName || nextProfile?.displayName || '').split(' ')[0];
        if (resume.resumeLabel && firstName) {
          setResumeMessage(`Welcome back, ${firstName}. You left off at ${resume.resumeLabel}.`);
        } else if (resume.resumeLabel) {
          setResumeMessage(`Welcome back. You left off at ${resume.resumeLabel}.`);
        } else {
          setResumeMessage(null);
        }

        const matchedCategory = categories.find(
          (category) => category.name.toLowerCase() === (nextProfile?.bio || '').toLowerCase()
        );

        const profileLocation = artisanLocationFromProfile(
          nextProfile?.city || me?.state,
          nextProfile?.area || me?.area
        );

        setSetup((current) => ({
          ...current,
          fullName: current.fullName || nextProfile?.displayName || firebaseUser?.displayName || '',
          businessName: nextProfile?.displayName || current.businessName,
          categoryId: matchedCategory?.id || current.categoryId,
          location: profileLocation.state || current.location,
          area: profileLocation.area || current.area,
          locationId: profileLocation.locationId || current.locationId,
          locationLabel: profileLocation.locationLabel || current.locationLabel,
          lat: String(nextProfile?.lat ?? profileLocation.lat ?? current.lat),
          lng: String(nextProfile?.lng ?? profileLocation.lng ?? current.lng),
          address: nextKyc?.address || me?.address || current.address,
          documentNumber: nextKyc?.documentNumber || current.documentNumber,
        }));

        if (nextOfferings[0]) {
          setServicePackages([
            {
              localId: 'package-1',
              categoryId: nextOfferings[0].categoryId,
              title: nextOfferings[0].title,
              priceFrom: String(nextOfferings[0].priceFrom),
              description: nextOfferings[0].description || '',
            },
          ]);
        } else if (matchedCategory?.id) {
          setServicePackages((current) =>
            current.map((servicePackage) => ({
              ...servicePackage,
              categoryId: matchedCategory.id,
            }))
          );
        }
      })
      .finally(() => {
        if (mounted) {
          setHydrated(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, [categories, firebaseUser, me?.address, me?.area, me?.state, offerings, token]);

  async function ensureArtisanProfileForUpload() {
    if (profile?.id) {
      return;
    }

    const existing = await api<{ profile: Artisan }>('/artisans/me', { token }).catch(() => null);
    if (existing?.profile?.id) {
      setProfile(existing.profile);
      return;
    }

    const profileDisplayName =
      setup.fullName.trim() || firebaseUser?.displayName?.trim() || 'Artisan';

    await api('/artisans/profile', {
      method: 'POST',
      token,
      body: JSON.stringify({
        displayName: profileDisplayName,
        bio: categories.find((category) => category.id === setup.categoryId)?.name || 'Bundo artisan',
        city: setup.location.trim() || 'Lagos',
        area: setup.area.trim() || undefined,
        locationId: setup.locationId || undefined,
        lat: Number(setup.lat) || 6.5244,
        lng: Number(setup.lng) || 3.3792,
      }),
    });
  }

  async function hydrateOnboarding() {
    const [profileResponse, imageResponse, slotResponse, kycResponse] = await Promise.all([
      api<{ profile: Artisan }>('/artisans/me', { token }).catch(() => ({ profile: null as unknown as Artisan })),
      api<{ images: PortfolioImage[] }>('/artisans/portfolio-images/me', { token }).catch(() => ({ images: [] })),
      api<{ slots: AvailabilitySlot[] }>('/artisans/availability-slots/me', { token }).catch(() => ({ slots: [] })),
      api<{ submission: ArtisanKycSubmission | null }>('/artisans/kyc', { token }).catch(() => ({ submission: null })),
    ]);
    setProfile(profileResponse.profile || null);
    setPortfolioImages(imageResponse.images);
    setAvailabilitySlots(slotResponse.slots);
    setKycSubmission(kycResponse.submission);
  }

  function updateSetup(field: keyof typeof setup, value: string) {
    setSetup((current) => ({ ...current, [field]: value }));
  }

  function updateServicePackage(
    localId: string,
    field: 'categoryId' | 'title' | 'priceFrom' | 'description',
    value: string
  ) {
    setServicePackages((current) =>
      current.map((servicePackage) =>
        servicePackage.localId === localId ? { ...servicePackage, [field]: value } : servicePackage
      )
    );
  }

  function applyCatalogLocation(item: LocationListItem) {
    const selection = artisanLocationFromCatalogItem(item);
    setSetup((current) => ({
      ...current,
      location: selection.state,
      area: selection.area,
      locationId: selection.locationId,
      locationLabel: selection.locationLabel,
      lat: String(selection.lat),
      lng: String(selection.lng),
    }));
  }

  async function saveBasicInfo() {
    const nameCheck = validateLegalName(setup.fullName);
    if (!nameCheck.ok) {
      throw new Error(nameCheck.message);
    }

    if (!setup.location.trim()) {
      throw new Error('Select where you work.');
    }

    if (me?.role === 'CUSTOMER' && me.onboardingIntent !== 'ARTISAN') {
      await ensureArtisanApplicantOnServer(token, me.firebaseUid);
    }

    await api('/artisans/profile', {
      method: profile ? 'PATCH' : 'POST',
      token,
      body: JSON.stringify({
        displayName: setup.fullName.trim(),
        bio: categories.find((category) => category.id === setup.categoryId)?.name || 'Bundo artisan',
        city: setup.location.trim(),
        area: setup.area.trim() || undefined,
        locationId: setup.locationId || undefined,
        lat: Number(setup.lat),
        lng: Number(setup.lng),
      }),
    });

    setServicePackages((current) =>
      current.map((servicePackage) => ({
        ...servicePackage,
        categoryId: servicePackage.categoryId || setup.categoryId,
      }))
    );

    await hydrateOnboarding();
    await refresh();
    setResumeMessage(null);
    setStep(2);
  }

  async function saveOffering() {
    const servicePackage = servicePackages[0];
    const categoryId = setup.categoryId || servicePackage?.categoryId || categories[0]?.id || '';
    const title = servicePackage?.title.trim() || '';
    const priceFrom = Number((servicePackage?.priceFrom || '').replace(/[^\d]/g, ''));

    if (!categoryId || !title || !priceFrom) {
      throw new Error('Enter your main service name and starting price.');
    }

    if (priceFrom < 500) {
      throw new Error('Guide price must be at least ₦500.');
    }

    const alreadyExists = offerings.some(
      (offering) =>
        offering.categoryId === categoryId &&
        offering.title.trim().toLowerCase() === title.toLowerCase() &&
        offering.priceFrom === priceFrom
    );

    if (!alreadyExists) {
      await api('/offerings', {
        method: 'POST',
        token,
        body: JSON.stringify({
          categoryId,
          title,
          description: servicePackage?.description.trim() || undefined,
          priceFrom,
        }),
      });
    }

    await refresh();
    setResumeMessage(null);
    setStep(3);
  }

  async function uploadPortfolioFile(file: File, displayOrder: number) {
    const validationError = validateImageFileForPick(file);
    if (validationError) {
      throw new Error(validationError);
    }

    setUploadingPortfolio(true);
    try {
      await ensureArtisanProfileForUpload();
      await uploadPortfolioImage(token, file, displayOrder);
      await hydrateOnboarding();
    } finally {
      setUploadingPortfolio(false);
    }
  }

  async function uploadPortfolioFiles(files: File[]) {
    if (!files.length) return;

    const remainingSlots = Math.max(0, 12 - portfolioImages.length);
    const selectedFiles = files.slice(0, remainingSlots);

    if (!selectedFiles.length) {
      throw new Error('You can upload up to 12 portfolio images.');
    }

    for (const [index, file] of selectedFiles.entries()) {
      await uploadPortfolioFile(file, portfolioImages.length + index);
    }
  }

  async function removePortfolioImage(imageId: string) {
    await api(`/artisans/portfolio-images/${imageId}`, {
      method: 'DELETE',
      token,
    });
    await hydrateOnboarding();
  }

  async function saveAvailabilityAndContinue() {
    if (!selectedDays.length) {
      throw new Error('Select at least one day you are available.');
    }

    await Promise.all(
      selectedDays
        .filter(
          (dayOfWeek) =>
            !availabilitySlots.some(
              (slot) =>
                slot.dayOfWeek === dayOfWeek && slot.startTime === startTime && slot.endTime === endTime
            )
        )
        .map((dayOfWeek) =>
          api('/artisans/availability-slots', {
            method: 'POST',
            token,
            body: JSON.stringify({ dayOfWeek, startTime, endTime }),
          })
        )
    );

    await hydrateOnboarding();
    setResumeMessage(null);
    setSetupSubPhase('verification');
  }

  async function submitKycVerification() {
    if (!kycDocumentFile) {
      throw new Error('Please upload a photo of your NIN slip or ID before submitting.');
    }

    const documentImageUrl = await uploadKycImage(token, kycDocumentFile);

    const validation = validateKycForm({
      legalName: setup.fullName || displayName,
      documentType: 'NIN',
      documentNumber: setup.documentNumber,
      address: setup.address || setup.location,
    });

    if (!validation.ok) {
      throw new Error(validation.message);
    }

    const response = await api<{ submission: ArtisanKycSubmission }>('/artisans/kyc', {
      method: 'POST',
      token,
      body: JSON.stringify({
        legalName: validation.legalName,
        documentType: validation.documentType,
        documentNumber: validation.documentNumber,
        documentImageUrl,
        address: validation.address,
        city: setup.location,
      }),
    });

    setKycSubmission(response.submission);
    setForceSetup(false);
    if (me?.firebaseUid) {
      markArtisanApplicantSubmitted(me.firebaseUid);
    }
    await hydrateOnboarding();
    await refresh();
  }

  async function useCurrentLocation() {
    await runAction(async () => {
      const result = await readBrowserLocation();
      if (!result.ok) {
        throw new Error(
          locationErrorMessage(result.reason, { permissionGranted: result.permissionGranted })
        );
      }

      const state = inferNigeriaState(result.lat, result.lng);
      const selection = artisanLocationFromGps(state, result.lat, result.lng);
      setSetup((current) => ({
        ...current,
        location: selection.state,
        area: selection.area,
        locationId: selection.locationId,
        locationLabel: selection.locationLabel,
        lat: String(selection.lat),
        lng: String(selection.lng),
      }));
    }, 'Location updated');
  }

  function saveAndExit() {
    window.location.assign('/');
  }

  function backToGoLiveFromVerification() {
    setSetupSubPhase('wizard');
    setStep(3);
  }

  return {
    displayName,
    accountEmail,
    phase,
    step,
    setStep,
    setupSubPhase,
    progressPercent,
    resumeMessage,
    busy,
    runAction,
    categories,
    setup,
    updateSetup,
    applyCatalogLocation,
    agreed,
    setAgreed,
    servicePackages,
    updateServicePackage,
    portfolioImages,
    uploadingPortfolio,
    uploadPortfolioFile,
    uploadPortfolioFiles,
    removePortfolioImage,
    selectedDays,
    setSelectedDays,
    startTime,
    setStartTime,
    endTime,
    setEndTime,
    kycDocumentFile,
    setKycDocumentFile,
    submitAgreed,
    setSubmitAgreed,
    kycSubmission,
    profile,
    saveBasicInfo,
    saveOffering,
    saveAvailabilityAndContinue,
    submitKycVerification,
    openSetupEditor,
    useCurrentLocation,
    saveAndExit,
    backToGoLiveFromVerification,
    token,
  };
}
