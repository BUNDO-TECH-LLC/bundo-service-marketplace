import { useEffect, useState } from 'react';
import { api } from '../../../lib/api';
import { artisanVerificationPhase } from '../../../lib/artisanVerification';
import { locationErrorMessage, readBrowserLocation } from '../../../lib/geolocation';
import { inferNigeriaState } from '../../../lib/inferNigeriaState';
import { uploadKycImage } from '../../../lib/kycUpload';
import { uploadPortfolioImage } from '../../../lib/portfolioUpload';
import type {
  Artisan,
  ArtisanKycSubmission,
  AvailabilitySlot,
  PortfolioImage,
} from '../../../types';
import type { ArtisanLandingModel, ArtisanLandingProps } from './artisanLandingTypes';

export function useArtisanLanding({
  token,
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
  const [uploadingPortfolio, setUploadingPortfolio] = useState(false);
  const [kycDocumentFile, setKycDocumentFile] = useState<File | null>(null);
  const [setup, setSetup] = useState({
    fullName: firebaseUser?.displayName || '',
    businessName: '',
    categoryId: '',
    location: 'Lagos',
    area: '',
    lat: '6.5244',
    lng: '3.3792',
    title: 'Basic inspection',
    priceFrom: '',
    description: '',
    documentNumber: '',
    address: 'Lagos',
  });
  const [servicePackages, setServicePackages] = useState([
    {
      localId: 'package-1',
      categoryId: '',
      title: 'Basic inspection',
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
  const accountEmail = firebaseUser?.email || null;
  const verificationPhase = artisanVerificationPhase({ profile, kycStatus, hydrated });
  const phase =
    forceSetup && (verificationPhase === 'rejected' || verificationPhase === 'changes_requested')
      ? 'setup'
      : verificationPhase;

  function openSetupEditor() {
    setForceSetup(true);
    setStep(4);
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
        setProfile(nextProfile);
        setPortfolioImages(imageResponse.images);
        setAvailabilitySlots(slotResponse.slots);
        setKycSubmission(kycResponse.submission);
        setSetup((current) => ({
          ...current,
          fullName: current.fullName || nextProfile?.displayName || firebaseUser?.displayName || '',
          businessName: nextProfile?.displayName || current.businessName,
          location: nextProfile?.city || current.location,
          area: nextProfile?.area || current.area,
          lat: String(nextProfile?.lat ?? current.lat),
          lng: String(nextProfile?.lng ?? current.lng),
          address: kycResponse.submission?.address || current.address,
          documentNumber: kycResponse.submission?.documentNumber || current.documentNumber,
        }));
      })
      .finally(() => {
        if (mounted) {
          setHydrated(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, [firebaseUser, token]);

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
      setup.businessName.trim() ||
      setup.fullName.trim() ||
      firebaseUser?.displayName?.trim() ||
      'Artisan';

    await api('/artisans/profile', {
      method: 'POST',
      token,
      body: JSON.stringify({
        displayName: profileDisplayName,
        bio: categories.find((category) => category.id === setup.categoryId)?.name || 'Bundo artisan',
        city: setup.location.trim() || 'Lagos',
        area: setup.area.trim() || undefined,
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

  function addServicePackage() {
    setServicePackages((current) => [
      ...current,
      {
        localId: `package-${Date.now()}`,
        categoryId: setup.categoryId,
        title: '',
        priceFrom: '',
        description: '',
      },
    ]);
  }

  function removeServicePackage(localId: string) {
    setServicePackages((current) =>
      current.length === 1 ? current : current.filter((servicePackage) => servicePackage.localId !== localId)
    );
  }

  async function saveBasicInfo() {
    await api('/artisans/profile', {
      method: profile ? 'PATCH' : 'POST',
      token,
      body: JSON.stringify({
        displayName: setup.businessName.trim() || setup.fullName.trim(),
        bio: categories.find((category) => category.id === setup.categoryId)?.name || 'Bundo artisan',
        city: setup.location.trim(),
        area: setup.area.trim(),
        lat: Number(setup.lat),
        lng: Number(setup.lng),
      }),
    });
    await hydrateOnboarding();
    await refresh();
    setStep(2);
  }

  async function saveOffering() {
    const packagesToSave = servicePackages
      .map((servicePackage) => ({
        ...servicePackage,
        categoryId: servicePackage.categoryId || setup.categoryId || categories[0]?.id || '',
        title: servicePackage.title.trim(),
        description: servicePackage.description.trim(),
        priceFrom: Number(servicePackage.priceFrom.replace(/[^\d]/g, '')),
      }))
      .filter((servicePackage) => servicePackage.categoryId && servicePackage.title && servicePackage.priceFrom > 0);

    if (!packagesToSave.length) {
      throw new Error('Add at least one service package with a category, name, and price.');
    }

    const minGuidePrice = 500;
    if (packagesToSave.some((servicePackage) => servicePackage.priceFrom < minGuidePrice)) {
      throw new Error(
        `Each guide price must be at least ₦${minGuidePrice.toLocaleString('en-NG')}.`
      );
    }

    for (const servicePackage of packagesToSave) {
      const alreadyExists = offerings.some(
        (offering) =>
          offering.categoryId === servicePackage.categoryId &&
          offering.title.trim().toLowerCase() === servicePackage.title.toLowerCase() &&
          offering.priceFrom === servicePackage.priceFrom
      );

      if (alreadyExists) continue;

      await api('/offerings', {
        method: 'POST',
        token,
        body: JSON.stringify({
          categoryId: servicePackage.categoryId,
          title: servicePackage.title,
          description: servicePackage.description || undefined,
          priceFrom: servicePackage.priceFrom,
        }),
      });
    }

    await refresh();
    setStep(3);
  }

  async function uploadPortfolioFile(file: File, displayOrder: number) {
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

  async function submitForVerification() {
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

    if (!kycDocumentFile) {
      throw new Error('Please upload a photo of your ID document before submitting.');
    }

    const documentImageUrl = await uploadKycImage(token, kycDocumentFile);

    const response = await api<{ submission: ArtisanKycSubmission }>('/artisans/kyc', {
      method: 'POST',
      token,
      body: JSON.stringify({
        legalName: setup.fullName || displayName,
        documentType: 'NIN',
        documentNumber: setup.documentNumber,
        documentImageUrl,
        address: setup.address || setup.location,
        city: setup.location,
      }),
    });
    setKycSubmission(response.submission);
    setForceSetup(false);
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
      setSetup((current) => ({
        ...current,
        location: state,
        lat: String(result.lat),
        lng: String(result.lng),
      }));
    }, 'Location updated');
  }

  return {
    displayName,
    accountEmail,
    phase,
    step,
    setStep,
    busy,
    runAction,
    categories,
    setup,
    updateSetup,
    agreed,
    setAgreed,
    servicePackages,
    updateServicePackage,
    addServicePackage,
    removeServicePackage,
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
    submitForVerification,
    openSetupEditor,
    useCurrentLocation,
  };
}
