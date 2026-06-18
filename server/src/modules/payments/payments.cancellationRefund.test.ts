import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BookingStatus,
  LedgerEntryType,
  PaymentStatus,
  Role,
  UserStatus,
} from '@prisma/client';

const findUnique = vi.fn();
const paymentUpdate = vi.fn();
const ledgerCreate = vi.fn();
const userFindMany = vi.fn();
const transaction = vi.fn();
const createNotifications = vi.fn();
const createPaystackRefund = vi.fn();

vi.mock('../../db/client', () => ({
  default: {
    booking: { findUnique },
    payment: { findUnique, update: paymentUpdate },
    user: { findMany: userFindMany },
    $transaction: transaction,
  },
}));

vi.mock('../notifications/notifications.service', () => ({
  createNotifications,
}));

vi.mock('./paystack.service', () => ({
  isPaystackConfigured: vi.fn(() => true),
  createPaystackRefund,
}));

describe('cancellation refund flow', () => {
  beforeEach(() => {
    findUnique.mockReset();
    paymentUpdate.mockReset();
    ledgerCreate.mockReset();
    userFindMany.mockReset();
    transaction.mockReset();
    createNotifications.mockReset();
    createPaystackRefund.mockReset();
  });

  const heldBooking = {
    id: 'booking-1',
    customerId: 'customer-uid',
    offering: { title: 'Plumbing repair' },
    customerUser: { firebaseUid: 'customer-uid' },
    payment: {
      id: 'payment-1',
      status: PaymentStatus.PAID_HELD,
      amount: 15_000,
      paystackReference: 'ref-123',
      releasedAmount: 0,
    },
  };

  it('queues REFUND_REQUESTED when a held payment booking is cancelled', async () => {
    findUnique.mockResolvedValueOnce(heldBooking);
    userFindMany.mockResolvedValueOnce([{ firebaseUid: 'admin-uid' }]);
    transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        payment: { update: paymentUpdate },
        ledgerEntry: { create: ledgerCreate },
      })
    );
    paymentUpdate.mockResolvedValueOnce({
      ...heldBooking.payment,
      status: PaymentStatus.REFUND_REQUESTED,
    });

    const { refundBookingPaymentOnCancel } = await import('./payments.service');
    const result = await refundBookingPaymentOnCancel('booking-1');

    expect(result.status).toBe('refund_requested');
    expect(paymentUpdate).toHaveBeenCalledWith({
      where: { id: 'payment-1' },
      data: { status: PaymentStatus.REFUND_REQUESTED },
    });
    expect(ledgerCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bookingId: 'booking-1',
        paymentId: 'payment-1',
        type: LedgerEntryType.ADJUSTMENT,
        amount: 15_000,
      }),
    });
    expect(createNotifications).toHaveBeenCalledTimes(2);
    expect(createPaystackRefund).not.toHaveBeenCalled();
  });

  it('marks pending payments as failed without requesting a refund', async () => {
    findUnique.mockResolvedValueOnce({
      ...heldBooking,
      payment: {
        ...heldBooking.payment,
        status: PaymentStatus.PAYMENT_PENDING,
      },
    });
    paymentUpdate.mockResolvedValueOnce({
      ...heldBooking.payment,
      status: PaymentStatus.FAILED,
    });

    const { refundBookingPaymentOnCancel } = await import('./payments.service');
    const result = await refundBookingPaymentOnCancel('booking-1');

    expect(result.status).toBe('cancelled_pending');
    expect(paymentUpdate).toHaveBeenCalledWith({
      where: { id: 'payment-1' },
      data: { status: PaymentStatus.FAILED },
    });
    expect(createPaystackRefund).not.toHaveBeenCalled();
  });

  it('processes Paystack refund when admin approves a cancellation refund', async () => {
    const refundRequestedPayment = {
      id: 'payment-1',
      bookingId: 'booking-1',
      customerId: 'customer-uid',
      amount: 15_000,
      status: PaymentStatus.REFUND_REQUESTED,
      paystackReference: 'ref-123',
      releasedAmount: 0,
      booking: {
        id: 'booking-1',
        status: BookingStatus.CANCELLED,
        offering: { title: 'Plumbing repair' },
      },
    };

    findUnique.mockResolvedValueOnce(refundRequestedPayment);
    createPaystackRefund.mockResolvedValueOnce({
      data: { transaction_reference: 'refund-ref-456' },
    });
    transaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        payment: { update: paymentUpdate },
        ledgerEntry: { create: ledgerCreate },
      })
    );
    paymentUpdate.mockResolvedValueOnce({
      ...refundRequestedPayment,
      status: PaymentStatus.REFUNDED,
    });

    const { approveCancellationRefund } = await import('./payments.service');
    const result = await approveCancellationRefund({
      paymentId: 'payment-1',
      adminId: 'admin-uid',
      resolution: 'Verified cancellation',
    });

    expect(result.status).toBe('refunded');
    expect(createPaystackRefund).toHaveBeenCalledWith({
      transactionReference: 'ref-123',
      customerNote: 'Verified cancellation',
    });
    expect(paymentUpdate).toHaveBeenCalledWith({
      where: { id: 'payment-1' },
      data: {
        status: PaymentStatus.REFUNDED,
        platformFee: 0,
        providerEarning: 0,
      },
    });
    expect(ledgerCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: LedgerEntryType.CUSTOMER_REFUND,
        amount: 15_000,
      }),
    });
    expect(createNotifications).toHaveBeenCalledTimes(1);
  });

  it('rejects approval when payment is not REFUND_REQUESTED', async () => {
    findUnique.mockResolvedValueOnce({
      ...heldBooking.payment,
      booking: {
        id: 'booking-1',
        status: BookingStatus.CANCELLED,
        offering: { title: 'Plumbing repair' },
      },
      status: PaymentStatus.PAID_HELD,
    });

    const { approveCancellationRefund } = await import('./payments.service');
    const result = await approveCancellationRefund({
      paymentId: 'payment-1',
      adminId: 'admin-uid',
    });

    expect(result.status).toBe('not_refund_requested');
    expect(createPaystackRefund).not.toHaveBeenCalled();
  });
});
