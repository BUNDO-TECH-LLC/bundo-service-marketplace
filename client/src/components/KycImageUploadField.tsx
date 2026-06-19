import { useEffect, useId, useState } from 'react';
import type { ActionRunner } from '../appTypes';
import { validateImageFileForPick } from '../lib/imageFile';

export function KycImageUploadField({
  label,
  name,
  hint,
  currentUrl,
  busy,
  runAction,
  onUpload,
  required = false,
}: {
  label: string;
  name: string;
  hint?: string;
  currentUrl?: string | null;
  busy: boolean;
  runAction: ActionRunner;
  onUpload: (file: File) => Promise<string>;
  required?: boolean;
}) {
  const inputId = useId();
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl || null);
  const [uploadedUrl, setUploadedUrl] = useState(currentUrl || '');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setPreviewUrl(currentUrl || null);
    setUploadedUrl(currentUrl || '');
  }, [currentUrl]);

  return (
    <div className="kyc-upload-field image-file-picker">
      <input type="hidden" name={name} value={uploadedUrl} required={required && !uploadedUrl} />

      {uploading && (
        <p className="media-upload-status" role="status" aria-live="polite">
          <span className="media-upload-spinner" aria-hidden="true" />
          Uploading document…
        </p>
      )}

      <label className={`media-upload-dropzone${busy || uploading ? ' media-upload-dropzone--busy' : ''}`} htmlFor={inputId}>
        <span className="media-upload-icon" aria-hidden="true" />
        <span className="media-upload-title">{label}</span>
        <span className="media-upload-hint">Gallery, files, or camera · JPG or PNG · Max 5MB</span>
      </label>

      <input
        id={inputId}
        type="file"
        accept="image/*"
        disabled={busy || uploading}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.currentTarget.value = '';
          if (!file) {
            return;
          }

          const validationError = validateImageFileForPick(file);
          if (validationError) {
            setError(validationError);
            return;
          }

          setError('');
          setUploading(true);
          void runAction(async () => {
            try {
              const url = await onUpload(file);
              setUploadedUrl(url);
              setPreviewUrl(url);
            } finally {
              setUploading(false);
            }
          }, 'Document uploaded');
        }}
      />

      {hint && <p className="muted">{hint}</p>}
      {error && (
        <p className="auth-field-error" role="alert">
          {error}
        </p>
      )}
      {previewUrl && (
        <a className="kyc-upload-preview" href={previewUrl} target="_blank" rel="noreferrer">
          <img src={previewUrl} alt="" />
          <span>View uploaded document</span>
        </a>
      )}
    </div>
  );
}
