import { FormEvent, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { EmptyState } from '../../components/EmptyState';
import type { ActionRunner } from '../../appTypes';
import { api } from '../../lib/api';
import { money } from '../../lib/formatting';
import type { Artisan, Offering } from '../../types';

function formatPriceRange(priceFrom: number, priceTo: number | null) {
  if (priceTo != null && priceTo > priceFrom) {
    return `${money(priceFrom)} – ${money(priceTo)}`;
  }
  return `From ${money(priceFrom)}`;
}

function parsePriceInput(value: FormDataEntryValue | null) {
  const raw = String(value ?? '').trim().replace(/,/g, '');
  if (!raw) {
    return undefined;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
    throw new Error('Prices must be whole naira amounts (no decimals).');
  }
  return parsed;
}

export function ArtisanOffersPanel({
  token,
  categories,
  offerings,
  busy,
  runAction,
  refresh,
}: {
  token: string;
  categories: ReactNode[];
  offerings: Offering[];
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
}) {
  const [profile, setProfile] = useState<Artisan | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addFormKey, setAddFormKey] = useState(0);

  const marketplaceLive = profile?.verifyStatus === 'APPROVED';
  const liveCount = marketplaceLive ? offerings.length : 0;
  const hiddenCount = marketplaceLive ? 0 : offerings.length;

  useEffect(() => {
    let mounted = true;
    void api<{ profile: Artisan }>('/artisans/me', { token })
      .then((response) => {
        if (!mounted) return;
        setProfile(response.profile || null);
      })
      .catch(() => {
        if (!mounted) return;
        setProfile(null);
      });
    return () => {
      mounted = false;
    };
  }, [token]);

  useEffect(() => {
    if (offerings.length === 0) {
      setShowAddForm(true);
    }
  }, [offerings.length]);

  async function createOffering(formElement: HTMLFormElement) {
    const form = new FormData(formElement);
    const priceFrom = parsePriceInput(form.get('priceFrom'));
    const priceToRaw = parsePriceInput(form.get('priceTo'));
    if (priceFrom === undefined) {
      throw new Error('Enter a starting price.');
    }
    if (priceToRaw !== undefined && priceToRaw < priceFrom) {
      throw new Error('Maximum price must be at least the starting price.');
    }

    await api('/offerings', {
      method: 'POST',
      token,
      body: JSON.stringify({
        categoryId: form.get('categoryId'),
        title: String(form.get('title') || '').trim(),
        description: String(form.get('description') || '').trim() || undefined,
        priceFrom,
        priceTo: priceToRaw,
      }),
    });
    await refresh();
    formElement.reset();
    setAddFormKey((value) => value + 1);
    setShowAddForm(false);
  }

  async function updateOffering(offeringId: string, formElement: HTMLFormElement) {
    const form = new FormData(formElement);
    const priceFrom = parsePriceInput(form.get('priceFrom'));
    const priceToRaw = parsePriceInput(form.get('priceTo'));
    if (priceFrom === undefined) {
      throw new Error('Enter a starting price.');
    }
    if (priceToRaw !== undefined && priceToRaw < priceFrom) {
      throw new Error('Maximum price must be at least the starting price.');
    }

    await api(`/offerings/${offeringId}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({
        categoryId: form.get('categoryId'),
        title: String(form.get('title') || '').trim(),
        description: String(form.get('description') || '').trim(),
        priceFrom,
        priceTo: priceToRaw ?? null,
      }),
    });
    await refresh();
    setEditingId(null);
  }

  async function deleteOffering(offering: Offering) {
    const confirmed = window.confirm(`Remove "${offering.title}" from your service list?`);
    if (!confirmed) {
      return;
    }
    await api(`/offerings/${offering.id}`, { method: 'DELETE', token });
    await refresh();
    if (editingId === offering.id) {
      setEditingId(null);
    }
  }

  function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    void runAction(() => createOffering(form), 'Service offer created');
  }

  function handleUpdateSubmit(offeringId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    void runAction(() => updateOffering(offeringId, form), 'Service offer updated');
  }

  if (!profile) {
    return (
      <section className="artisan-offers-page">
        <header className="artisan-offers-hero">
          <div>
            <p className="eyebrow">Services</p>
            <h1>Service offers</h1>
            <p className="muted">List the jobs and packages customers can book from your profile.</p>
          </div>
        </header>
        <EmptyState
          title="Create your profile first"
          body="Set up your artisan profile before adding service offers."
        />
      </section>
    );
  }

  return (
    <section className="artisan-offers-page">
      <header className="artisan-offers-hero">
        <div className="artisan-offers-hero-main">
          <p className="eyebrow">Services</p>
          <h1>Service offers</h1>
          <p className="muted">
            {marketplaceLive
              ? `${liveCount} ${liveCount === 1 ? 'offer is' : 'offers are'} live on the marketplace.`
              : hiddenCount > 0
                ? `${hiddenCount} ${hiddenCount === 1 ? 'offer saved' : 'offers saved'}. They go live once your profile is approved.`
                : 'Add packages customers can book from your public profile.'}
          </p>
        </div>
        <button
          type="button"
          className={showAddForm ? 'secondary-button artisan-offers-add-toggle' : 'artisan-offers-add-toggle'}
          onClick={() => setShowAddForm((value) => !value)}
        >
          {showAddForm ? 'Close form' : '+ Add offer'}
        </button>
      </header>

      {!marketplaceLive && offerings.length > 0 && (
        <p className="artisan-offers-note">
          Customers will see these offers on your profile after admin approval. You can still add and edit them now.
        </p>
      )}

      {showAddForm && (
        <form key={addFormKey} className="artisan-offers-form panel-card form-card" onSubmit={handleCreateSubmit}>
          <div className="artisan-offers-form-head">
            <div>
              <p className="eyebrow">New offer</p>
              <h2>Add a service package</h2>
            </div>
          </div>
          <div className="artisan-offers-form-grid">
            <label>
              Category
              <select name="categoryId" required defaultValue="">
                <option value="" disabled>
                  Select a category
                </option>
                {categories}
              </select>
            </label>
            <label className="full">
              Service title
              <input name="title" placeholder="e.g. Deep home cleaning" required maxLength={120} />
            </label>
            <label className="full">
              Description
              <textarea
                name="description"
                rows={3}
                placeholder="What is included, typical duration, and anything the customer should know."
              />
            </label>
            <label>
              Price from (₦)
              <input name="priceFrom" inputMode="numeric" placeholder="15000" required />
            </label>
            <label>
              Price to (₦, optional)
              <input name="priceTo" inputMode="numeric" placeholder="25000" />
            </label>
          </div>
          <div className="artisan-offers-form-actions">
            <button type="button" className="secondary-button" onClick={() => setShowAddForm(false)} disabled={busy}>
              Cancel
            </button>
            <button type="submit" disabled={busy}>
              Save offer
            </button>
          </div>
        </form>
      )}

      <section className="artisan-offers-list" aria-labelledby="artisan-offers-list-heading">
        <div className="artisan-offers-list-head">
          <h2 id="artisan-offers-list-heading">Your offers</h2>
          <span className="artisan-offers-count">{offerings.length}</span>
        </div>

        {offerings.length === 0 ? (
          <article className="artisan-offers-empty panel-card">
            <p className="eyebrow">No offers yet</p>
            <h3>Start with one clear package</h3>
            <p className="muted">
              Pick a category, set a price range, and describe what customers get. You can add more offers anytime.
            </p>
            {!showAddForm && (
              <button type="button" onClick={() => setShowAddForm(true)}>
                Add your first offer
              </button>
            )}
          </article>
        ) : (
          <div className="artisan-offers-grid">
            {offerings.map((offering) => {
              const isEditing = editingId === offering.id;
              return (
                <article className="artisan-offer-card" key={offering.id}>
                  {isEditing ? (
                    <form className="artisan-offer-edit-form" onSubmit={(event) => handleUpdateSubmit(offering.id, event)}>
                      <div className="artisan-offers-form-grid">
                        <label>
                          Category
                          <select name="categoryId" required defaultValue={offering.categoryId}>
                            {categories}
                          </select>
                        </label>
                        <label className="full">
                          Service title
                          <input name="title" defaultValue={offering.title} required maxLength={120} />
                        </label>
                        <label className="full">
                          Description
                          <textarea name="description" rows={3} defaultValue={offering.description || ''} />
                        </label>
                        <label>
                          Price from (₦)
                          <input name="priceFrom" inputMode="numeric" defaultValue={offering.priceFrom} required />
                        </label>
                        <label>
                          Price to (₦, optional)
                          <input
                            name="priceTo"
                            inputMode="numeric"
                            defaultValue={offering.priceTo ?? ''}
                            placeholder="Optional"
                          />
                        </label>
                      </div>
                      <div className="artisan-offer-card-actions">
                        <button type="button" className="secondary-button" onClick={() => setEditingId(null)} disabled={busy}>
                          Cancel
                        </button>
                        <button type="submit" disabled={busy}>
                          Save changes
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="artisan-offer-card-top">
                        <span className={`artisan-offer-status ${marketplaceLive ? 'is-live' : 'is-draft'}`}>
                          {marketplaceLive ? 'Live' : 'Saved'}
                        </span>
                        <div className="artisan-offer-card-actions">
                          <button type="button" className="text-button" onClick={() => setEditingId(offering.id)} disabled={busy}>
                            Edit
                          </button>
                          <button
                            type="button"
                            className="text-button danger-text"
                            onClick={() => void runAction(() => deleteOffering(offering), 'Service offer removed')}
                            disabled={busy}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                      <h3>{offering.title}</h3>
                      {offering.category?.name && <p className="artisan-offer-category">{offering.category.name}</p>}
                      <p className="artisan-offer-price">{formatPriceRange(offering.priceFrom, offering.priceTo)}</p>
                      {offering.description ? (
                        <p className="artisan-offer-description">{offering.description}</p>
                      ) : (
                        <p className="artisan-offer-description muted">No description yet.</p>
                      )}
                    </>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}
