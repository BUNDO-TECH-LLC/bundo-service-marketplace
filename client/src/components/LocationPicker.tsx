import { useEffect, useMemo, useState } from 'react';
import { api, PUBLIC_API_TIMEOUT_MS } from '../lib/api';
import type { LocationListItem } from '../types/location';

type LocationPickerProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (item: LocationListItem) => void;
};

const ROOT_PARENT_ID = 'nigeria';

function parentLabel(parentId: string) {
  if (parentId === ROOT_PARENT_ID) {
    return 'Nigeria';
  }

  if (parentId.startsWith('state-')) {
    return parentId
      .slice('state-'.length)
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
      .replace(/\bFct\b/g, 'FCT');
  }

  return 'Back';
}

export function LocationPicker({ open, onClose, onSelect }: LocationPickerProps) {
  const [parentId, setParentId] = useState(ROOT_PARENT_ID);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [items, setItems] = useState<LocationListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      return;
    }

    setParentId(ROOT_PARENT_ID);
    setSearch('');
    setDebouncedSearch('');
    setError('');
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 250);

    return () => window.clearTimeout(timer);
  }, [open, search]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    const params = new URLSearchParams();
    if (debouncedSearch) {
      params.set('q', debouncedSearch);
    } else {
      params.set('parent', parentId);
    }

    void api<{ locations: LocationListItem[] }>(`/locations?${params.toString()}`, {
      timeoutMs: PUBLIC_API_TIMEOUT_MS,
    })
      .then((response) => {
        if (cancelled) {
          return;
        }

        setItems(response.locations);
      })
      .catch((fetchError) => {
        if (cancelled) {
          return;
        }

        setItems([]);
        setError(fetchError instanceof Error ? fetchError.message : 'Could not load locations.');
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, open, parentId]);

  const heading = useMemo(() => {
    if (debouncedSearch) {
      return `Results for “${debouncedSearch}”`;
    }

    return parentId === ROOT_PARENT_ID ? 'Choose a state' : `Areas in ${parentLabel(parentId)}`;
  }, [debouncedSearch, parentId]);

  if (!open) {
    return null;
  }

  function handleSelect(item: LocationListItem) {
    if (item.hasChildren && item.kind === 'state' && !debouncedSearch) {
      setParentId(item.id);
      setSearch('');
      setDebouncedSearch('');
      return;
    }

    onSelect(item);
    onClose();
  }

  return (
    <div className="location-picker-backdrop" role="presentation" onClick={onClose}>
      <section
        className="location-picker"
        role="dialog"
        aria-modal="true"
        aria-labelledby="location-picker-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="location-picker-head">
          <div className="location-picker-head-row">
            {parentId !== ROOT_PARENT_ID && !debouncedSearch ? (
              <button
                type="button"
                className="location-picker-back"
                onClick={() => setParentId(ROOT_PARENT_ID)}
              >
                ← States
              </button>
            ) : (
              <span className="location-picker-back-spacer" aria-hidden="true" />
            )}
            <button type="button" className="location-picker-close" aria-label="Close" onClick={onClose}>
              ×
            </button>
          </div>
          <h2 id="location-picker-title">{heading}</h2>
          <label className="location-picker-search">
            <span className="sr-only">Search locations</span>
            <input
              type="search"
              value={search}
              placeholder="Search state or area"
              onChange={(event) => setSearch(event.target.value)}
              autoFocus
            />
          </label>
        </header>

        <div className="location-picker-body">
          {loading ? <p className="location-picker-status">Loading locations…</p> : null}
          {!loading && error ? <p className="location-picker-status location-picker-status--error">{error}</p> : null}
          {!loading && !error && items.length === 0 ? (
            <p className="location-picker-status">No locations found.</p>
          ) : null}

          {!loading && !error && items.length > 0 ? (
            <ul className="location-picker-list">
              {items.map((item) => (
                <li key={item.id}>
                  <button type="button" className="location-picker-item" onClick={() => handleSelect(item)}>
                    <span className="location-picker-item-label">{item.label}</span>
                    <span className="location-picker-item-meta">
                      {item.hasChildren && !debouncedSearch ? '›' : `${item.count.toLocaleString()} ads`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>
    </div>
  );
}
