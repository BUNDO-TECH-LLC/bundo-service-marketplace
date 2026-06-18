import { useEffect, useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { validateImageFileForPick } from '../lib/imageFile';

export type ChatComposerPayload = {
  body: string;
  imageFile: File | null;
};

export function ChatComposer({
  busy = false,
  placeholder = 'Write a message',
  submitLabel = 'Send',
  attachLabel = 'Photo',
  className = '',
  onSubmit,
}: {
  busy?: boolean;
  placeholder?: string;
  submitLabel?: string;
  attachLabel?: string;
  className?: string;
  onSubmit: (payload: ChatComposerPayload) => Promise<void>;
}) {
  const inputId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [preview, setPreview] = useState<{ url: string; file: File } | null>(null);
  const [fileError, setFileError] = useState('');

  useEffect(() => {
    return () => {
      if (preview?.url) {
        URL.revokeObjectURL(preview.url);
      }
    };
  }, [preview?.url]);

  function clearPreview() {
    if (preview?.url) {
      URL.revokeObjectURL(preview.url);
    }
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const validationError = validateImageFileForPick(file);
    if (validationError) {
      setFileError(validationError);
      event.target.value = '';
      return;
    }

    setFileError('');

    if (preview?.url) {
      URL.revokeObjectURL(preview.url);
    }

    setPreview({
      url: URL.createObjectURL(file),
      file,
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const body = text.trim();
    if (!body && !preview) {
      return;
    }

    await onSubmit({
      body,
      imageFile: preview?.file ?? null,
    });
    setText('');
    clearPreview();
  }

  const canSend = Boolean(text.trim() || preview) && !busy;

  return (
    <form
      className={`chat-composer-shell ${className}`.trim()}
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
    >
      {preview && (
        <div className="chat-composer-preview" role="status" aria-live="polite">
          <img src={preview.url} alt="" />
          <div className="chat-composer-preview-copy">
            <strong>Photo ready to send</strong>
            <span>{preview.file.name}</span>
          </div>
          <button
            type="button"
            className="chat-composer-preview-remove"
            onClick={clearPreview}
            disabled={busy}
            aria-label="Remove photo"
          >
            Remove
          </button>
        </div>
      )}

      {fileError && <p className="auth-field-error">{fileError}</p>}

      <div className="chat-composer">
        <input
          ref={fileInputRef}
          id={inputId}
          className="chat-composer-file-input"
          type="file"
          accept="image/*"
          disabled={busy}
          onChange={handleFileChange}
        />
        <button
          type="button"
          className="chat-composer-attach"
          disabled={busy}
          aria-label={attachLabel}
          onClick={() => fileInputRef.current?.click()}
        >
          <span className="chat-composer-attach-icon" aria-hidden="true" />
          <span className="chat-composer-attach-label">{attachLabel}</span>
        </button>

        <textarea
          className="chat-composer-input"
          value={text}
          placeholder={placeholder}
          rows={1}
          maxLength={2000}
          disabled={busy}
          aria-label={placeholder}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              if (canSend) {
                void handleSubmit(event);
              }
            }
          }}
        />

        <button className="chat-composer-send" type="submit" disabled={!canSend}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
