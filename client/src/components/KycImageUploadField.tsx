import { useState } from 'react';
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl || null);
  const [uploadedUrl, setUploadedUrl] = useState(currentUrl || '');

  return (
    <div className="kyc-upload-field">
      <label>
        {label}
        <input type="hidden" name={name} value={uploadedUrl} required={required && !uploadedUrl} />
        <input
          type="file"
          accept="image/*"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (!file) return;

            const validationError = validateImageFileForPick(file);
            if (validationError) {
              void runAction(async () => {
                throw new Error(validationError);
              }, '');
              event.currentTarget.value = '';
              return;
            }

            void runAction(async () => {
              const url = await onUpload(file);
              setUploadedUrl(url);
              setPreviewUrl(url);
            }, 'Document uploaded');
            event.currentTarget.value = '';
          }}
        />
      </label>
      {hint && <p className="muted">{hint}</p>}
      {previewUrl && (
        <a className="kyc-upload-preview" href={previewUrl} target="_blank" rel="noreferrer">
          <img src={previewUrl} alt="" />
          <span>View uploaded document</span>
        </a>
      )}
    </div>
  );
}
