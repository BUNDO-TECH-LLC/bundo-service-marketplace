import { FormEvent, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { signOut, User } from 'firebase/auth';
import type { ActionRunner, BookingSuccessState, MarketplaceSort } from '../appTypes';
import { EmptyState } from '../components/EmptyState';
import { StatCard } from '../components/StatCard';
import { api } from '../lib/api';
import { bookingDate } from '../lib/bookingDisplay';
import { auth, firebaseReady } from '../lib/firebase';
import { dayLabels, money } from '../lib/formatting';
import { nigeriaStates } from '../lib/geo';
import { heroImage } from '../lib/marketingAssets';
import {
  ApiUser,
  Artisan,
  ArtisanKycSubmission,
  AvailabilitySlot,
  Booking,
  Category,
  CloudinarySignedUpload,
  Notification,
  Offering,
  PortfolioImage,
  PayoutBank,
  ProviderPayoutAccount,
  Review,
  Role,
} from '../types';
import bundoLogo from '../assets/bundo-logo.png';
import { artisanVerificationPhase } from '../lib/artisanVerification';
import { ArtisanPendingApproval } from '../views/ArtisanPendingApproval';
import { ArtisanSetupShell } from '../views/ArtisanSetupShell';

export function ArtisanAppHeader({
  displayName,
  active,
  onDashboard,
  onJobs,
  onMessages,
  onReviews,
  onProfile,
  onSignOut,
}: {
  displayName: string;
  active: 'Dashboard' | 'Jobs' | 'Messages' | 'Reviews';
  onDashboard: () => void;
  onJobs: () => void;
  onMessages: () => void;
  onReviews: () => void;
  onProfile: () => void;
  onSignOut?: () => void;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const firstName = displayName.split(' ')[0];
  const initial = displayName.slice(0, 1).toUpperCase();

  const navItems = [
    ['Dashboard', onDashboard],
    ['Jobs', onJobs],
    ['Messages', onMessages],
    ['Reviews', onReviews],
  ] as const;

  const closeMobileNav = () => setMobileNavOpen(false);

  const runNav = (action: () => void) => {
    closeMobileNav();
    action();
  };

  useEffect(() => {
    if (!mobileNavOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMobileNav();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileNavOpen]);

  return (
    <header
      className={`artisan-app-header ${mobileNavOpen ? 'artisan-app-header--nav-open' : ''}`}
    >
      <button type="button" className="brand" onClick={() => runNav(onDashboard)}>
        <img className="brand-logo" src={bundoLogo} alt="Bundo logo" />
        <span>Bundo</span>
      </button>

      <div className="artisan-header-collapse" id="artisan-header-mobile-panel">
        <nav aria-label="Artisan navigation">
          {navItems.map(([label, action]) => (
            <button
              key={label}
              type="button"
              className={active === label ? 'active' : ''}
              onClick={() => runNav(action)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="artisan-header-mobile-actions">
          <button type="button" className="secondary-button" onClick={() => runNav(onProfile)}>
            Profile
          </button>
          {onSignOut && (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                closeMobileNav();
                onSignOut();
              }}
            >
              Log out
            </button>
          )}
        </div>
      </div>

      <div className="artisan-header-end">
        <button
          type="button"
          className="artisan-header-menu-toggle"
          aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileNavOpen}
          aria-controls="artisan-header-mobile-panel"
          onClick={() => setMobileNavOpen((open) => !open)}
        >
          <span className="artisan-header-menu-toggle-bars" aria-hidden="true" />
        </button>
        <div className="artisan-header-actions artisan-header-actions--desktop">
          <button type="button" className="secondary-button" onClick={onProfile}>
            Profile
          </button>
          {onSignOut && (
            <button type="button" className="text-button" onClick={onSignOut}>
              Log out
            </button>
          )}
        </div>
        <button type="button" className="artisan-user-chip" onClick={() => runNav(onProfile)}>
          <span>{initial}</span>
          <span className="artisan-user-chip-name">{firstName}</span>
        </button>
      </div>

      {mobileNavOpen && (
        <button
          type="button"
          className="artisan-header-mobile-backdrop"
          aria-label="Close menu"
          onClick={closeMobileNav}
        />
      )}
    </header>
  );
}

export function ArtisanLanding({
  token,
  categories,
  offerings,
  bookings,
  firebaseUser,
  busy,
  runAction,
  refresh,
  openBookings,
  openMessages,
  openReviews,
  openProfile,
}: {
  token: string;
  categories: Category[];
  offerings: Offering[];
  bookings: Booking[];
  firebaseUser: User | null;
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
  openBookings: () => void;
  openMessages: () => void;
  openReviews: () => void;
  openProfile: () => void;
}) {
  const [profile, setProfile] = useState<Artisan | null>(null);
  const [portfolioImages, setPortfolioImages] = useState<PortfolioImage[]>([]);
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([]);
  const [kycSubmission, setKycSubmission] = useState<ArtisanKycSubmission | null>(null);
  const [step, setStep] = useState(1);
  const [uploadingPortfolio, setUploadingPortfolio] = useState(false);
  const [setup, setSetup] = useState({
    fullName: firebaseUser?.displayName || '',
    businessName: '',
    categoryId: '',
    location: 'Lagos',
    area: 'Lekki',
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

  async function hydrateOnboarding() {
    const [profileResponse, imageResponse, slotResponse, kycResponse] = await Promise.all([
      api<{ profile: Artisan }>('/artisans/me', { token }).catch(() => ({ profile: null as unknown as Artisan })),
      api<{ images: PortfolioImage[] }>('/artisans/portfolio-images/me', { token }).catch(() => ({ images: [] })),
      api<{ slots: AvailabilitySlot[] }>('/artisans/availability-slots/me', { token }).catch(() => ({ slots: [] })),
      api<{ submission: ArtisanKycSubmission | null }>('/artisans/kyc', { token }),
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
        servicePackage.localId === localId
          ? { ...servicePackage, [field]: value }
          : servicePackage
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
      current.length === 1
        ? current
        : current.filter((servicePackage) => servicePackage.localId !== localId)
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
    if (!file.type.startsWith('image/')) {
      throw new Error('Please choose an image file.');
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Each image must be 5MB or smaller.');
    }

    setUploadingPortfolio(true);
    try {
      const signatureResponse = await api<{ upload: CloudinarySignedUpload }>(
        '/artisans/portfolio-images/sign-upload',
        { method: 'POST', token }
      );
      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', signatureResponse.upload.apiKey);
      formData.append('timestamp', String(signatureResponse.upload.timestamp));
      formData.append('folder', signatureResponse.upload.folder);
      formData.append('signature', signatureResponse.upload.signature);

      const uploadResponse = await fetch(
        `https://api.cloudinary.com/v1_1/${signatureResponse.upload.cloudName}/image/upload`,
        { method: 'POST', body: formData }
      );
      const uploadData = await uploadResponse.json();

      if (!uploadResponse.ok) {
        throw new Error(uploadData?.error?.message || 'Could not upload image');
      }

      await api('/artisans/portfolio-images', {
        method: 'POST',
        token,
        body: JSON.stringify({
          cloudinaryId: uploadData.public_id,
          url: uploadData.secure_url,
          displayOrder,
        }),
      });
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

  async function submitForVerification() {
    await Promise.all(
      selectedDays
        .filter(
          (dayOfWeek) =>
            !availabilitySlots.some(
              (slot) =>
                slot.dayOfWeek === dayOfWeek &&
                slot.startTime === startTime &&
                slot.endTime === endTime
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

    const response = await api<{ submission: ArtisanKycSubmission }>('/artisans/kyc', {
      method: 'POST',
      token,
      body: JSON.stringify({
        legalName: setup.fullName || displayName,
        documentType: 'NIN',
        documentNumber: setup.documentNumber,
        documentImageUrl: `pending-manual-review:${setup.documentNumber}`,
        address: setup.address || setup.location,
        city: setup.location,
      }),
    });
    setKycSubmission(response.submission);
    setForceSetup(false);
    await hydrateOnboarding();
    await refresh();
  }

  if (phase === 'loading') {
    return (
      <ArtisanSetupShell displayName={displayName} email={accountEmail}>
        <main className="artisan-setup-page">
          <EmptyState
            title="Loading your profile"
            body="Checking your verification status and setup progress."
          />
        </main>
      </ArtisanSetupShell>
    );
  }

  if (phase === 'awaiting_approval') {
    return (
      <ArtisanSetupShell displayName={displayName} email={accountEmail}>
        <ArtisanPendingApproval profile={profile} kycSubmission={kycSubmission} />
      </ArtisanSetupShell>
    );
  }

  if (phase === 'changes_requested') {
    return (
      <ArtisanSetupShell displayName={displayName} email={accountEmail}>
        <ArtisanPendingApproval
          profile={profile}
          kycSubmission={kycSubmission}
          variant="changes_requested"
          onEditSubmission={openSetupEditor}
        />
      </ArtisanSetupShell>
    );
  }

  if (phase === 'rejected') {
    return (
      <ArtisanSetupShell displayName={displayName} email={accountEmail}>
        <ArtisanPendingApproval
          profile={profile}
          kycSubmission={kycSubmission}
          variant="rejected"
          onEditSubmission={openSetupEditor}
        />
      </ArtisanSetupShell>
    );
  }

  if (phase === 'approved') {
    const requestedBookings = bookings.filter((booking) => booking.status === 'REQUESTED');
    const activeBookings = bookings.filter((booking) =>
      ['ACCEPTED', 'ONGOING', 'COMPLETED'].includes(booking.status)
    );

    return (
      <>
      <ArtisanAppHeader
        displayName={displayName}
        active="Dashboard"
        onDashboard={() => undefined}
        onJobs={openBookings}
        onMessages={openMessages}
        onReviews={openReviews}
        onProfile={openProfile}
        onSignOut={() => {
          if (auth) {
            void signOut(auth);
          }
        }}
      />
      <main className="artisan-dashboard-page">
        <section className="artisan-dashboard-hero">
          <h1>Good morning, {displayName.split(' ')[0]}</h1>
          <div className="artisan-stat-grid">
            <StatCard label="Total bookings" value={bookings.length} hint="All time" />
            <StatCard label="Ratings" value={`${profile?.avgRating || 0}/5.0`} hint={`${profile?.ratingCount || 0} reviews`} />
            <StatCard label="Active jobs" value={activeBookings.length} hint="This week" />
            <StatCard label="New requests" value={requestedBookings.length} hint="Needs your response" />
          </div>
        </section>

        <section className="artisan-dashboard-grid">
          <div className="artisan-request-stack">
            <div className="logged-section-head">
              <h2>New Requests</h2>
              <button type="button" onClick={openBookings}>view all</button>
            </div>
            {requestedBookings.length === 0 && <EmptyState title="No new requests" body="New booking requests will appear here." />}
            {requestedBookings.slice(0, 2).map((booking) => (
              <article className="artisan-request-card" key={booking.id}>
                <span className="recommended-avatar">{(booking.customerUser?.email || 'C').slice(0, 1).toUpperCase()}</span>
                <div>
                  <h3>{booking.customerUser?.email?.split('@')[0] || 'Customer'}</h3>
                  <small>{booking.offering?.title || 'Service request'}</small>
                  <p>{bookingDate(booking.scheduledAt)} · {booking.artisan?.area || profile?.area || 'Lagos'}</p>
                  <div className="actions">
                    <button className="secondary-button" disabled={busy}>Decline</button>
                    <button disabled={busy}>Accept</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <aside className="artisan-side-stack">
            <article className="artisan-soft-card">
              <div className="logged-section-head">
                <h2>Availability</h2>
                <button type="button" onClick={() => setStep(4)}>Edit</button>
              </div>
              <div className="availability-dots">
                {dayLabels.slice(1).concat(dayLabels[0]).map((day, index) => {
                  const dayIndex = index === 6 ? 0 : index + 1;
                  return (
                    <span key={day} className={availabilitySlots.some((slot) => slot.dayOfWeek === dayIndex) ? 'active' : ''}>
                      {day.slice(0, 1)}
                    </span>
                  );
                })}
              </div>
            </article>
            <article className="artisan-soft-card">
              <h2>This week</h2>
              <dl className="summary-list">
                <div><dt>Jobs Completed</dt><dd>{bookings.filter((booking) => booking.status === 'COMPLETED').length}</dd></div>
                <div><dt>Jobs Upcoming</dt><dd>{activeBookings.length}</dd></div>
                <div><dt>Earnings</dt><dd>{money(0)}</dd></div>
              </dl>
            </article>
            <article className="artisan-soft-card quick-links">
              <h2>Quick links</h2>
              <button onClick={() => setStep(4)}>Update availability</button>
              <button onClick={() => setStep(2)}>Edit pricing</button>
              <button onClick={openBookings}>View jobs</button>
            </article>
          </aside>
        </section>
      </main>
      </>
    );
  }

  return (
    <ArtisanSetupShell displayName={displayName} email={accountEmail}>
    <main className="artisan-setup-page">
      <section className="artisan-setup-head">
        <div>
          <h1>Set up your artisan profile</h1>
          <p className="muted">Follow the steps below. Your profile goes live only after KYC and admin approval.</p>
        </div>
        <strong>Step {step} of 4</strong>
      </section>

      <div className="artisan-stepper" aria-label="Artisan setup steps">
        {[
          { id: 'basic', label: 'Basic info', shortLabel: 'Basic' },
          { id: 'pricing', label: 'Services & pricing', shortLabel: 'Pricing' },
          { id: 'portfolio', label: 'Portfolio', shortLabel: 'Photos' },
          { id: 'submit', label: 'Availability & submit', shortLabel: 'Submit' },
        ].map((stepItem, index) => {
          const number = index + 1;
          return (
            <button
              key={stepItem.id}
              type="button"
              className={number <= step ? 'active' : ''}
              onClick={() => setStep(number)}
              aria-current={number === step ? 'step' : undefined}
            >
              <span className="artisan-stepper-num">{number}</span>
              <span className="artisan-stepper-label">{stepItem.label}</span>
              <span className="artisan-stepper-label-short">{stepItem.shortLabel}</span>
            </button>
          );
        })}
      </div>

      {kycSubmission && (
        <div className={`payment-note artisan-review-note ${kycSubmission.status === 'APPROVED' ? 'success' : ''}`}>
          <strong>KYC status: {kycSubmission.status.toLowerCase().replace(/_/g, ' ')}</strong>
          <span>{kycSubmission.reviewNote || 'Admin will review your profile before it appears publicly.'}</span>
        </div>
      )}

      {step === 1 && (
        <section className="artisan-setup-card">
          <h2>Basic Information</h2>
          <p>Tell us a bit about yourself so customers can find and trust you.</p>
          <label>Full Name<span>*</span><input value={setup.fullName} onChange={(event) => updateSetup('fullName', event.target.value)} placeholder="Enter your name" required /></label>
          <small>As in any legal documentation</small>
          <label>Business Name<span>(Optional)</span><input value={setup.businessName} onChange={(event) => updateSetup('businessName', event.target.value)} placeholder="e.g Plumber, Hair stylist...etc" /></label>
          <small>Leave blank to use your full name</small>
          <label>Service Category<span>(Required)</span>
            <select value={setup.categoryId} onChange={(event) => updateSetup('categoryId', event.target.value)} required>
              <option value="">Select a category</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          <small>E.g Plumbing, Carpentry, Make-up Artist</small>
          <label>Location<span>(Required)</span><input value={setup.location} onChange={(event) => updateSetup('location', event.target.value)} placeholder="Search for your city or area" required /></label>
          <button className="location-link" type="button">⌖ Use your current location</button>
          <label className="terms-row"><input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} /> <span>By continuing, you agree to our Terms of Service and Privacy Policy.</span></label>
        </section>
      )}

      {step === 2 && (
        <section className="artisan-setup-card wide">
          <h2>Set your pricing</h2>
          <p>Give customers a clear idea of what to expect before they book. You can update this any time.</p>
          <div className="setup-package-stack">
            {servicePackages.map((servicePackage, index) => (
              <article className="setup-package-card" key={servicePackage.localId}>
                <div className="setup-package-head">
                  <h3>Package {index + 1}</h3>
                  {servicePackages.length > 1 && (
                    <button type="button" onClick={() => removeServicePackage(servicePackage.localId)}>
                      Remove
                    </button>
                  )}
                </div>
                <label>
                  Primary Service
                  <select
                    value={servicePackage.categoryId || setup.categoryId}
                    onChange={(event) => updateServicePackage(servicePackage.localId, 'categoryId', event.target.value)}
                    required
                  >
                    <option value="">Select a category</option>
                    {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                </label>
                <div className="setup-two-col">
                  <label>
                    Service name
                    <input
                      value={servicePackage.title}
                      onChange={(event) => updateServicePackage(servicePackage.localId, 'title', event.target.value)}
                      placeholder="Basic inspection"
                      required
                    />
                  </label>
                  <label>
                    Price(₦)
                    <input
                      value={servicePackage.priceFrom}
                      onChange={(event) => updateServicePackage(servicePackage.localId, 'priceFrom', event.target.value)}
                      placeholder="5,000"
                      inputMode="numeric"
                      required
                    />
                  </label>
                </div>
                <label>
                  Description
                  <textarea
                    value={servicePackage.description}
                    onChange={(event) => updateServicePackage(servicePackage.localId, 'description', event.target.value)}
                    placeholder="Diagnosis and minor fixes"
                  />
                </label>
              </article>
            ))}
          </div>
          <p className="orange-note">Packages help customers understand your offering upfront. You can still negotiate pricing directly with customers after a booking request is made.</p>
          <button type="button" className="full-orange" onClick={addServicePackage}>＋ Add another Package</button>
        </section>
      )}

      {step === 3 && (
        <section className="artisan-setup-card media-step">
          <h2>Add your photos</h2>
          <p>A great profile photo and strong portfolio help customers choose you with confidence.</p>
          <label className="profile-upload">
            <span>Upload a photo <small>JPG or PNG · Max 5MB · Square crop recommended</small></span>
            <strong>Choose file</strong>
            <input type="file" accept="image/*" multiple disabled={busy || uploadingPortfolio} onChange={(event) => {
              const files = Array.from(event.target.files || []);
              if (!files.length) return;
              void runAction(() => uploadPortfolioFiles(files), files.length > 1 ? 'Photos uploaded' : 'Photo uploaded');
              event.currentTarget.value = '';
            }} />
          </label>
          <h3>Portfolio images</h3>
          <small>Show customers examples of your past work. Upload up to 12 photos.</small>
          <div className="setup-portfolio-grid">
            <label className="portfolio-upload-tile">
              <span>⇧</span>
              Upload a photo
              <input type="file" accept="image/*" multiple disabled={busy || uploadingPortfolio || portfolioImages.length >= 12} onChange={(event) => {
                const files = Array.from(event.target.files || []);
                if (!files.length) return;
                void runAction(() => uploadPortfolioFiles(files), files.length > 1 ? 'Portfolio images uploaded' : 'Portfolio image uploaded');
                event.currentTarget.value = '';
              }} />
            </label>
            {portfolioImages.slice(0, 11).map((image) => <img key={image.id} src={image.url} alt="Portfolio" />)}
            {Array.from({ length: Math.max(0, 11 - portfolioImages.length) }).map((_, index) => <div className="portfolio-placeholder" key={index}>▧</div>)}
          </div>
          <p className="muted">Artisans with 6+ portfolio photos get up to 3x more booking requests.</p>
        </section>
      )}

      {step === 4 && (
        <section className="artisan-setup-card availability-step">
          <h2>When are you available?</h2>
          <p>Customers will only be able to book you on days and times you select. You can update this anytime from your dashboard.</p>
          <h3>Days available</h3>
          <div className="day-picker">
            {[1, 2, 3, 4, 5, 6, 0].map((day) => (
              <button
                key={day}
                type="button"
                className={selectedDays.includes(day) ? 'active' : ''}
                onClick={() => setSelectedDays((current) => current.includes(day) ? current.filter((value) => value !== day) : [...current, day])}
              >
                {dayLabels[day].slice(0, 1)}
              </button>
            ))}
          </div>
          <div className="setup-two-col">
            <label>From<input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label>
            <label>To<input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} /></label>
          </div>
          <label>Residential address<input value={setup.address} onChange={(event) => updateSetup('address', event.target.value)} placeholder="Address for manual verification" /></label>
          <label>NIN or ID number<input value={setup.documentNumber} onChange={(event) => updateSetup('documentNumber', event.target.value)} placeholder="Required for verification" /></label>
          <label className="terms-row"><input type="checkbox" checked={submitAgreed} onChange={(event) => setSubmitAgreed(event.target.checked)} /> <span>Submitting for verification means our team will review your profile before it goes live.</span></label>
        </section>
      )}

      <div className="artisan-setup-actions">
        <button type="button" className="secondary-button" onClick={() => setStep((current) => Math.max(1, current - 1))}>{step === 1 ? 'Back' : 'Skip'}</button>
        {step === 1 && <button disabled={busy || !agreed || !setup.fullName || !setup.categoryId || !setup.location} onClick={() => runAction(saveBasicInfo, 'Basic profile saved')}>Next</button>}
        {step === 2 && <button disabled={busy || !servicePackages.some((servicePackage) => servicePackage.title.trim() && servicePackage.priceFrom.trim())} onClick={() => runAction(saveOffering, servicePackages.length > 1 ? 'Service packages saved' : 'Service package saved')}>Next</button>}
        {step === 3 && <button disabled={busy || uploadingPortfolio} onClick={() => setStep(4)}>Next</button>}
        {step === 4 && <button disabled={busy || !submitAgreed || !setup.documentNumber || selectedDays.length === 0} onClick={() => runAction(submitForVerification, 'Application submitted — awaiting approval')}>Submit for verification</button>}
      </div>
    </main>
    </ArtisanSetupShell>
  );
}



export function Hero({
  selectedState,
  states,
  onStateChange,
  searchTerm,
  onSearchTermChange,
  onSearch,
  onBrowse,
}: {
  selectedState: string;
  states: string[];
  onStateChange: (state: string) => Promise<void>;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onSearch: (state: string, queryText: string) => Promise<void>;
  onBrowse: () => void;
}) {
  async function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSearch(selectedState, searchTerm);
  }

  return (
    <section className="hero">
      <div className="hero-media">
        <img src={heroImage} alt="Professional cleaning a bright home" />
      </div>
      <div className="hero-copy">
        <p className="eyebrow">BUNDO MARKETPLACE</p>
        <h1>Quality home services, on demand</h1>
        <p>Experienced professionals for the work that keeps daily life moving.</p>
        <form className="hero-search" onSubmit={submitSearch}>
          <div className="search-heading">
            <label htmlFor="service-state">Where do you need a service?</label>
            <span>Find trusted help near you</span>
          </div>
          <div className="location-control">
            <div className="field-shell">
              <span>Location</span>
              <select
                id="service-state"
                value={selectedState}
                onChange={(event) => onStateChange(event.target.value)}
              >
                <option value="">Select your state</option>
                {states.map((state) => (
                  <option key={state} value={state}>{state}</option>
                ))}
              </select>
            </div>
            <div className="field-shell">
              <span>Service</span>
              <input
                value={searchTerm}
                onChange={(event) => onSearchTermChange(event.target.value)}
                placeholder="Cleaning, baking, repairs"
                type="search"
              />
            </div>
            <button type="submit">
              Search
            </button>
          </div>
          <button className="browse-link" type="button" onClick={onBrowse}>
            Browse all services
          </button>
        </form>
      </div>
    </section>
  );
}

export function WhySection() {
  return (
    <section className="why">
      <div className="why-inner">
        <div className="why-copy">
          <h2>Why Bundo?</h2>
          <p className="why-intro">
            We believe in quality over quantity. Every professional on our platform undergoes a rigorous
            multi-step verification process to ensure your peace of mind.
          </p>
          <ul className="why-features">
            <li className="why-feature">
              <span className="why-feature-icon" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </span>
              <div>
                <h3>Verified Professionals</h3>
                <p>Background checks and skills assessment for every artisan.</p>
              </div>
            </li>
            <li className="why-feature">
              <span className="why-feature-icon" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
                  <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
                </svg>
              </span>
              <div>
                <h3>Secure Payments</h3>
                <p>Escrow-based payments that release only when the job is done.</p>
              </div>
            </li>
            <li className="why-feature">
              <span className="why-feature-icon" aria-hidden>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
                </svg>
              </span>
              <div>
                <h3>24/7 Priority Support</h3>
                <p>A dedicated concierge team to handle any requests or issues.</p>
              </div>
            </li>
          </ul>
        </div>
        <div className="why-visual" aria-hidden>
          <div className="why-visual-panel">
            <div className="why-float why-float-profile">
              <svg className="why-float-profile-user" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span className="why-float-profile-badge">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </span>
            </div>
            <div className="why-float why-float-shield">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </div>
            <div className="why-float why-float-message">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
                <path d="m13 7-4 5h4l-1 5" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

const curatedCategoryCards: {
  matchSlugs: string[];
  title: string;
  description: string;
  icon: ReactNode;
}[] = [
  {
    matchSlugs: ['plumbing', 'plumber', 'plumbers'],
    title: 'Plumbing',
    description: 'Leaking pipes, installations, and repairs.',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    ),
  },
  {
    matchSlugs: ['electrical', 'electrician', 'electric'],
    title: 'Electrical',
    description: 'Wiring, lighting, and smart home setup.',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 22v-4" />
        <path d="M9 12V7a3 3 0 0 1 6 0v5" />
        <rect x="5" y="12" width="14" height="8" rx="2" />
        <path d="M10 12V9" />
        <path d="M14 12V9" />
      </svg>
    ),
  },
  {
    matchSlugs: ['cleaning', 'cleaners', 'housekeeping'],
    title: 'Cleaning',
    description: 'Deep cleans and regular maintenance.',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="m16 22-1-4" />
        <path d="M19 13.99a1 1 0 0 0 .5-.866l-1-8a1 1 0 0 0-1.99.132L16 10" />
        <path d="m4.5 9.5-1 8a1 1 0 0 0 .5.866" />
        <path d="M8 18h8" />
        <path d="M12 18V2l4 4-4 4-4-4 4-4v16" />
      </svg>
    ),
  },
  {
    matchSlugs: ['carpentry', 'carpenter', 'woodwork', 'woodworking'],
    title: 'Carpentry',
    description: 'Custom furniture and structural woodwork.',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="m3 21 9-9" />
        <path d="m12 3 9 9-2 2-9-9" />
        <path d="M9 12l-6 6" />
        <path d="M14 7l3 3" />
      </svg>
    ),
  },
  {
    matchSlugs: ['painting', 'painter', 'paint'],
    title: 'Painting',
    description: 'Interior and exterior premium finishes.',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M18.37 2.63 14 7l-1.59-1.59a2 2 0 0 0-2.82 0L8 7l9 9 1.59-1.59a2 2 0 0 0 0-2.82L17 10l4.37-4.37a2.12 2.12 0 1 0-3-3Z" />
        <path d="M9 8c-2 3-4 3.5-7 4l11 11c.5-3 .5-5-1-7" />
        <path d="M14.5 17.5 4 7" />
      </svg>
    ),
  },
  {
    matchSlugs: ['gardening', 'garden', 'landscaping', 'landscape'],
    title: 'Gardening',
    description: 'Landscape design and garden care.',
    icon: (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 22c-4-3-6-6-6-9a6 6 0 0 1 12 0c0 3-2 6-6 9" />
        <path d="M12 13V8" />
        <path d="M9 10h6" />
        <circle cx="12" cy="5" r="2" />
      </svg>
    ),
  },
];

function resolveCuratedCategory(categories: Category[], matchSlugs: string[]): Category | undefined {
  const lowered = matchSlugs.map((s) => s.toLowerCase());
  return categories.find((c) => {
    const slug = c.slug.toLowerCase();
    if (lowered.includes(slug)) return true;
    const nameSlug = c.name.toLowerCase().trim().replace(/\s+/g, '-');
    return lowered.includes(nameSlug);
  });
}

export function ServicesSection({
  categories,
  onBrowse,
}: {
  categories: Category[];
  onBrowse: (categoryId?: string) => void | Promise<void>;
}) {
  return (
    <section className="services services-curated">
      <div className="section-title-row services-curated-title-row">
        <div className="services-curated-head">
          <h2>Curated Categories</h2>
          <p className="services-curated-sub">Specialists for every corner of your residence.</p>
        </div>
        <button type="button" className="services-explore-all" onClick={() => void onBrowse()}>
          Explore All <span aria-hidden>→</span>
        </button>
      </div>
      <div className="services-curated-grid">
        {curatedCategoryCards.map((row) => {
          const matched = resolveCuratedCategory(categories, row.matchSlugs);
          return (
            <button
              key={row.title}
              type="button"
              className="services-category-card"
              onClick={() => void onBrowse(matched?.id)}
            >
              <span className="services-category-icon-tile" aria-hidden>
                {row.icon}
              </span>
              <span className="services-category-card-title">{row.title}</span>
              <span className="services-category-card-desc">{row.description}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function BookingSuccessDialog({
  booking,
  onClose,
  onGoToMessages,
}: {
  booking: BookingSuccessState;
  onClose: () => void;
  onGoToMessages: () => void;
}) {
  return (
    <div className="success-overlay" role="presentation" onClick={onClose}>
      <section
        className="booking-success-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-success-title"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="success-mark" aria-hidden="true">✓</span>
        <p className="eyebrow">Booking request sent</p>
        <h2 id="booking-success-title">Your request is with {booking.artisanName}</h2>
        <p>
          We created a booking for {booking.serviceTitle}. You can message the artisan now,
          or continue browsing while the request stays active.
        </p>
        {booking.bookingId && <small>Booking #{booking.bookingId.slice(0, 8)}</small>}
        <div className="booking-success-actions">
          <button type="button" onClick={onGoToMessages}>Go to messages</button>
          <button type="button" className="secondary-button" onClick={onClose}>Continue browsing</button>
        </div>
      </section>
    </div>
  );
}

export function MarketplaceFilters({
  categories,
  selectedState,
  states,
  searchTerm,
  selectedCategoryId,
  priceMin,
  priceMax,
  sort,
  onSelectedStateChange,
  onSearchTermChange,
  onCategoryChange,
  onPriceMinChange,
  onPriceMaxChange,
  onSortChange,
  onApply,
  onClear,
}: {
  categories: Category[];
  selectedState: string;
  states: string[];
  searchTerm: string;
  selectedCategoryId: string;
  priceMin: string;
  priceMax: string;
  sort: MarketplaceSort;
  onSelectedStateChange: (value: string) => void;
  onSearchTermChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onPriceMinChange: (value: string) => void;
  onPriceMaxChange: (value: string) => void;
  onSortChange: (value: MarketplaceSort) => void;
  onApply: () => Promise<void>;
  onClear: () => Promise<void>;
}) {
  return (
    <section className="marketplace-filters">
      <div className="section-title-row">
        <div>
          <p className="eyebrow">Refine results</p>
          <h2>Search with more control</h2>
        </div>
      </div>
      <div className="marketplace-filter-grid">
        <label>
          State
          <select value={selectedState} onChange={(event) => onSelectedStateChange(event.target.value)}>
            <option value="">All states</option>
            {states.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </label>
        <label>
          Category
          <select value={selectedCategoryId} onChange={(event) => onCategoryChange(event.target.value)}>
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Search
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            placeholder="Artisan, service, category"
          />
        </label>
        <label>
          Min price
          <input type="number" min="0" value={priceMin} onChange={(event) => onPriceMinChange(event.target.value)} placeholder="5000" />
        </label>
        <label>
          Max price
          <input type="number" min="0" value={priceMax} onChange={(event) => onPriceMaxChange(event.target.value)} placeholder="50000" />
        </label>
        <label>
          Sort by
          <select value={sort} onChange={(event) => onSortChange(event.target.value as MarketplaceSort)}>
            <option value="rating">Top rated</option>
            <option value="newest">Newest</option>
            <option value="price_low">Lowest price</option>
            <option value="price_high">Highest price</option>
          </select>
        </label>
      </div>
      <div className="marketplace-filter-actions">
        <button onClick={() => void onApply()}>Apply filters</button>
        <button className="secondary-button" onClick={() => void onClear()}>
          Clear
        </button>
      </div>
    </section>
  );
}

export function MarketplacePreview({ offerings, onBrowse }: { offerings: Offering[]; onBrowse: () => void }) {
  return (
    <section className="preview-band">
      <div className="section-title-row">
        <div>
          <p className="eyebrow">Marketplace</p>
          <h2>Ready to book</h2>
        </div>
        <button onClick={onBrowse}>Open marketplace</button>
      </div>
      <div className="grid three">
        {offerings.slice(0, 3).map((offering) => (
          <article className="service-card" key={offering.id}>
            <p className="pill">{offering.category?.name || 'Service'}</p>
            <h3>{offering.title}</h3>
            <p>{offering.artisan?.displayName || 'Approved artisan'}</p>
            <p className="price">{money(offering.priceFrom)}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function OfferingGrid({
  offerings,
  isAuthed,
  role,
  token,
  busy,
  runAction,
  reloadPrivate,
  onViewProfile,
  onBookingSuccess,
}: {
  offerings: Offering[];
  isAuthed: boolean;
  role: Role | null;
  token: string;
  busy: boolean;
  runAction: ActionRunner;
  reloadPrivate: () => Promise<void>;
  onViewProfile: (artisanId: string) => Promise<void>;
  onBookingSuccess: (booking: BookingSuccessState) => void;
}) {
  const [activeOfferingAction, setActiveOfferingAction] = useState<string | null>(null);

  async function runOfferingAction(actionKey: string, action: () => Promise<void>, done: string) {
    setActiveOfferingAction(actionKey);

    try {
      await runAction(action, done);
    } finally {
      setActiveOfferingAction(null);
    }
  }

  return (
    <div className="grid two">
      {offerings.length === 0 && <EmptyState title="No services yet" body="Approved artisan offerings will appear here." />}
      {offerings.map((offering) => {
        const bookActionKey = `book:${offering.id}`;
        const messageActionKey = `message:${offering.id}`;
        const viewActionKey = `view:${offering.artisan?.id || offering.id}`;
        const isBookingThisOffering = activeOfferingAction === bookActionKey;
        const isMessagingThisOffering = activeOfferingAction === messageActionKey;
        const isViewingThisArtisan = activeOfferingAction === viewActionKey;

        return (
          <article className="service-card" key={offering.id}>
            <div className="card-topline">
              <p className="pill">{offering.category?.name || 'Service'}</p>
              <span>{offering.artisan?.city || 'Nearby'}</span>
            </div>
            <h3>{offering.title}</h3>
            <p>{offering.description || 'Professional home service'}</p>
            <p className="price">
              {money(offering.priceFrom)}
              {offering.priceTo ? ` - ${money(offering.priceTo)}` : ''}
            </p>
            <p className="muted">{offering.artisan?.displayName || 'Approved artisan'} · {offering.artisan?.area || 'Bundo'}</p>
            <div className="actions">
              <button
                className="secondary-button"
                disabled={!offering.artisan?.id || isViewingThisArtisan}
                onClick={() =>
                  offering.artisan?.id &&
                  void runOfferingAction(
                    viewActionKey,
                    () => onViewProfile(offering.artisan!.id),
                    'Artisan profile loaded'
                  )
                }
              >
                {isViewingThisArtisan ? 'Opening...' : 'View profile'}
              </button>
              <button
                disabled={!isAuthed || role !== 'CUSTOMER' || isBookingThisOffering}
                onClick={() =>
                  void runOfferingAction(
                    bookActionKey,
                    async () => {
                      const response = await api<{ booking: Booking }>('/bookings', {
                        method: 'POST',
                        token,
                        body: JSON.stringify({
                          offeringId: offering.id,
                          scheduledAt: new Date(Date.now() + 86400000).toISOString(),
                          note: 'Booked from web client',
                        }),
                      });
                      await reloadPrivate();
                      onBookingSuccess({
                        bookingId: response.booking.id,
                        serviceTitle: offering.title,
                        artisanName: offering.artisan?.displayName || 'this artisan',
                      });
                    },
                    'Booking requested'
                  )
                }
              >
                {isBookingThisOffering ? 'Booking...' : 'Book'}
              </button>
              <button
                className="secondary-button"
                disabled={!isAuthed || !offering.artisan?.id || isMessagingThisOffering}
                onClick={() =>
                  void runOfferingAction(
                    messageActionKey,
                    async () => {
                      await api('/messages', {
                        method: 'POST',
                        token,
                        body: JSON.stringify({
                          artisanId: offering.artisan!.id,
                          body: 'Hello, I am interested in this service.',
                        }),
                      });
                      await reloadPrivate();
                    },
                    'Message sent'
                  )
                }
              >
                {isMessagingThisOffering ? 'Sending...' : 'Message'}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}



export function AppPromo() {
  return (
    <section className="app-promo" aria-labelledby="app-promo-quote">
      <div className="app-promo-inner">
        <div className="app-promo-quote-wrap">
          <span className="app-promo-quote-icon" aria-hidden>
            <svg width="36" height="28" viewBox="0 0 36 28" fill="none">
              <path
                d="M4 18c0-6 4-10 10-10V4C6 4 0 10 0 18v6h14v-6H4Zm22 0c0-6 4-10 10-10V4c-8 0-14 6-14 14v6h14v-6H26Z"
                fill="currentColor"
              />
            </svg>
          </span>
          <blockquote className="app-promo-quote" id="app-promo-quote">
            Bundo changed how I manage my home maintenance. Finding a reliable electrician used to take days;
            now it&apos;s done in minutes with total peace of mind.
          </blockquote>
          <div className="app-promo-byline">
            <span className="app-promo-avatar" aria-hidden>
              AO
            </span>
            <div className="app-promo-cite">
              <span className="app-promo-name">Adaeze Okafor</span>
              <span className="app-promo-role">Homeowner in Lagos</span>
            </div>
          </div>
        </div>
        <hr className="app-promo-divider" />
        <div className="app-promo-stats">
          <div className="app-promo-stat">
            <span className="app-promo-stat-value">5,000+</span>
            <span className="app-promo-stat-label">Vetted artisans</span>
          </div>
          <div className="app-promo-stat">
            <span className="app-promo-stat-value">50,000+</span>
            <span className="app-promo-stat-label">Homes transformed</span>
          </div>
          <div className="app-promo-stat">
            <span className="app-promo-stat-value">4.9/5</span>
            <span className="app-promo-stat-label">Trust score</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Footer({
  onOpenHelpTopic,
}: {
  onOpenHelpTopic: (topicId: string) => void;
}) {
  const cities = ['Lagos', 'Abuja', 'Port Harcourt', 'Ibadan', 'Kano', 'Enugu', 'Uyo', 'Benin City'];
  const footerTopics = [
    ['About us', 'getting-started'],
    ['Payments', 'payments'],
    ['Disputes', 'disputes'],
    ['Cancellations', 'cancellations'],
    ['Provider standards', 'artisan-standards'],
    ['Privacy', 'privacy'],
    ['Quick links', 'support'],
  ] as const;

  return (
    <footer>
      <div className="footer-links">
        {footerTopics.map(([label, topicId]) => (
          <button key={label} type="button" onClick={() => onOpenHelpTopic(topicId)}>
            {label}
          </button>
        ))}
      </div>
      <h4>Currently live in</h4>
      <div className="city-list">{cities.map((city) => <span key={city}>{city}</span>)}</div>
      <div className="footer-bottom">
        <img className="brand-logo" src={bundoLogo} alt="Bundo logo" />
        <span>Bundo</span>
        <small>© 2026 Bundo Marketplace</small>
      </div>
    </footer>
  );
}



export function AccountSettingsPanel({
  token,
  me,
  busy,
  runAction,
  refresh,
}: {
  token: string;
  me: ApiUser;
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
}) {
  const canApplyAsArtisan = me.role !== 'ARTISAN' && me.role !== 'ADMIN';

  return (
    <article className="panel-card">
      <p className="eyebrow">Profile settings</p>
      <h2>Account type</h2>
      <p>
        Current account: <strong>{me.role ? me.role.toLowerCase() : 'not selected'}</strong>
      </p>
      {me.role === 'ARTISAN' ? (
        <p className="muted">
          Artisan access is controlled by KYC and admin approval. Complete verification
          before listing services.
        </p>
      ) : me.role === 'ADMIN' ? (
        <p className="muted">Admin access is managed from the admin console.</p>
      ) : (
        <p className="muted">
          Client accounts can apply to become artisans. Listing services remains locked
          until profile setup, KYC, and admin approval are complete.
        </p>
      )}
      {canApplyAsArtisan && (
        <div className="actions">
          {!me.role && (
            <button
              disabled={busy}
              onClick={() =>
                runAction(async () => {
                  await api('/users/role', {
                    method: 'PATCH',
                    token,
                    body: JSON.stringify({ role: 'CUSTOMER' }),
                  });
                  await refresh();
                }, 'Client account selected')
              }
            >
              Continue as client
            </button>
          )}
          <button
            disabled={busy}
            onClick={() =>
              runAction(async () => {
                await api('/users/role', {
                  method: 'PATCH',
                  token,
                  body: JSON.stringify({ role: 'ARTISAN' }),
                });
                await refresh();
              }, 'Artisan application started')
            }
          >
            Apply as artisan
          </button>
        </div>
      )}
    </article>
  );
}

export function ArtisanReviewsPanel({ token }: { token: string }) {
  const [profile, setProfile] = useState<Artisan | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);

  useEffect(() => {
    let mounted = true;
    api<{ profile: Artisan }>('/artisans/me', { token })
      .then(async (profileResponse) => {
        const reviewResponse = await api<{ reviews: Review[] }>(`/artisans/${profileResponse.profile.id}/reviews`);
        if (!mounted) return;
        setProfile(profileResponse.profile);
        setReviews(reviewResponse.reviews);
      })
      .catch(() => {
        if (!mounted) return;
        setProfile(null);
        setReviews([]);
      });
    return () => {
      mounted = false;
    };
  }, [token]);

  const average = profile?.avgRating || 0;

  return (
    <section className="artisan-reviews-page">
      <h2>Reviews</h2>
      <div className="reviews-summary">
        <div className="reviews-score">
          <strong>{average.toFixed(1)}</strong>
          <span>★★★★★</span>
          <p>{reviews.length ? 'Based on customer reviews' : 'No reviews yet'}</p>
        </div>
        <div className="reviews-bars">
          {[5, 4, 3, 2, 1].map((rating) => {
            const count = reviews.filter((review) => review.rating === rating).length;
            const percent = reviews.length ? (count / reviews.length) * 100 : 0;
            return (
              <div key={rating}>
                <span>{rating} Stars</span>
                <i><b style={{ width: `${percent}%` }} /></i>
                <small>{count}</small>
              </div>
            );
          })}
        </div>
      </div>
      <div className="reviews-list">
        {reviews.length === 0 && <EmptyState title="No reviews yet" body="Reviews from completed jobs will appear here." />}
        {reviews.map((review) => (
          <article className="review-card artisan-review-card" key={review.id}>
            <div className="review-head">
              <span className="recommended-avatar">{(review.customer?.email || 'C').slice(0, 1).toUpperCase()}</span>
              <div>
                <strong>{review.customer?.email?.split('@')[0] || 'Customer'}</strong>
                <span className="verified-hire">Verified hire</span>
                <p>{'★'.repeat(review.rating)} <small>{bookingDate(review.createdAt)}</small></p>
              </div>
            </div>
            <p>{review.comment || 'Customer left a rating for this completed job.'}</p>
            <small>JOB: {review.booking?.offering?.title || 'Service booking'}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ArtisanProfileSettings({
  token,
  firebaseUser,
  busy,
  runAction,
  refresh,
}: {
  token: string;
  firebaseUser: User | null;
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
}) {
  const [profile, setProfile] = useState<Artisan | null>(null);
  const [payoutAccount, setPayoutAccount] = useState<ProviderPayoutAccount | null>(null);
  const [banks, setBanks] = useState<PayoutBank[]>([]);
  const [kycSubmission, setKycSubmission] = useState<ArtisanKycSubmission | null>(null);
  const kycStatus = kycSubmission?.status ?? 'NOT_SUBMITTED';
  const approved = profile?.verifyStatus === 'APPROVED' && kycStatus === 'APPROVED';

  useEffect(() => {
    let mounted = true;
    Promise.all([
      api<{ profile: Artisan }>('/artisans/me', { token }).catch(() => ({ profile: null as unknown as Artisan })),
      api<{ account: ProviderPayoutAccount | null }>('/artisans/payout-account', { token }),
      api<{ banks: PayoutBank[] }>('/payments/banks', { token }),
      api<{ submission: ArtisanKycSubmission | null }>('/artisans/kyc', { token }).catch(() => ({ submission: null })),
    ])
      .then(([profileResponse, accountResponse, bankResponse, kycResponse]) => {
        if (!mounted) return;
        setProfile(profileResponse.profile || null);
        setPayoutAccount(accountResponse.account);
        setBanks(bankResponse.banks);
        setKycSubmission(kycResponse.submission);
      })
      .catch(() => {
        if (!mounted) return;
        setProfile(null);
        setPayoutAccount(null);
        setBanks([]);
        setKycSubmission(null);
      });
    return () => {
      mounted = false;
    };
  }, [token]);

  async function hydrateSettings() {
    const [profileResponse, accountResponse, kycResponse] = await Promise.all([
      api<{ profile: Artisan }>('/artisans/me', { token }).catch(() => ({ profile: null as unknown as Artisan })),
      api<{ account: ProviderPayoutAccount | null }>('/artisans/payout-account', { token }),
      api<{ submission: ArtisanKycSubmission | null }>('/artisans/kyc', { token }).catch(() => ({ submission: null })),
    ]);
    setProfile(profileResponse.profile || null);
    setPayoutAccount(accountResponse.account);
    setKycSubmission(kycResponse.submission);
  }

  async function saveProfile(formElement: HTMLFormElement) {
    const form = new FormData(formElement);
    await api('/artisans/profile', {
      method: profile ? 'PATCH' : 'POST',
      token,
      body: JSON.stringify({
        displayName: form.get('displayName'),
        bio: profile?.bio || 'Bundo artisan',
        city: form.get('city'),
        area: form.get('area'),
        lat: profile?.lat ?? 6.5244,
        lng: profile?.lng ?? 3.3792,
      }),
    });
    const response = await api<{ profile: Artisan }>('/artisans/me', { token });
    setProfile(response.profile);
    await refresh();
  }

  async function submitKyc(formElement: HTMLFormElement) {
    const form = new FormData(formElement);
    const response = await api<{ submission: ArtisanKycSubmission }>('/artisans/kyc', {
      method: 'POST',
      token,
      body: JSON.stringify({
        legalName: form.get('legalName'),
        documentType: form.get('documentType'),
        documentNumber: form.get('documentNumber'),
        documentImageUrl: form.get('documentImageUrl'),
        selfieImageUrl: form.get('selfieImageUrl') || undefined,
        address: form.get('address'),
        city: form.get('city'),
      }),
    });
    setKycSubmission(response.submission);
    await refresh();
  }

  async function savePayoutAccount(formElement: HTMLFormElement) {
    const form = new FormData(formElement);
    const selectedBank = banks.find(
      (bank) => bank.code === String(form.get('bankCode') || '')
    );
    const response = await api<{ account: ProviderPayoutAccount }>('/artisans/payout-account', {
      method: 'POST',
      token,
      body: JSON.stringify({
        bankCode: form.get('bankCode'),
        bankName: selectedBank?.name,
        accountNumber: form.get('accountNumber'),
        accountName: form.get('accountName'),
      }),
    });
    setPayoutAccount(response.account);
    await hydrateSettings();
  }

  return (
    <section className="artisan-profile-settings-page">
      <aside className="artisan-settings-sidebar">
        <span className="recommended-avatar large">{(profile?.displayName || 'A').slice(0, 1).toUpperCase()}</span>
        <h2>{profile?.displayName || 'Your profile'}</h2>
        <p>@{(firebaseUser?.email || 'artisan').split('@')[0]}</p>
        <span className={`booking-status ${approved ? 'completed' : 'pending'}`}>
          {approved ? 'Approved' : kycStatus.toLowerCase().replace(/_/g, ' ')}
        </span>
        <button>Edit Profile</button>
        {['Your Profile', 'KYC verification', 'Bank information', 'Business information', 'Job history', 'Service and pricing', 'Settings', 'Notifications'].map((item, index) => (
          <span className={index === 0 ? 'active' : ''} key={item}>{item}</span>
        ))}
        <button className="danger-outline">Log out</button>
      </aside>

      <div className="artisan-settings-stack">
        <form
          className="artisan-settings-card"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            runAction(() => saveProfile(form), 'Profile saved');
          }}
        >
          <h2>Edit Personal Information</h2>
          <p>Update the public profile details customers see on Bundo.</p>
          <div className="profile-picture-row">
            <span className="recommended-avatar large">{(profile?.displayName || 'A').slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>Profile Picture</strong>
              <p>JPG, GIF or PNG. Max size of 800K</p>
              <button type="button" className="text-button">Upload new</button>
            </div>
          </div>
          <label>Full Name<input name="displayName" defaultValue={profile?.displayName || ''} required /></label>
          <label>Email Address<input defaultValue={firebaseUser?.email || ''} disabled /></label>
          <label>Phone Number<input placeholder="+234" disabled /></label>
          <label>Location<input name="city" defaultValue={profile?.city || 'Lagos'} required /></label>
          <label>Area<input name="area" defaultValue={profile?.area || ''} /></label>
          <div className="settings-actions">
            <button type="button" className="secondary-button">Cancel</button>
            <button disabled={busy}>Save Changes</button>
          </div>
        </form>

        <form
          className="artisan-settings-card"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            runAction(() => submitKyc(form), 'KYC submission saved');
          }}
        >
          <h2>KYC verification</h2>
          <p>Identity details stay in settings and are reviewed by admin before your profile is fully approved.</p>
          {kycSubmission && (
            <div className={`payment-note ${kycSubmission.status === 'APPROVED' ? 'success' : ''}`}>
              <strong>KYC status: {kycSubmission.status.toLowerCase().replace(/_/g, ' ')}</strong>
              <span>{kycSubmission.reviewNote || 'Admin will review your submission.'}</span>
            </div>
          )}
          <label>Legal Name<input name="legalName" defaultValue={kycSubmission?.legalName || ''} required /></label>
          <label>Document Type
            <select name="documentType" defaultValue={kycSubmission?.documentType || 'NIN'} required>
              <option value="NIN">NIN</option>
              <option value="BVN">BVN</option>
              <option value="DRIVERS_LICENSE">Driver's license</option>
              <option value="INTERNATIONAL_PASSPORT">International passport</option>
            </select>
          </label>
          <label>Document Number<input name="documentNumber" defaultValue={kycSubmission?.documentNumber || ''} required /></label>
          <label>Document Image URL<input name="documentImageUrl" defaultValue={kycSubmission?.documentImageUrl || ''} required /></label>
          <label>Selfie Image URL<input name="selfieImageUrl" defaultValue={kycSubmission?.selfieImageUrl || ''} /></label>
          <label>Residential Address<input name="address" defaultValue={kycSubmission?.address || ''} required /></label>
          <label>City<input name="city" defaultValue={kycSubmission?.city || profile?.city || 'Lagos'} required /></label>
          <button disabled={busy}>Save KYC details</button>
        </form>

        <form
          className="artisan-settings-card"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            runAction(() => savePayoutAccount(form), 'Payout account saved');
          }}
        >
          <h2>Bank information</h2>
          <p>Add the Nigerian bank account where approved completed-service payouts should be sent.</p>
          {payoutAccount && (
            <div className="payment-note success">
              <strong>{payoutAccount.accountName || 'Saved payout account'}</strong>
              <span>
                {payoutAccount.bankName || payoutAccount.bankCode} · ****{payoutAccount.accountNumber.slice(-4)}
              </span>
            </div>
          )}
          <label>Bank
            <select name="bankCode" defaultValue={payoutAccount?.bankCode || ''} required>
              <option value="" disabled>Select bank</option>
              {banks.map((bank) => (
                <option key={bank.code} value={bank.code}>
                  {bank.name}
                </option>
              ))}
            </select>
          </label>
          <label>Account Number<input name="accountNumber" defaultValue={payoutAccount?.accountNumber || ''} required /></label>
          <label>Account Name<input name="accountName" defaultValue={payoutAccount?.accountName || ''} /></label>
          <button disabled={busy}>Save bank information</button>
        </form>
      </div>
    </section>
  );
}

export function ArtisanOffersPanel({
  token,
  categories,
  offerings,
  busy,
  runAction,
  refresh,
}: {
  token: string;
  categories: ReactNode[];
  offerings: Offering[];
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
}) {
  const [profile, setProfile] = useState<Artisan | null>(null);
  const [kycSubmission, setKycSubmission] = useState<ArtisanKycSubmission | null>(null);
  const kycStatus = kycSubmission?.status ?? 'NOT_SUBMITTED';
  const artisanApproved = profile?.verifyStatus === 'APPROVED' && kycStatus === 'APPROVED';
  const reviewMessage = !profile
    ? 'Create your artisan profile in Profile settings before listing services.'
    : kycStatus === 'APPROVED' && profile.verifyStatus !== 'APPROVED'
      ? 'Your KYC is approved. Admin approval for your artisan profile is still pending.'
      : kycStatus === 'APPROVED'
        ? 'Your artisan account is approved. Add service offers that match your profile.'
        : 'Service offers unlock after KYC and admin approval.';

  useEffect(() => {
    let mounted = true;
    Promise.all([
      api<{ profile: Artisan }>('/artisans/me', { token }).catch(() => ({ profile: null as unknown as Artisan })),
      api<{ submission: ArtisanKycSubmission | null }>('/artisans/kyc', { token }).catch(() => ({ submission: null })),
    ]).then(([profileResponse, kycResponse]) => {
      if (!mounted) return;
      setProfile(profileResponse.profile || null);
      setKycSubmission(kycResponse.submission);
    });
    return () => {
      mounted = false;
    };
  }, [token]);

  async function createOffering(formElement: HTMLFormElement) {
    const form = new FormData(formElement);
    await api('/offerings', {
      method: 'POST',
      token,
      body: JSON.stringify({
        categoryId: form.get('categoryId'),
        title: form.get('title'),
        description: form.get('description'),
        priceFrom: Number(form.get('priceFrom')),
        priceTo: form.get('priceTo') ? Number(form.get('priceTo')) : undefined,
      }),
    });
    await refresh();
    formElement.reset();
  }

  return (
    <>
      <section className="section-head compact">
        <p className="eyebrow">Services</p>
        <h1>Service offers</h1>
        <p>{reviewMessage}</p>
      </section>

      {!artisanApproved && (
        <article className="panel-card locked-card">
          <p className="eyebrow">Locked until approval</p>
          <h2>Offer creation is not available yet</h2>
          <div className="approval-steps">
            <span className={profile ? 'complete' : ''}>Profile</span>
            <span className={kycStatus !== 'NOT_SUBMITTED' ? 'complete' : ''}>KYC submitted</span>
            <span className={kycStatus === 'APPROVED' ? 'complete' : ''}>KYC approved</span>
            <span className={profile?.verifyStatus === 'APPROVED' ? 'complete' : ''}>Admin approved</span>
          </div>
        </article>
      )}

      {artisanApproved && (
        <form
          className="panel-card form-card"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            runAction(() => createOffering(form), 'Offering created');
          }}
        >
          <p className="eyebrow">Create offer</p>
          <h2>Add a service package</h2>
          <select name="categoryId" required>{categories}</select>
          <input name="title" placeholder="Service title" required />
          <input name="description" placeholder="Description" />
          <input name="priceFrom" placeholder="Price from" required />
          <input name="priceTo" placeholder="Price to" />
          <button disabled={busy}>Create offering</button>
        </form>
      )}

      <article className="panel-card">
        <p className="eyebrow">Services</p>
        <h2>My offerings</h2>
        {offerings.length === 0 && <p>No offerings created yet.</p>}
        {offerings.map((offering) => (
          <div className="list-item" key={offering.id}>
            <strong>{offering.title}</strong>
            <span>
              {money(offering.priceFrom)}
              {offering.category?.name ? ` · ${offering.category.name}` : ''}
            </span>
          </div>
        ))}
      </article>
    </>
  );
}

export function ArtisanPanel({
  token,
  categories,
  offerings,
  busy,
  runAction,
  refresh,
}: {
  token: string;
  categories: ReactNode[];
  offerings: Offering[];
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
}) {
  const [profile, setProfile] = useState<Artisan | null>(null);
  const [portfolioImages, setPortfolioImages] = useState<PortfolioImage[]>([]);
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([]);
  const [payoutAccount, setPayoutAccount] = useState<ProviderPayoutAccount | null>(null);
  const [banks, setBanks] = useState<PayoutBank[]>([]);
  const [kycSubmission, setKycSubmission] = useState<ArtisanKycSubmission | null>(null);
  const [uploadingPortfolio, setUploadingPortfolio] = useState(false);
  const kycStatus = kycSubmission?.status ?? 'NOT_SUBMITTED';
  const artisanApproved =
    profile?.verifyStatus === 'APPROVED' && kycStatus === 'APPROVED';
  const reviewMessage = !profile
    ? 'Create your artisan profile first, then submit KYC for admin review.'
    : kycStatus === 'NOT_SUBMITTED'
      ? 'Submit KYC so admin can verify your identity before you list services.'
      : kycStatus === 'APPROVED' && profile.verifyStatus !== 'APPROVED'
        ? 'Your KYC is approved. Admin approval for your artisan profile is still pending.'
        : kycStatus === 'APPROVED'
          ? 'Your artisan account is approved. You can now create offers for matching categories.'
          : kycStatus === 'REJECTED'
            ? 'Your KYC was rejected. Review the admin note, update your details, and resubmit.'
            : kycStatus === 'CHANGES_REQUESTED'
              ? 'Admin requested changes. Update your KYC details and resubmit for review.'
              : 'Your KYC is under admin review. Offer creation unlocks after approval.';

  useEffect(() => {
    let mounted = true;

    Promise.all([
      api<{ profile: Artisan }>('/artisans/me', { token }).catch(() => ({ profile: null as unknown as Artisan })),
      api<{ images: PortfolioImage[] }>('/artisans/portfolio-images/me', { token }).catch(() => ({ images: [] })),
      api<{ slots: AvailabilitySlot[] }>('/artisans/availability-slots/me', { token }).catch(() => ({ slots: [] })),
      api<{ account: ProviderPayoutAccount | null }>('/artisans/payout-account', { token }),
      api<{ banks: PayoutBank[] }>('/payments/banks', { token }),
      api<{ submission: ArtisanKycSubmission | null }>('/artisans/kyc', { token }),
    ])
      .then(([profileResponse, imageResponse, slotResponse, accountResponse, bankResponse, kycResponse]) => {
        if (!mounted) return;
        setProfile(profileResponse.profile || null);
        setPortfolioImages(imageResponse.images);
        setAvailabilitySlots(slotResponse.slots);
        setPayoutAccount(accountResponse.account);
        setBanks(bankResponse.banks);
        setKycSubmission(kycResponse.submission);
      })
      .catch(() => {
        if (!mounted) return;
        setProfile(null);
        setPortfolioImages([]);
        setAvailabilitySlots([]);
        setPayoutAccount(null);
        setBanks([]);
        setKycSubmission(null);
      });

    return () => {
      mounted = false;
    };
  }, [token]);

  async function hydrateWorkspace() {
    const [profileResponse, imageResponse, slotResponse, accountResponse, kycResponse] = await Promise.all([
      api<{ profile: Artisan }>('/artisans/me', { token }).catch(() => ({ profile: null as unknown as Artisan })),
      api<{ images: PortfolioImage[] }>('/artisans/portfolio-images/me', { token }).catch(() => ({ images: [] })),
      api<{ slots: AvailabilitySlot[] }>('/artisans/availability-slots/me', { token }).catch(() => ({ slots: [] })),
      api<{ account: ProviderPayoutAccount | null }>('/artisans/payout-account', { token }),
      api<{ submission: ArtisanKycSubmission | null }>('/artisans/kyc', { token }),
    ]);

    setProfile(profileResponse.profile || null);
    setPortfolioImages(imageResponse.images);
    setAvailabilitySlots(slotResponse.slots);
    setPayoutAccount(accountResponse.account);
    setKycSubmission(kycResponse.submission);
  }

  async function createProfile(formElement: HTMLFormElement) {
    const form = new FormData(formElement);
    await api('/artisans/profile', {
      method: profile ? 'PATCH' : 'POST',
      token,
      body: JSON.stringify({
        displayName: form.get('displayName'),
        bio: form.get('bio'),
        city: form.get('city'),
        area: form.get('area'),
        lat: Number(form.get('lat')),
        lng: Number(form.get('lng')),
      }),
    });
    await refresh();
    await hydrateWorkspace();
  }

  async function savePayoutAccount(formElement: HTMLFormElement) {
    const form = new FormData(formElement);
    const selectedBank = banks.find(
      (bank) => bank.code === String(form.get('bankCode') || '')
    );
    const response = await api<{ account: ProviderPayoutAccount }>('/artisans/payout-account', {
      method: 'POST',
      token,
      body: JSON.stringify({
        bankCode: form.get('bankCode'),
        bankName: selectedBank?.name,
        accountNumber: form.get('accountNumber'),
        accountName: form.get('accountName'),
      }),
    });
    setPayoutAccount(response.account);
  }

  async function createOffering(formElement: HTMLFormElement) {
    const form = new FormData(formElement);
    await api('/offerings', {
      method: 'POST',
      token,
      body: JSON.stringify({
        categoryId: form.get('categoryId'),
        title: form.get('title'),
        description: form.get('description'),
        priceFrom: Number(form.get('priceFrom')),
        priceTo: form.get('priceTo') ? Number(form.get('priceTo')) : undefined,
      }),
    });
    await refresh();
    formElement.reset();
  }

  async function addAvailability(formElement: HTMLFormElement) {
    const form = new FormData(formElement);
    await api('/artisans/availability-slots', {
      method: 'POST',
      token,
      body: JSON.stringify({
        dayOfWeek: Number(form.get('dayOfWeek')),
        startTime: form.get('startTime'),
        endTime: form.get('endTime'),
      }),
    });
    await hydrateWorkspace();
    formElement.reset();
  }

  async function toggleAvailability(slot: AvailabilitySlot) {
    await api(`/artisans/availability-slots/${slot.id}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({
        isActive: !slot.isActive,
      }),
    });
    await hydrateWorkspace();
  }

  async function removeAvailability(slotId: string) {
    await api(`/artisans/availability-slots/${slotId}`, {
      method: 'DELETE',
      token,
    });
    await hydrateWorkspace();
  }

  async function uploadPortfolioFile(file: File) {
    if (!file.type.startsWith('image/')) {
      throw new Error('Please choose an image file.');
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new Error('Each image must be 5MB or smaller.');
    }

    setUploadingPortfolio(true);

    try {
      const signatureResponse = await api<{ upload: CloudinarySignedUpload }>(
        '/artisans/portfolio-images/sign-upload',
        {
          method: 'POST',
          token,
        }
      );

      const formData = new FormData();
      formData.append('file', file);
      formData.append('api_key', signatureResponse.upload.apiKey);
      formData.append('timestamp', String(signatureResponse.upload.timestamp));
      formData.append('folder', signatureResponse.upload.folder);
      formData.append('signature', signatureResponse.upload.signature);

      const uploadResponse = await fetch(
        `https://api.cloudinary.com/v1_1/${signatureResponse.upload.cloudName}/image/upload`,
        {
          method: 'POST',
          body: formData,
        }
      );

      const uploadData = await uploadResponse.json();

      if (!uploadResponse.ok) {
        throw new Error(uploadData?.error?.message || 'Could not upload image');
      }

      await api('/artisans/portfolio-images', {
        method: 'POST',
        token,
        body: JSON.stringify({
          cloudinaryId: uploadData.public_id,
          url: uploadData.secure_url,
          displayOrder: portfolioImages.length,
        }),
      });

      await hydrateWorkspace();
    } finally {
      setUploadingPortfolio(false);
    }
  }

  async function removePortfolioImage(imageId: string) {
    await api(`/artisans/portfolio-images/${imageId}`, {
      method: 'DELETE',
      token,
    });
    await hydrateWorkspace();
  }

  async function submitKyc(formElement: HTMLFormElement) {
    const form = new FormData(formElement);
    const response = await api<{ submission: ArtisanKycSubmission }>('/artisans/kyc', {
      method: 'POST',
      token,
      body: JSON.stringify({
        legalName: form.get('legalName'),
        documentType: form.get('documentType'),
        documentNumber: form.get('documentNumber'),
        documentImageUrl: form.get('documentImageUrl'),
        selfieImageUrl: form.get('selfieImageUrl') || undefined,
        address: form.get('address'),
        city: form.get('city'),
      }),
    });
    setKycSubmission(response.submission);
  }

  return (
    <>
      <form
        className="panel-card form-card"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          runAction(() => createProfile(form), 'Artisan profile saved');
        }}
      >
        <p className="eyebrow">Onboarding</p>
        <h2>Artisan profile</h2>
        <input name="displayName" placeholder="Display name" defaultValue={profile?.displayName || ''} required />
        <input name="bio" placeholder="Bio" defaultValue={profile?.bio || ''} />
        <input name="city" placeholder="City" defaultValue={profile?.city || 'Lagos'} required />
        <input name="area" placeholder="Area" defaultValue={profile?.area || 'Lekki'} />
        <input name="lat" placeholder="Latitude" defaultValue={profile?.lat ?? '6.5244'} required />
        <input name="lng" placeholder="Longitude" defaultValue={profile?.lng ?? '3.3792'} required />
        <button disabled={busy}>{profile ? 'Update profile' : 'Save profile'}</button>
      </form>
      <form
        className="panel-card form-card"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          runAction(() => submitKyc(form), 'KYC submission saved');
        }}
      >
        <p className="eyebrow">Compliance</p>
        <h2>KYC submission</h2>
        <p>
          Submit your identity details so Bundo can review your artisan account before broader rollout.
        </p>
        {kycSubmission && (
          <div className={`payment-note ${kycSubmission.status === 'APPROVED' ? 'success' : ''}`}>
            <strong>KYC status: {kycSubmission.status.toLowerCase().replace(/_/g, ' ')}</strong>
            <span>
              {kycSubmission.reviewNote
                ? kycSubmission.reviewNote
                : 'We will update you once the review is complete.'}
            </span>
          </div>
        )}
        <input
          name="legalName"
          placeholder="Legal name"
          defaultValue={kycSubmission?.legalName || ''}
          required
        />
        <select name="documentType" defaultValue={kycSubmission?.documentType || 'NIN'} required>
          <option value="NIN">NIN</option>
          <option value="BVN">BVN</option>
          <option value="DRIVERS_LICENSE">Driver's license</option>
          <option value="INTERNATIONAL_PASSPORT">International passport</option>
        </select>
        <input
          name="documentNumber"
          placeholder="Document number"
          defaultValue={kycSubmission?.documentNumber || ''}
          required
        />
        <input
          name="documentImageUrl"
          placeholder="Document image URL"
          defaultValue={kycSubmission?.documentImageUrl || ''}
          required
        />
        <input
          name="selfieImageUrl"
          placeholder="Selfie image URL"
          defaultValue={kycSubmission?.selfieImageUrl || ''}
        />
        <input
          name="address"
          placeholder="Residential address"
          defaultValue={kycSubmission?.address || ''}
          required
        />
        <input
          name="city"
          placeholder="City"
          defaultValue={kycSubmission?.city || 'Lagos'}
          required
        />
        <button disabled={busy}>Submit KYC</button>
      </form>
      {!artisanApproved ? (
        <article className="panel-card locked-card">
          <p className="eyebrow">Locked until approval</p>
          <h2>Offers are not available yet</h2>
          <p>{reviewMessage}</p>
          <div className="approval-steps">
            <span className={profile ? 'complete' : ''}>Profile</span>
            <span className={kycStatus !== 'NOT_SUBMITTED' ? 'complete' : ''}>KYC submitted</span>
            <span className={kycStatus === 'APPROVED' ? 'complete' : ''}>KYC approved</span>
            <span className={profile?.verifyStatus === 'APPROVED' ? 'complete' : ''}>Admin approved</span>
          </div>
        </article>
      ) : (
        <>
          <form
            className="panel-card form-card"
            onSubmit={(event) => {
              event.preventDefault();
              const form = event.currentTarget;
              runAction(() => createOffering(form), 'Offering created');
            }}
          >
            <p className="eyebrow">Services</p>
            <h2>Create offering</h2>
            <select name="categoryId" required>{categories}</select>
            <input name="title" placeholder="Service title" required />
            <input name="description" placeholder="Description" />
            <input name="priceFrom" placeholder="Price from" required />
            <input name="priceTo" placeholder="Price to" />
            <button disabled={busy}>Create offering</button>
          </form>
      <form
        className="panel-card form-card"
        onSubmit={(event) => {
          event.preventDefault();
          const form = event.currentTarget;
          runAction(() => savePayoutAccount(form), 'Payout account saved');
        }}
      >
        <p className="eyebrow">Payments</p>
        <h2>Payout account</h2>
        <p>
          Add the Nigerian bank account where completed-service payouts should be sent.
          Paystack verifies and stores the transfer recipient.
        </p>
        {payoutAccount && (
          <div className="payment-note success">
            <strong>{payoutAccount.accountName || 'Verified account'}</strong>
            <span>
              {payoutAccount.bankName || payoutAccount.bankCode} · {payoutAccount.accountNumber}
            </span>
          </div>
        )}
        <select name="bankCode" defaultValue={payoutAccount?.bankCode || ''} required>
          <option value="" disabled>Select bank</option>
          {banks.map((bank) => (
            <option key={bank.code} value={bank.code}>
              {bank.name}
            </option>
          ))}
        </select>
        <input name="accountNumber" placeholder="Account number" required />
        <input name="accountName" placeholder="Account name" />
        <button disabled={busy}>Save payout account</button>
      </form>
      <article className="panel-card">
        <p className="eyebrow">Services</p>
        <h2>My offerings</h2>
        {offerings.length === 0 && <p>No offerings created yet.</p>}
        {offerings.map((offering) => (
          <div className="list-item" key={offering.id}>
            <strong>{offering.title}</strong>
            <span>
              {money(offering.priceFrom)}
              {offering.category?.name ? ` · ${offering.category.name}` : ''}
            </span>
          </div>
        ))}
      </article>
      <article className="panel-card form-card">
        <p className="eyebrow">Portfolio</p>
        <h2>Upload work samples</h2>
        <p>Add a few clean job photos so customers can trust what you do before they book.</p>
        <label className="upload-field">
          <span>Choose image</span>
          <input
            type="file"
            accept="image/*"
            disabled={busy || uploadingPortfolio}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              void runAction(
                () => uploadPortfolioFile(file),
                'Portfolio image uploaded'
              );
              event.currentTarget.value = '';
            }}
          />
        </label>
        <div className="workspace-media-grid">
          {portfolioImages.length === 0 && <p className="muted">No portfolio images uploaded yet.</p>}
          {portfolioImages.map((image) => (
            <div className="workspace-media-card" key={image.id}>
              <img src={image.url} alt="Portfolio upload" />
              <button
                className="secondary-button"
                disabled={busy || uploadingPortfolio}
                onClick={() => runAction(() => removePortfolioImage(image.id), 'Portfolio image removed')}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </article>
      <article className="panel-card form-card">
        <p className="eyebrow">Availability</p>
        <h2>Working hours</h2>
        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            runAction(() => addAvailability(form), 'Availability added');
          }}
        >
          <select name="dayOfWeek" defaultValue="1" required>
            {dayLabels.map((day, index) => (
              <option key={day} value={index}>
                {day}
              </option>
            ))}
          </select>
          <input name="startTime" type="time" defaultValue="09:00" required />
          <input name="endTime" type="time" defaultValue="17:00" required />
          <button disabled={busy}>Add slot</button>
        </form>
        {availabilitySlots.length === 0 && <p className="muted">No availability slots yet.</p>}
        {availabilitySlots.map((slot) => (
          <div className="list-item" key={slot.id}>
            <strong>
              {dayLabels[slot.dayOfWeek]} · {slot.startTime} - {slot.endTime}
            </strong>
            <span>{slot.isActive ? 'Active' : 'Paused'}</span>
            <div className="actions">
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() => runAction(() => toggleAvailability(slot), slot.isActive ? 'Availability paused' : 'Availability activated')}
              >
                {slot.isActive ? 'Pause' : 'Activate'}
              </button>
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() => runAction(() => removeAvailability(slot.id), 'Availability removed')}
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </article>
        </>
      )}
    </>
  );
}


