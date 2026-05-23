import { type ChangeEvent, type RefObject, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { AppIcon } from '../../../components/ui/AppIcon';
import { auth } from '../../../lib/firebase';
import { resolveApiSession } from '../../../lib/authSession';
import { formErrorClassName } from '../../../lib/formStyles';
import {
  deletePortfolioImage,
  fetchMyPortfolioImages,
  MAX_GALLERY_IMAGES,
  nextGalleryDisplayOrder,
  PROFILE_DISPLAY_ORDER,
  splitPortfolioImages,
  uploadPortfolioImage,
  validatePortfolioImageFile,
} from '../../../lib/portfolioUpload';
import type { PortfolioImage } from '../../../types';
import { OnboardingNavFooter } from './OnboardingNavFooter';
import { isDevOnboardingPreview, onboardingStepPath } from './onboardingPreview';

type DevPortfolioImage = {
  id: string;
  url: string;
  displayOrder: number;
};

type GallerySlot =
  | { kind: 'upload' }
  | { kind: 'image'; image: PortfolioImage | DevPortfolioImage }
  | { kind: 'empty' };

function buildGallerySlots(galleryImages: Array<PortfolioImage | DevPortfolioImage>) {
  const slots: GallerySlot[] = [];

  if (galleryImages.length < MAX_GALLERY_IMAGES) {
    slots.push({ kind: 'upload' });
  }

  for (const image of galleryImages) {
    slots.push({ kind: 'image', image });
  }

  const minVisibleSlots = 8;

  while (slots.length < minVisibleSlots) {
    slots.push({ kind: 'empty' });
  }

  return slots;
}

function isDevImage(image: PortfolioImage | DevPortfolioImage): image is DevPortfolioImage {
  return !('artisanId' in image);
}

export function PortfolioStep() {
  const navigate = useNavigate();
  const location = useLocation();
  const devPreview = isDevOnboardingPreview(location.pathname);
  const availabilityPath = onboardingStepPath('availability', devPreview);

  const profileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [token, setToken] = useState('');
  const [images, setImages] = useState<Array<PortfolioImage | DevPortfolioImage>>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingProfile, setUploadingProfile] = useState(false);
  const [uploadingGallery, setUploadingGallery] = useState(false);
  const [formError, setFormError] = useState('');
  const [devLocalMode, setDevLocalMode] = useState(false);

  const busy = uploadingProfile || uploadingGallery;

  const { profileImage, galleryImages } = useMemo(() => splitPortfolioImages(images as PortfolioImage[]), [images]);

  const gallerySlots = useMemo(() => buildGallerySlots(galleryImages), [galleryImages]);

  useEffect(() => {
    if (devPreview && (!auth || !auth.currentUser)) {
      setDevLocalMode(true);
      setLoading(false);
      return undefined;
    }

    if (!auth) {
      setLoading(false);
      return undefined;
    }

    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (devPreview) {
          setDevLocalMode(true);
          setImages([]);
        }

        setToken('');
        setLoading(false);
        return;
      }

      try {
        const session = await resolveApiSession(user);
        setToken(session.token);
        setDevLocalMode(false);

        const portfolioImages = await fetchMyPortfolioImages(session.token);
        setImages(portfolioImages);
      } catch {
        if (devPreview) {
          setDevLocalMode(true);
          setImages([]);
        } else {
          setFormError('Sign in again to continue.');
        }
      } finally {
        setLoading(false);
      }
    });
  }, [devPreview]);

  async function refreshImages() {
    if (!token) {
      return;
    }

    const portfolioImages = await fetchMyPortfolioImages(token);
    setImages(portfolioImages);
  }

  function addDevImage(file: File, displayOrder: number) {
    const url = URL.createObjectURL(file);
    const image: DevPortfolioImage = {
      id: crypto.randomUUID(),
      url,
      displayOrder,
    };

    setImages((current) => {
      const withoutOrder =
        displayOrder === PROFILE_DISPLAY_ORDER
          ? current.filter((item) => item.displayOrder !== PROFILE_DISPLAY_ORDER)
          : current;

      return [...withoutOrder, image].sort((a, b) => a.displayOrder - b.displayOrder);
    });
  }

  function removeDevImage(imageId: string) {
    setImages((current) => {
      const target = current.find((item) => item.id === imageId);

      if (target && isDevImage(target)) {
        URL.revokeObjectURL(target.url);
      }

      return current.filter((item) => item.id !== imageId);
    });
  }

  async function handleProfileFile(file: File) {
    setFormError('');

    try {
      validatePortfolioImageFile(file);

      if (devLocalMode) {
        addDevImage(file, PROFILE_DISPLAY_ORDER);
        return;
      }

      if (!token) {
        setFormError('Sign in again to continue.');
        return;
      }

      setUploadingProfile(true);

      if (profileImage) {
        await deletePortfolioImage(token, profileImage.id);
      }

      await uploadPortfolioImage(token, file, PROFILE_DISPLAY_ORDER);
      await refreshImages();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not upload profile photo.');
    } finally {
      setUploadingProfile(false);
    }
  }

  async function handleGalleryFile(file: File) {
    setFormError('');

    if (galleryImages.length >= MAX_GALLERY_IMAGES) {
      setFormError('You can upload up to 12 portfolio photos.');
      return;
    }

    try {
      validatePortfolioImageFile(file);

      if (devLocalMode) {
        addDevImage(file, nextGalleryDisplayOrder(images as PortfolioImage[]));
        return;
      }

      if (!token) {
        setFormError('Sign in again to continue.');
        return;
      }

      setUploadingGallery(true);
      const displayOrder = nextGalleryDisplayOrder(images as PortfolioImage[]);
      await uploadPortfolioImage(token, file, displayOrder);
      await refreshImages();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not upload portfolio image.');
    } finally {
      setUploadingGallery(false);
    }
  }

  async function handleRemoveImage(image: PortfolioImage | DevPortfolioImage) {
    setFormError('');

    try {
      if (devLocalMode || isDevImage(image)) {
        removeDevImage(image.id);
        return;
      }

      const portfolioImage = image as PortfolioImage;

      if (!token) {
        setFormError('Sign in again to continue.');
        return;
      }

      setUploadingGallery(true);
      await deletePortfolioImage(token, portfolioImage.id);
      await refreshImages();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not remove image.');
    } finally {
      setUploadingGallery(false);
    }
  }

  function handleSkip() {
    navigate(availabilityPath);
  }

  function handleNext() {
    navigate(availabilityPath);
  }

  function onProfileInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.currentTarget.value = '';

    if (!file) {
      return;
    }

    void handleProfileFile(file);
  }

  function onGalleryInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.currentTarget.value = '';

    if (!file) {
      return;
    }

    void handleGalleryFile(file);
  }

  return (
    <>
      <section className="rounded-2xl border border-[var(--color-border)] bg-white p-6 shadow-sm sm:p-8">
        <PortfolioHeader />

        {loading ? (
          <p className="mt-6 text-sm text-[var(--color-text-muted)]">Loading your photos…</p>
        ) : (
          <div className="mt-6 grid gap-8">
            <ProfilePhotoUpload
              profileImage={profileImage}
              uploading={uploadingProfile}
              disabled={busy}
              inputRef={profileInputRef}
              onChooseFile={() => profileInputRef.current?.click()}
              onInputChange={onProfileInputChange}
            />

            <PortfolioGallery
              slots={gallerySlots}
              uploading={uploadingGallery}
              disabled={busy}
              inputRef={galleryInputRef}
              onUploadClick={() => galleryInputRef.current?.click()}
              onInputChange={onGalleryInputChange}
              onRemove={(image) => void handleRemoveImage(image)}
            />

            {formError ? <p className={formErrorClassName}>{formError}</p> : null}
          </div>
        )}
      </section>

      <OnboardingNavFooter
        skipTo={devPreview ? availabilityPath : undefined}
        onSkip={devPreview ? undefined : handleSkip}
        skipLabel="Skip"
        nextLabel={busy ? 'Saving…' : 'Next'}
        nextDisabled={busy || loading}
        onNext={handleNext}
      />
    </>
  );
}

function PortfolioHeader() {
  return (
    <div className="grid gap-1">
      <h2 className="m-0 text-xl font-semibold text-[var(--color-ink)]">Add your photos</h2>
      <p className="m-0 text-sm text-[var(--color-text-muted)]">
        A great profile photo and strong portfolio help customers choose you with confidence.
      </p>
    </div>
  );
}

type ProfilePhotoUploadProps = {
  profileImage: PortfolioImage | DevPortfolioImage | null;
  uploading: boolean;
  disabled: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onChooseFile: () => void;
  onInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
};

function ProfilePhotoUpload({
  profileImage,
  uploading,
  disabled,
  inputRef,
  onChooseFile,
  onInputChange,
}: ProfilePhotoUploadProps) {
  return (
    <div className="grid gap-2">
      <div className="flex flex-col gap-4 rounded-xl border border-dashed border-[var(--color-input-border)] bg-[var(--color-page)] p-4 sm:flex-row sm:items-center">
        <div className="relative mx-auto shrink-0 sm:mx-0">
          <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-full bg-[var(--color-soft)]">
            {profileImage ? (
              <img
                className="h-full w-full object-cover"
                src={profileImage.url}
                alt="Profile preview"
              />
            ) : (
              <AppIcon
                icon="mdi:account-outline"
                size={36}
                className="text-[var(--color-text-muted)]"
              />
            )}
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 grid h-7 w-7 place-items-center rounded-full bg-[var(--color-accent-bright)] text-white">
            <AppIcon icon="mdi:camera" size={14} decorative={false} label="Upload profile photo" />
          </span>
        </div>

        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="m-0 text-base font-semibold text-[var(--color-ink)]">Upload a photo</p>
          <p className="m-0 mt-1 text-sm text-[var(--color-text-muted)]">
            JPG or PNG · Max 5MB · Square crop recommended
          </p>
        </div>

        <button
          type="button"
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-[var(--color-ink)] px-5 text-sm font-bold text-white hover:bg-[var(--color-black)] disabled:cursor-not-allowed disabled:opacity-55"
          onClick={onChooseFile}
          disabled={disabled}
        >
          {uploading ? 'Uploading…' : 'Choose file'}
        </button>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/jpg"
          className="sr-only"
          aria-label="Choose profile photo"
          onChange={onInputChange}
          disabled={disabled}
        />
      </div>

      <p className="m-0 text-sm text-[var(--color-text-muted)]">
        Photo used on your profile card and in search results. Customers trust profiles with a clear
        photo.
      </p>
    </div>
  );
}

type PortfolioGalleryProps = {
  slots: GallerySlot[];
  uploading: boolean;
  disabled: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  onUploadClick: () => void;
  onInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemove: (image: PortfolioImage | DevPortfolioImage) => void;
};

function PortfolioGallery({
  slots,
  uploading,
  disabled,
  inputRef,
  onUploadClick,
  onInputChange,
  onRemove,
}: PortfolioGalleryProps) {
  return (
    <div className="grid gap-3">
      <div className="grid gap-1">
        <h3 className="m-0 text-base font-semibold text-[var(--color-ink)]">Portfolio images</h3>
        <p className="m-0 text-sm text-[var(--color-text-muted)]">
          Show customers examples of your past work. Upload up to 12 photos.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {slots.map((slot, index) => {
          if (slot.kind === 'upload') {
            return (
              <button
                key="upload-slot"
                type="button"
                className="grid aspect-square place-items-center gap-2 rounded-lg border border-dashed border-[var(--color-accent-bright)] bg-[var(--color-accent-soft)] px-2 text-center transition hover:bg-[var(--color-accent-wash)] disabled:cursor-not-allowed disabled:opacity-55"
                onClick={onUploadClick}
                disabled={disabled}
                aria-label="Upload portfolio photo"
              >
                <AppIcon
                  icon="mdi:image-plus"
                  size={28}
                  className="text-[var(--color-accent-bright)]"
                />
                <span className="text-sm font-semibold text-[var(--color-accent-bright)]">
                  {uploading ? 'Uploading…' : 'Upload a photo'}
                </span>
              </button>
            );
          }

          if (slot.kind === 'image') {
            return (
              <div
                key={slot.image.id}
                className="group relative aspect-square overflow-hidden rounded-lg bg-[var(--color-soft)]"
              >
                <img
                  className="h-full w-full object-cover"
                  src={slot.image.url}
                  alt="Portfolio upload"
                />
                <button
                  type="button"
                  className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-[var(--color-ink)]/80 text-white opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
                  onClick={() => onRemove(slot.image)}
                  disabled={disabled}
                  aria-label="Remove portfolio photo"
                >
                  <AppIcon icon="mdi:close" size={16} />
                </button>
              </div>
            );
          }

          return (
            <div
              key={`empty-${index}`}
              className="grid aspect-square place-items-center rounded-lg bg-[var(--color-soft)]"
              aria-hidden
            >
              <AppIcon icon="mdi:image-outline" size={24} className="text-[var(--color-text-muted)]" />
            </div>
          );
        })}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/jpg"
        className="sr-only"
        aria-label="Choose portfolio photo"
        onChange={onInputChange}
        disabled={disabled}
      />

      <p className="m-0 text-center text-sm text-[var(--color-text-muted)]">
        Artisans with 6+ portfolio photos get up to 3x more booking requests. Show before-and-after
        shots for best results.
      </p>
    </div>
  );
}
