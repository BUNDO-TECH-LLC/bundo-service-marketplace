import { useState } from 'react';
import type { ActionRunner, BookingSuccessState } from '../../appTypes';
import { EmptyState } from '../../components/EmptyState';
import { api } from '../../lib/api';
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
  const [activeOfferingAction, setActiveOfferingAction] = useState<string | null>(null);

  async function runOfferingAction(actionKey: string, action: () => Promise<void>, done: string) {
    setActiveOfferingAction(actionKey);

    try {
      await runAction(action, done);
    } finally {
      setActiveOfferingAction(null);
    }
  }

  return (
    <div className="grid two">
      {offerings.length === 0 && <EmptyState title="No services yet" body="Approved artisan offerings will appear here." />}
      {offerings.map((offering) => {
        const bookActionKey = `book:${offering.id}`;
        const messageActionKey = `message:${offering.id}`;
        const viewActionKey = `view:${offering.artisan?.id || offering.id}`;
        const isBookingThisOffering = activeOfferingAction === bookActionKey;
        const isMessagingThisOffering = activeOfferingAction === messageActionKey;
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
                disabled={!isAuthed || role !== 'CUSTOMER' || isBookingThisOffering}
                onClick={() =>
                  void runOfferingAction(
                    bookActionKey,
                    async () => {
                      const response = await api<{ booking: Booking }>('/bookings', {
                        method: 'POST',
                        token,
                        body: JSON.stringify({
                          offeringId: offering.id,
                          scheduledAt: new Date(Date.now() + 86400000).toISOString(),
                          note: 'Booked from web client',
                        }),
                      });
                      await reloadPrivate();
                      onBookingSuccess({
                        bookingId: response.booking.id,
                        serviceTitle: offering.title,
                        artisanName: offering.artisan?.displayName || 'this artisan',
                      });
                    },
                    'Booking requested'
                  )
                }
              >
                {isBookingThisOffering ? 'Booking...' : 'Book'}
              </button>
              <button
                className="secondary-button"
                disabled={!isAuthed || !offering.artisan?.id || isMessagingThisOffering}
                onClick={() =>
                  void runOfferingAction(
                    messageActionKey,
                    async () => {
                      await api('/messages', {
                        method: 'POST',
                        token,
                        body: JSON.stringify({
                          artisanId: offering.artisan!.id,
                          body: 'Hello, I am interested in this service.',
                        }),
                      });
                      await reloadPrivate();
                    },
                    'Message sent'
                  )
                }
              >
                {isMessagingThisOffering ? 'Sending...' : 'Message'}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}



