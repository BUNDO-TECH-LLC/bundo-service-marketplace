import { FormEvent, useEffect, useState } from 'react';

export function PromptDialog({
  open,
  title,
  message,
  label,
  defaultValue = '',
  inputType = 'text',
  confirmLabel = 'Save',
  required = true,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: string;
  label: string;
  defaultValue?: string;
  inputType?: 'text' | 'number';
  confirmLabel?: string;
  required?: boolean;
  busy?: boolean;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (open) {
      setValue(defaultValue);
    }
  }, [open, defaultValue]);

  if (!open) {
    return null;
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onConfirm(value.trim());
  }

  return (
    <div className="prompt-dialog-backdrop" role="presentation" onClick={onCancel}>
      <form
        className="prompt-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="prompt-dialog-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h2 id="prompt-dialog-title">{title}</h2>
        {message && <p className="prompt-dialog-message">{message}</p>}
        <label>
          {label}
          <input
            type={inputType}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            required={required}
            autoFocus
          />
        </label>
        <div className="prompt-dialog-actions">
          <button type="button" className="secondary-button" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" disabled={busy}>
            {busy ? 'Saving…' : confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
