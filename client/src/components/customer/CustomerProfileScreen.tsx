import { useRef, useState, type FormEvent } from 'react';
import { updateProfile, type User } from 'firebase/auth';
import { nigeriaStates } from '../../constants/data';
import { api } from '../../lib/api';
import { uploadChatImage } from '../../lib/chatUpload';
import { readCustomerProfileLocation, writeCustomerProfileLocation } from '../../lib/customerProfileStorage';
import { customerProfileImageUrl } from '../../lib/profileImage';
import { userFullDisplayName } from '../../lib/userDisplayName';
import type { ApiUser } from '../../types';
import { AppIcon } from '../ui/AppIcon';
import { ProfileAvatar } from '../ui/ProfileAvatar';

type CustomerProfileScreenProps = {
  firebaseUser: User;
  me: ApiUser | null;
  onSaved?: (user: ApiUser) => void;
};

export function CustomerProfileScreen({ firebaseUser, me, onSaved }: CustomerProfileScreenProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState(userFullDisplayName(firebaseUser, me));
  const [email] = useState(firebaseUser.email || me?.email || '');
  const [phone, setPhone] = useState(me?.phone || '');
  const [location, setLocation] = useState(readCustomerProfileLocation() || 'Lagos');
  const [avatarUrl, setAvatarUrl] = useState(customerProfileImageUrl(firebaseUser));
  const [busy, setBusy] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function handlePhotoChange(file: File | null) {
    if (!file) {
      return;
    }

    setUploadingPhoto(true);
    setError('');

    try {
      const token = await firebaseUser.getIdToken();
      const { imageUrl } = await uploadChatImage(token, file);
      await updateProfile(firebaseUser, { photoURL: imageUrl });
      setAvatarUrl(imageUrl);
      setNotice('Profile picture updated.');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not upload profile picture.');
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');

    try {
      const trimmedName = fullName.trim();

      if (!trimmedName) {
        throw new Error('Full name is required.');
      }

      await updateProfile(firebaseUser, { displayName: trimmedName });

      const token = await firebaseUser.getIdToken();
      const response = await api<{ user: ApiUser }>('/users/profile', {
        method: 'PATCH',
        token,
        body: JSON.stringify({ phone: phone.trim() || null }),
      });

      writeCustomerProfileLocation(location);
      onSaved?.(response.user);
      setNotice('Your profile has been updated.');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not save profile.');
    } finally {
      setBusy(false);
    }
  }

  function handleCancel() {
    setFullName(userFullDisplayName(firebaseUser, me));
    setPhone(me?.phone || '');
    setLocation(readCustomerProfileLocation() || 'Lagos');
    setAvatarUrl(customerProfileImageUrl(firebaseUser));
    setError('');
    setNotice('');
  }

  const displayLabel = userFullDisplayName(firebaseUser, me);

  return (
    <section className="customer-profile-screen" aria-labelledby="customer-profile-title">
      <header className="customer-profile-screen__head">
        <h1 id="customer-profile-title" className="customer-profile-screen__title">
          Edit Personal Information
        </h1>
        <p className="customer-profile-screen__subtitle">
          Update your profile details and management settings.
        </p>
      </header>

      {notice ? <p className="customer-profile-screen__notice">{notice}</p> : null}
      {error ? <p className="customer-profile-screen__error">{error}</p> : null}

      <form className="customer-profile-screen__form" onSubmit={handleSubmit}>
        <div className="customer-profile-screen__photo-row">
          <div className="customer-profile-screen__avatar-wrap">
            <ProfileAvatar
              name={displayLabel}
              imageUrl={avatarUrl}
            className="customer-profile-screen__avatar"
            textClassName="text-3xl"
            />
            <button
              className="customer-profile-screen__avatar-edit"
              type="button"
              aria-label="Change profile picture"
              disabled={uploadingPhoto}
              onClick={() => fileInputRef.current?.click()}
            >
              <AppIcon icon="mdi:pencil" size={16} />
            </button>
            <input
              ref={fileInputRef}
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                void handlePhotoChange(file);
                event.target.value = '';
              }}
            />
          </div>

          <div className="customer-profile-screen__photo-copy">
            <strong>Profile Picture</strong>
            <p>JPG, GIF or PNG. Max size of 800K</p>
            <button
              className="customer-profile-screen__upload-link"
              type="button"
              disabled={uploadingPhoto}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadingPhoto ? 'Uploading…' : 'Upload new'}
            </button>
          </div>
        </div>

        <label className="customer-profile-screen__field">
          <span>Full Name</span>
          <input
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            placeholder="Marcus Thorne"
            required
          />
        </label>

        <label className="customer-profile-screen__field">
          <span>Email Address</span>
          <input value={email} type="email" readOnly aria-readonly="true" />
        </label>

        <label className="customer-profile-screen__field">
          <span>Phone Number</span>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+234 801 234 5678"
            type="tel"
            autoComplete="tel"
          />
        </label>

        <label className="customer-profile-screen__field">
          <span>Location</span>
          <div className="customer-profile-screen__location-input">
            <select value={location} onChange={(event) => setLocation(event.target.value)}>
              {nigeriaStates.map((state) => (
                <option key={state} value={state}>
                  {state}, Nigeria
                </option>
              ))}
            </select>
            <AppIcon icon="mingcute:location-line" size={20} className="customer-profile-screen__location-icon" />
          </div>
        </label>

        <div className="customer-profile-screen__actions">
          <button className="customer-profile-screen__cancel" type="button" onClick={handleCancel} disabled={busy}>
            Cancel
          </button>
          <button className="customer-profile-screen__save" type="submit" disabled={busy || uploadingPhoto}>
            {busy ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </section>
  );
}
