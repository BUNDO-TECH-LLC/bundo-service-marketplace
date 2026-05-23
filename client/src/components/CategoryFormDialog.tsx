import { FormEvent, useEffect, useState } from 'react';

export type CategoryFormValues = {
  name: string;
  slug: string;
  iconKey: string;
};

export function CategoryFormDialog({
  open,
  title,
  initial,
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  initial?: CategoryFormValues;
  busy?: boolean;
  onConfirm: (values: CategoryFormValues) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [iconKey, setIconKey] = useState('service');

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setSlug(initial?.slug ?? '');
    setIconKey(initial?.iconKey ?? 'service');
  }, [open, initial]);

  if (!open) {
    return null;
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onConfirm({
      name: name.trim(),
      slug: slug.trim(),
      iconKey: iconKey.trim(),
    });
  }

  return (
    <div className="prompt-dialog-backdrop" role="presentation" onClick={onCancel}>
      <form
        className="prompt-dialog prompt-dialog--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-form-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h2 id="category-form-title">{title}</h2>
        <label>
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} required autoFocus />
        </label>
        <label>
          Slug
          <input value={slug} onChange={(event) => setSlug(event.target.value)} required />
        </label>
        <label>
          Icon key
          <input value={iconKey} onChange={(event) => setIconKey(event.target.value)} required />
        </label>
        <div className="prompt-dialog-actions">
          <button type="button" className="secondary-button" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
