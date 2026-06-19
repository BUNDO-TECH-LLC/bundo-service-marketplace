import { useEffect, useId, useState } from 'react';
import { validateImageFileForPick } from '../lib/imageFile';

type ImageFilePickerFieldProps = {
  label: string;
  hint?: string;
  busy?: boolean;
  disabled?: boolean;
  selectedFile?: File | null;
  uploading?: boolean;
  uploadLabel?: string;
  error?: string;
  onPick: (file: File) => void;
  onError?: (message: string) => void;
  onClear?: () => void;
  dropzoneClassName?: string;
};

export function ImageFilePickerField({
  label,
  hint,
  busy = false,
  disabled = false,
  selectedFile = null,
  uploading = false,
  uploadLabel = 'Uploading photo…',
  error,
  onPick,
  onError,
  onClear,
  dropzoneClassName = 'media-upload-dropzone',
}: ImageFilePickerFieldProps) {
  const inputId = useId();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const isDisabled = disabled || busy || uploading;

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [selectedFile]);

  return (
    <div className="image-file-picker">
      <span className="image-file-picker-label">{label}</span>
      {hint && <p className="muted">{hint}</p>}

      {uploading && (
        <p className="media-upload-status" role="status" aria-live="polite">
          <span className="media-upload-spinner" aria-hidden="true" />
          {uploadLabel}
        </p>
      )}

      {previewUrl ? (
        <div className="image-file-picker-preview">
          <img src={previewUrl} alt="" />
          <div className="image-file-picker-preview-meta">
            <span>{selectedFile?.name}</span>
            {!isDisabled && onClear && (
              <button type="button" className="text-button" onClick={onClear}>
                Remove
              </button>
            )}
          </div>
          {!isDisabled && (
            <label className={`${dropzoneClassName} media-upload-dropzone--compact`} htmlFor={inputId}>
              <span className="media-upload-icon" aria-hidden="true" />
              <span className="media-upload-title">Replace photo</span>
              <span className="media-upload-hint">Choose from gallery, files, or camera</span>
            </label>
          )}
        </div>
      ) : (
        <label
          className={`${dropzoneClassName}${isDisabled ? ' media-upload-dropzone--busy' : ''}`}
          htmlFor={inputId}
        >
          <span className="media-upload-icon" aria-hidden="true" />
          <span className="media-upload-title">Tap to add photo</span>
          <span className="media-upload-hint">Gallery, files, or camera · JPG or PNG · Max 5MB</span>
        </label>
      )}

      <input
        id={inputId}
        type="file"
        accept="image/*"
        disabled={isDisabled}
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.currentTarget.value = '';
          if (!file) {
            return;
          }

          const validationError = validateImageFileForPick(file);
          if (validationError) {
            onError?.(validationError);
            return;
          }

          onPick(file);
        }}
      />

      {error && (
        <p className="auth-field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
