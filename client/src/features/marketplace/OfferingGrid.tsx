import { useState } from 'react';
import type { ActionRunner, BookingSuccessState } from '../../appTypes';
import { useAppRoot } from '../../app/appRootContext';
import { BookOfferingDialog } from '../../components/BookOfferingDialog';
import { EmptyState } from '../../components/EmptyState';
import { api } from '../../lib/api';
import { completeBookingRequest } from '../../lib/bookingSuccess';
import { money } from '../../lib/formatting';
import type { Booking, Offering, Role } from '../../types';

export function OfferingGrid({
  offerings,
  isAuthed,
  role,
  token,
  busy,
  runAction,
  reloadPrivate,
  onViewProfile,
  onBookingSuccess,
}: {
  offerings: Offering[];
  isAuthed: boolean;
  role: Role | null;
  token: string;
  busy: boolean;
  runAction: ActionRunner;
  reloadPrivate: () => Promise<void>;
  onViewProfile: (artisanId: string) => Promise<void>;
  onBookingSuccess: (booking: BookingSuccessState) => void;
}) {
  const { promptCustomerLogin } = useAppRoot();
  const [activeOfferingAction, setActiveOfferingAction] = useState<string | null>(null);
  const [bookingOffering, setBookingOffering] = useState<Offering | null>(null);

  async function runOfferingAction(actionKey: string, action: () => Promise<void>, done: string) {
    setActiveOfferingAction(actionKey);

    try {
      await runAction(action, done);
    } finally {
      setActiveOfferingAction(null);
    }
  }

  async function submitBooking(input: { scheduledAt: string; note?: string }) {
    if (!bookingOffering) {
      return;
    }

    await runOfferingAction(`book:${bookingOffering.id}`, async () => {
      const response = await api<{ booking: Booking }>('/bookings', {
        method: 'POST',
        token,
        body: JSON.stringify({
          offeringId: bookingOffering.id,
          scheduledAt: input.scheduledAt,
          ...(input.note ? { note: input.note } : {}),
        }),
      });
      setBookingOffering(null);
      await completeBookingRequest({
        booking: response.booking,
        serviceTitle: bookingOffering.title,
        artisanName: bookingOffering.artisan?.displayName || 'this artisan',
        onBookingSuccess,
        reloadPrivate,
      });
    }, '');
  }

  return (
    <>
      <div className="grid two">
        {offerings.length === 0 && (
          <EmptyState
            title="No services yet"
            body="Try another state or check back soon as new artisans are approved."
          />
        )}
        {offerings.map((offering) => {
          const bookActionKey = `book:${offering.id}`;
          const viewActionKey = `view:${offering.artisan?.id || offering.id}`;
          const isBookingThisOffering = activeOfferingAction === bookActionKey;
          const isViewingThisArtisan = activeOfferingAction === viewActionKey;

          return (
            <article className="service-card" key={offering.id}>
              <div className="card-topline">
                <p className="pill">{offering.category?.name || 'Service'}</p>
                <span>{offering.artisan?.city || 'Nearby'}</span>
              </div>
              <h3>{offering.title}</h3>
              <p>{offering.description || 'Professional home service'}</p>
              <p className="price">
                {money(offering.priceFrom)}
                {offering.priceTo ? ` - ${money(offering.priceTo)}` : ''}
              </p>
              <p className="muted">{offering.artisan?.displayName || 'Approved artisan'} · {offering.artisan?.area || 'Bundo'}</p>
              <div className="actions">
                <button
                  className="secondary-button"
                  disabled={!offering.artisan?.id || isViewingThisArtisan}
                  onClick={() =>
                    offering.artisan?.id &&
                    void runOfferingAction(
                      viewActionKey,
                      () => onViewProfile(offering.artisan!.id),
                      'Artisan profile loaded'
                    )
                  }
                >
                  {isViewingThisArtisan ? 'Opening...' : 'View profile'}
                </button>
                <button
                  disabled={(isAuthed && role !== 'CUSTOMER') || isBookingThisOffering}
                  onClick={() => {
                    if (!isAuthed) {
                      promptCustomerLogin();
                      return;
                    }

                    setBookingOffering(offering);
                  }}
                >
                  {isBookingThisOffering ? 'Booking...' : 'Book'}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <BookOfferingDialog
        open={bookingOffering !== null}
        offering={bookingOffering}
        busy={busy}
        onClose={() => setBookingOffering(null)}
        onSubmit={submitBooking}
      />
    </>
  );
}
