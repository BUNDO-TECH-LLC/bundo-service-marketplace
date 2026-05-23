import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookingConfirmedOverlay,
  type BookingConfirmedDetails,
} from '../components/customer/BookingConfirmedOverlay';
import { api } from '../lib/api';
import { buildCustomerWorkspacePath } from '../routes/paths';

export type BookingConfirmedPayload = BookingConfirmedDetails & {
  artisanId: string;
  token: string;
};

type BookingConfirmedContextValue = {
  showBookingConfirmed: (payload: BookingConfirmedPayload) => void;
  dismissBookingConfirmed: () => void;
};

const BookingConfirmedContext = createContext<BookingConfirmedContextValue | null>(null);

export function BookingConfirmedProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [confirmed, setConfirmed] = useState<BookingConfirmedPayload | null>(null);
  const [busy, setBusy] = useState(false);

  const showBookingConfirmed = useCallback((payload: BookingConfirmedPayload) => {
    setConfirmed(payload);
  }, []);

  const dismissBookingConfirmed = useCallback(() => {
    setConfirmed(null);
  }, []);

  useEffect(() => {
    if (!confirmed) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [confirmed]);

  const handleMessageArtisan = useCallback(async () => {
    if (!confirmed) {
      return;
    }

    setBusy(true);

    try {
      await api('/messages', {
        method: 'POST',
        token: confirmed.token,
        body: JSON.stringify({
          artisanId: confirmed.artisanId,
          body: `Hi ${confirmed.artisanName}, I just booked ${confirmed.serviceTitle}.`,
        }),
      });

      setConfirmed(null);
      navigate(buildCustomerWorkspacePath('messages'));
    } catch {
      setConfirmed(null);
      navigate(buildCustomerWorkspacePath('messages'));
    } finally {
      setBusy(false);
    }
  }, [confirmed, navigate]);

  const handleViewBookingDetails = useCallback(() => {
    if (!confirmed) {
      return;
    }

    const { serviceTitle, artisanName } = confirmed;
    setConfirmed(null);
    navigate(buildCustomerWorkspacePath('bookings'), {
      state: {
        notice: `Booking confirmed for ${serviceTitle} with ${artisanName}.`,
      },
    });
  }, [confirmed, navigate]);

  const value = useMemo(
    () => ({
      showBookingConfirmed,
      dismissBookingConfirmed,
    }),
    [showBookingConfirmed, dismissBookingConfirmed]
  );

  return (
    <BookingConfirmedContext.Provider value={value}>
      {children}
      {confirmed ? (
        <BookingConfirmedOverlay
          details={confirmed}
          busy={busy}
          onMessage={() => void handleMessageArtisan()}
          onViewDetails={handleViewBookingDetails}
        />
      ) : null}
    </BookingConfirmedContext.Provider>
  );
}

export function useBookingConfirmed() {
  const context = useContext(BookingConfirmedContext);

  if (!context) {
    throw new Error('useBookingConfirmed must be used within BookingConfirmedProvider');
  }

  return context;
}

export function useBookingConfirmedOptional() {
  return useContext(BookingConfirmedContext);
}
