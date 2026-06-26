import { useEffect, useState } from 'react';
import { buildAppPath } from '../../lib/appPaths';
import type { ActionRunner } from '../../appTypes';
import { ArtisanAvailabilityEditor } from '../../components/ArtisanAvailabilityEditor';
import { ArtisanLocationField } from '../../components/ArtisanLocationField';
import { ArtisanPortfolioManager } from '../../components/ArtisanPortfolioManager';
import { api } from '../../lib/api';
import {
  artisanLocationFromCatalogItem,
  profileLocationFromUser,
  type ArtisanLocationSelection,
} from '../../lib/artisanLocationSelection';
import { useArtisanPortfolio } from '../../lib/useArtisanPortfolio';
import type { LocationListItem } from '../../types/location';
import type { Artisan, ArtisanKycSubmission } from '../../types';

type ProfileSection = 'about' | 'photos' | 'availability';

const PROFILE_SECTIONS: { id: ProfileSection; label: string; short: string }[] = [
  { id: 'about', label: 'About', short: 'About' },
  { id: 'photos', label: 'Photos', short: 'Photos' },
  { id: 'availability', label: 'Availability', short: 'Hours' },
];

export function ArtisanProfileSettings({
  token,
  busy,
  runAction,
  refresh,
  onNavigate,
}: {
  token: string;
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
  onNavigate: (path: string) => void;
}) {
  const [activeSection, setActiveSection] = useState<ProfileSection>('about');
  const [profileFormKey, setProfileFormKey] = useState(0);
  const [profile, setProfile] = useState<Artisan | null>(null);
  const [kycSubmission, setKycSubmission] = useState<ArtisanKycSubmission | null>(null);
  const [locationSelection, setLocationSelection] = useState<ArtisanLocationSelection>(() =>
    profileLocationFromUser({ state: 'Lagos', area: '' })
  );
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const kycStatus = kycSubmission?.status ?? 'NOT_SUBMITTED';
  const approved = profile?.verifyStatus === 'APPROVED' && kycStatus === 'APPROVED';
  const {
    portfolioImages,
    uploadingPortfolio,
    uploadPortfolioFile,
    uploadPortfolioFiles,
    removePortfolioImage,
    reorderPortfolioImage,
  } = useArtisanPortfolio(token);

  const activeLabel = PROFILE_SECTIONS.find((section) => section.id === activeSection)?.label ?? 'Profile';

  useEffect(() => {
    let mounted = true;
    void Promise.all([
      api<{ profile: Artisan }>('/artisans/me', { token }).catch(() => ({ profile: null as unknown as Artisan })),
      api<{ submission: ArtisanKycSubmission | null }>('/artisans/kyc', { token }).catch(() => ({ submission: null })),
    ])
      .then(([profileResponse, kycResponse]) => {
        if (!mounted) return;
        const nextProfile = profileResponse.profile || null;
        setProfile(nextProfile);
        setKycSubmission(kycResponse.submission);
        setDisplayName(nextProfile?.displayName || '');
        setBio(nextProfile?.bio || '');
        setLocationSelection(
          profileLocationFromUser({
            state: nextProfile?.city,
            area: nextProfile?.area,
            locationId: nextProfile?.locationId,
            locationLat: nextProfile?.lat,
            locationLng: nextProfile?.lng,
          })
        );
      })
      .catch(() => {
        if (!mounted) return;
        setProfile(null);
        setKycSubmission(null);
      });
    return () => {
      mounted = false;
    };
  }, [token]);

  async function hydrateProfile() {
    const [profileResponse, kycResponse] = await Promise.all([
      api<{ profile: Artisan }>('/artisans/me', { token }).catch(() => ({ profile: null as unknown as Artisan })),
      api<{ submission: ArtisanKycSubmission | null }>('/artisans/kyc', { token }).catch(() => ({ submission: null })),
    ]);
    setProfile(profileResponse.profile || null);
    setKycSubmission(kycResponse.submission);
    const nextProfile = profileResponse.profile || null;
    setDisplayName(nextProfile?.displayName || '');
    setBio(nextProfile?.bio || '');
    setLocationSelection(
      profileLocationFromUser({
        state: nextProfile?.city,
        area: nextProfile?.area,
        locationId: nextProfile?.locationId,
        locationLat: nextProfile?.lat,
        locationLng: nextProfile?.lng,
      })
    );
  }

  function applyCatalogLocation(item: LocationListItem) {
    setLocationSelection(artisanLocationFromCatalogItem(item));
  }

  async function saveAbout() {
    await api('/artisans/profile', {
      method: profile ? 'PATCH' : 'POST',
      token,
      body: JSON.stringify({
        displayName: displayName.trim(),
        bio: bio.trim() || 'Bundo artisan',
        city: locationSelection.state,
        area: locationSelection.area.trim() || undefined,
        locationId: locationSelection.locationId || undefined,
        lat: profile?.lat ?? locationSelection.lat,
        lng: profile?.lng ?? locationSelection.lng,
      }),
    });
    const response = await api<{ profile: Artisan }>('/artisans/me', { token });
    setProfile(response.profile);
    await refresh();
  }

  function goToSection(section: ProfileSection) {
    setActiveSection(section);
    document.getElementById(`profile-${section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function panelClass(section: ProfileSection) {
    return `artisan-settings-panel${activeSection === section ? ' is-active' : ''}`;
  }

  return (
    <section className="artisan-profile-settings-page">
      <header className="artisan-settings-hero">
        <div className="artisan-settings-hero-main">
          {portfolioImages[0] ? (
            <img className="profile-picture-preview" src={portfolioImages[0].url} alt="" />
          ) : (
            <span className="recommended-avatar large">{(profile?.displayName || 'A').slice(0, 1).toUpperCase()}</span>
          )}
          <div>
            <p className="eyebrow">Public profile</p>
            <h1>{profile?.displayName || 'Your business'}</h1>
            <p className="muted">What customers see when they find you on Bundo.</p>
            <span className={`booking-status ${approved ? 'completed' : 'pending'}`}>
              {approved ? 'Live on marketplace' : kycStatus.toLowerCase().replace(/_/g, ' ')}
            </span>
          </div>
        </div>
        {profile?.id && approved && (
          <button
            type="button"
            className="secondary-button artisan-profile-preview-button"
            onClick={() => onNavigate(`/artisans/${profile.id}`)}
          >
            Preview profile
          </button>
        )}
      </header>

      <nav className="artisan-settings-subnav" aria-label="Profile sections">
        {PROFILE_SECTIONS.map((section) => (
          <button
            key={section.id}
            type="button"
            className={activeSection === section.id ? 'active' : ''}
            onClick={() => goToSection(section.id)}
          >
            <span className="artisan-profile-nav-label-full">{section.label}</span>
            <span className="artisan-profile-nav-label-short">{section.short}</span>
          </button>
        ))}
      </nav>

      <p className="artisan-profile-mobile-heading" aria-live="polite">
        {activeLabel}
      </p>

      <div className="artisan-settings-stack">
        <form
          key={profileFormKey}
          id="profile-about"
          className={`artisan-settings-card ${panelClass('about')}`}
          onSubmit={(event) => {
            event.preventDefault();
            void runAction(() => saveAbout(), 'Profile saved');
          }}
        >
          <h2>About your business</h2>
          <p>Update the listing details customers see on your public profile.</p>
          <label>
            Business name
            <input
              name="displayName"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              required
            />
          </label>
          <label>
            Short bio
            <textarea
              name="bio"
              rows={4}
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              placeholder="Tell customers about your work and experience."
            />
          </label>
          <label>
            Where you work
            <ArtisanLocationField
              locationLabel={locationSelection.locationLabel}
              disabled={busy}
              onSelect={applyCatalogLocation}
            />
          </label>
          <p className="muted account-settings-hint">
            Contact phone and login email are managed in{' '}
            <button
              type="button"
              className="text-button artisan-profile-settings-link"
              onClick={() => onNavigate(buildAppPath({ view: 'workspace', workspaceSection: 'settings' }))}
            >
              Settings
            </button>
            . KYC and payout bank are there too.
          </p>
          <div className="settings-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setProfileFormKey((value) => value + 1);
                void hydrateProfile();
                setDisplayName(profile?.displayName || '');
                setBio(profile?.bio || '');
                setLocationSelection(
                  profileLocationFromUser({
                    state: profile?.city,
                    area: profile?.area,
                    locationId: profile?.locationId,
                    locationLat: profile?.lat,
                    locationLng: profile?.lng,
                  })
                );
              }}
            >
              Cancel
            </button>
            <button type="submit" disabled={busy}>
              Save changes
            </button>
          </div>
        </form>

        <div id="profile-photos" className={panelClass('photos')}>
          <ArtisanPortfolioManager
            variant="settings"
            portfolioImages={portfolioImages}
            busy={busy}
            uploadingPortfolio={uploadingPortfolio}
            runAction={runAction}
            uploadPortfolioFile={uploadPortfolioFile}
            uploadPortfolioFiles={uploadPortfolioFiles}
            removePortfolioImage={removePortfolioImage}
            reorderPortfolioImage={reorderPortfolioImage}
          />
        </div>

        <div id="profile-availability" className={panelClass('availability')}>
          <ArtisanAvailabilityEditor token={token} busy={busy} runAction={runAction} />
        </div>
      </div>
    </section>
  );
}
