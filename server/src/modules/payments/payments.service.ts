import {
  BookingStatus,
  DisputeStatus,
  LedgerEntryType,
  NotificationType,
  PaymentStatus,
  PayoutStatus,
  Prisma,
} from '@prisma/client';
import { env } from '../../config/env';
import db from '../../db/client';
import logger from '../../utils/logger';
import { resolvePaymentConfirmationGate } from './paymentConfirmPolicy';
import { getArtisanProfileByUserId } from '../artisans/artisans.service';
import { workspaceBookingLink, workspaceLink } from '../../lib/appLinks';
import { createNotifications } from '../notifications/notifications.service';
import {
  createPaystackTransferRecipient,
  createPaystackRefund,
  initializePaystackTransaction,
  initiatePaystackTransfer,
  isPaystackConfigured,
  listPaystackBanks,
  verifyPaystackTransaction,
} from './paystack.service';

const toKobo = (amount: number) => amount * 100;

const platformFeePercent = () => {
  const parsed = Number(env.PLATFORM_FEE_PERCENT);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 10;
};

const paymentReference = (bookingId: string) =>
  `bundo_${bookingId}_${Date.now()}`;

const payoutReference = (bookingId: string) =>
  `bundo_payout_${bookingId}_${Date.now()}`;

export const getSupportedPayoutBanks = async () => {
  if (!isPaystackConfigured()) {
    return { status: 'paystack_not_configured' as const };
  }

  let response;

  try {
    response = await listPaystackBanks();
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Could not load payout banks from Paystack';
    return { status: 'paystack_error' as const, message };
  }

  const banks = response.data
    .filter(
      (bank) =>
        bank.active &&
        bank.country.toLowerCase() === 'nigeria' &&
        bank.currency === 'NGN' &&
        bank.supports_transfer
    )
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((bank) => ({
      name: bank.name,
      code: bank.code,
    }));

  return { status: 'found' as const, banks };
};

export const initializeBookingPayment = async (input: {
  bookingId: string;
  customerId: string;
}) => {
  if (!isPaystackConfigured()) {
    return { status: 'paystack_not_configured' as const };
  }

  const booking = await db.booking.findUnique({
    where: { id: input.bookingId },
    include: {
      customerUser: true,
      artisan: true,
      offering: true,
      payment: true,
    },
  });

  if (!booking) {
    return { status: 'missing_booking' as const };
  }

  if (booking.customerId !== input.customerId) {
    return { status: 'forbidden' as const };
  }

  const blockedStatuses: BookingStatus[] = [
    BookingStatus.CANCELLED,
    BookingStatus.DECLINED,
  ];

  if (blockedStatuses.includes(booking.status)) {
    return { status: 'not_payable' as const };
  }

  if (!booking.customerUser.email) {
    return { status: 'missing_email' as const };
  }

  const settledStatuses: PaymentStatus[] = [
    PaymentStatus.PAID_HELD,
    PaymentStatus.PARTIALLY_RELEASED,
    PaymentStatus.RELEASED,
  ];

  if (booking.payment && settledStatuses.includes(booking.payment.status)) {
    return { status: 'already_paid' as const, payment: booking.payment };
  }

  if (
    booking.payment?.status === PaymentStatus.PAYMENT_PENDING &&
    booking.payment.authorizationUrl
  ) {
    return { status: 'initialized' as const, payment: booking.payment };
  }

  const amount = booking.offering.priceFrom;
  const platformFee = Math.round(amount * (platformFeePercent() / 100));
  const providerEarning = amount - platformFee;
  const reference = booking.payment?.paystackReference || paymentReference(booking.id);

  const transaction = await initializePaystackTransaction({
    email: booking.customerUser.email,
    amountKobo: toKobo(amount),
    reference,
    metadata: {
      bookingId: booking.id,
      customerId: booking.customerId,
      artisanId: booking.artisanId,
    },
  });

  const payment = await db.payment.upsert({
    where: { bookingId: booking.id },
    update: {
      status: PaymentStatus.PAYMENT_PENDING,
      amount,
      platformFee,
      providerEarning,
      paystackReference: reference,
      paystackAccessCode: transaction.data.access_code,
      authorizationUrl: transaction.data.authorization_url,
    },
    create: {
      bookingId: booking.id,
      customerId: booking.customerId,
      artisanId: booking.artisanId,
      amount,
      platformFee,
      providerEarning,
      status: PaymentStatus.PAYMENT_PENDING,
      paystackReference: reference,
      paystackAccessCode: transaction.data.access_code,
      authorizationUrl: transaction.data.authorization_url,
    },
  });

  return { status: 'initialized' as const, payment };
};

export const getPaymentForBooking = async (input: {
  bookingId: string;
  firebaseUid: string;
}) => {
  const booking = await db.booking.findUnique({
    where: { id: input.bookingId },
    include: { payment: true, artisan: true },
  });

  if (!booking) {
    return { status: 'missing_booking' as const };
  }

  const isCustomer = booking.customerId === input.firebaseUid;
  const isArtisan = booking.artisan.userId === input.firebaseUid;

  if (!isCustomer && !isArtisan) {
    return { status: 'forbidden' as const };
  }

  return { status: 'found' as const, payment: booking.payment };
};

async function paymentBookingSummary(bookingId: string) {
  return db.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      offering: { select: { title: true } },
      artisan: { select: { displayName: true } },
    },
  });
}

export const verifyPaymentReferenceForUser = async (input: {
  reference: string;
  firebaseUid: string;
}) => {
  const payment = await db.payment.findUnique({
    where: { paystackReference: input.reference },
    include: {
      booking: {
        include: {
          artisan: true,
        },
      },
    },
  });

  if (!payment) {
    return { status: 'missing_payment' as const };
  }

  const isCustomer = payment.booking.customerId === input.firebaseUid;
  const isArtisan = payment.booking.artisan.userId === input.firebaseUid;

  if (!isCustomer && !isArtisan) {
    return { status: 'forbidden' as const };
  }

  const result = await markPaymentReferencePaid(input.reference);

  if (result.status === 'missing_payment') {
    return result;
  }

  if (result.status === 'verification_failed') {
    return result;
  }

  if (result.status === 'paystack_not_configured') {
    return result;
  }

  if (result.status === 'already_processed' || result.status === 'processed') {
    const booking = await paymentBookingSummary(result.payment.bookingId);
    return { status: 'verified' as const, payment: result.payment, booking };
  }

  return result;
};

export const markPaymentReferencePaid = async (reference: string) => {
  const payment = await db.payment.findUnique({
    where: { paystackReference: reference },
  });

  if (!payment) {
    return { status: 'missing_payment' as const };
  }

  const processedStatuses: PaymentStatus[] = [
    PaymentStatus.PAID_HELD,
    PaymentStatus.PARTIALLY_REFUNDED,
    PaymentStatus.PARTIALLY_RELEASED,
    PaymentStatus.RELEASED,
    PaymentStatus.REFUNDED,
  ];

  if (processedStatuses.includes(payment.status)) {
    return { status: 'already_processed' as const, payment };
  }

  const gate = resolvePaymentConfirmationGate({
    paystackConfigured: isPaystackConfigured(),
    nodeEnv: env.NODE_ENV,
    allowPaymentSimulation: env.ALLOW_PAYMENT_SIMULATION === 'true',
  });

  if (gate.action === 'reject') {
    logger.warn(
      { reference, bookingId: payment.bookingId },
      'Payment confirmation blocked: Paystack not configured and simulation disabled'
    );
    return { status: 'paystack_not_configured' as const };
  }

  if (gate.action === 'accept_without_paystack_verify') {
    logger.warn(
      { reference, bookingId: payment.bookingId, mode: gate.mode },
      'Confirming payment without Paystack verification (ALLOW_PAYMENT_SIMULATION)'
    );
  }

  if (gate.action === 'verify_with_paystack_api') {
    const verified = await verifyPaystackTransaction(reference);

    if (
      verified.data.status !== 'success' ||
      verified.data.amount !== toKobo(payment.amount)
    ) {
      await db.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.FAILED },
      });

      return { status: 'verification_failed' as const };
    }
  }

  const updated = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const paid = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.PAID_HELD,
        paidAt: new Date(),
      },
    });

    await tx.ledgerEntry.createMany({
      data: [
        {
          bookingId: payment.bookingId,
          paymentId: payment.id,
          type: LedgerEntryType.CUSTOMER_PAYMENT,
          amount: payment.amount,
          note: 'Customer payment received and held for service completion',
        },
        {
          bookingId: payment.bookingId,
          paymentId: payment.id,
          type: LedgerEntryType.PLATFORM_FEE,
          amount: payment.platformFee,
          note: 'Bundo platform fee',
        },
        {
          bookingId: payment.bookingId,
          paymentId: payment.id,
          type: LedgerEntryType.PROVIDER_EARNING,
          amount: payment.providerEarning,
          note: 'Provider earning pending release',
        },
      ],
    });

    return paid;
  });

  const booking = await db.booking.findUnique({
    where: { id: payment.bookingId },
    include: {
      artisan: true,
      offering: true,
    },
  });

  if (booking) {
    await createNotifications([
      {
        userId: booking.customerId,
        type: NotificationType.PAYMENT,
        title: 'Payment secured',
        body: `Your payment for ${booking.offering?.title || 'this booking'} is now held by Bundo.`,
        link: workspaceBookingLink(booking.id),
      },
      {
        userId: booking.artisan.userId,
        type: NotificationType.PAYMENT,
        title: 'Customer payment received',
        body: `Payment for ${booking.offering?.title || 'a booking'} is secured and pending completion.`,
        link: workspaceBookingLink(booking.id),
      },
    ]);
  }

  return { status: 'processed' as const, payment: updated };
};

function normalizeNigerianAccountNumber(raw: string) {
  return raw.replace(/\s+/g, '').replace(/-/g, '');
}

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
  );
}

export const createOrUpdatePayoutAccount = async (input: {
  artisanUserId: string;
  bankCode: string;
  bankName?: string;
  accountNumber: string;
  accountName?: string;
}) => {
  if (!isPaystackConfigured()) {
    return { status: 'paystack_not_configured' as const };
  }

  const artisan = await getArtisanProfileByUserId(input.artisanUserId);

  if (!artisan) {
    return { status: 'missing_artisan' as const };
  }

  const bankCode = input.bankCode.trim();
  const accountNumber = normalizeNigerianAccountNumber(input.accountNumber);
  const accountNameInput = input.accountName?.trim() || undefined;
  const bankNameInput = input.bankName?.trim() || undefined;

  if (!/^\d{10}$/.test(accountNumber)) {
    return {
      status: 'invalid_account_number' as const,
      message: 'Account number must be exactly 10 digits.',
    };
  }

  const existing = await db.providerPayoutAccount.findUnique({
    where: { artisanId: artisan.id },
  });

  if (
    existing &&
    existing.bankCode === bankCode &&
    existing.accountNumber === accountNumber
  ) {
    const account = await db.providerPayoutAccount.update({
      where: { artisanId: artisan.id },
      data: {
        isVerified: true,
        ...(bankNameInput !== undefined ? { bankName: bankNameInput } : {}),
        ...(accountNameInput !== undefined ? { accountName: accountNameInput } : {}),
      },
    });

    return { status: 'saved' as const, account };
  }

  let recipient;

  try {
    recipient = await createPaystackTransferRecipient({
      name: accountNameInput || artisan.displayName.trim() || 'Bundo artisan',
      accountNumber,
      bankCode,
    });
  } catch (error) {
    const rawMessage =
      error instanceof Error ? error.message : 'Could not verify bank account with Paystack';
    const message = rawMessage.toLowerCase().includes('account number')
      ? 'We could not verify this account number with the selected bank. Check the bank and 10-digit account number, then try again.'
      : rawMessage;
    return { status: 'paystack_error' as const, message };
  }

  const recipientCode = recipient.data?.recipient_code?.trim();

  if (!recipientCode) {
    return {
      status: 'paystack_error' as const,
      message: 'Paystack did not return a payout recipient code. Try again in a moment.',
    };
  }

  const bankName = bankNameInput || recipient.data.details?.bank_name;
  const accountName = accountNameInput || recipient.data.details?.account_name;
  const payoutAccountData = {
    bankCode,
    accountNumber,
    paystackRecipientCode: recipientCode,
    isVerified: true,
    ...(bankName !== undefined ? { bankName } : {}),
    ...(accountName !== undefined ? { accountName } : {}),
  };

  const recipientOwner = await db.providerPayoutAccount.findUnique({
    where: { paystackRecipientCode: recipientCode },
  });

  if (recipientOwner && recipientOwner.artisanId !== artisan.id) {
    return {
      status: 'paystack_error' as const,
      message:
        'This bank account is already linked to another Bundo profile. Use a different account or contact support.',
    };
  }

  try {
    if (existing) {
      const account = await db.providerPayoutAccount.update({
        where: { artisanId: artisan.id },
        data: payoutAccountData,
      });

      return { status: 'saved' as const, account };
    }

    const account = await db.providerPayoutAccount.create({
      data: {
        artisanId: artisan.id,
        ...payoutAccountData,
      },
    });

    return { status: 'saved' as const, account };
  } catch (error) {
    if (!isUniqueConstraintError(error)) {
      throw error;
    }

    const linked = await db.providerPayoutAccount.findUnique({
      where: { artisanId: artisan.id },
    });

    if (linked) {
      const account = await db.providerPayoutAccount.update({
        where: { artisanId: artisan.id },
        data: payoutAccountData,
      });

      return { status: 'saved' as const, account };
    }

    return {
      status: 'paystack_error' as const,
      message:
        'Could not save this payout account because it conflicts with an existing record. Try again or contact support.',
    };
  }
};

export const getPayoutAccountForArtisanUser = async (artisanUserId: string) => {
  const artisan = await getArtisanProfileByUserId(artisanUserId);

  if (!artisan) {
    return null;
  }

  return db.providerPayoutAccount.findUnique({
    where: { artisanId: artisan.id },
  });
};

export const releaseBookingPayment = async (bookingId: string) => {
  if (!isPaystackConfigured()) {
    return { status: 'paystack_not_configured' as const };
  }

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: {
      payment: true,
      artisan: {
        include: { payoutAccount: true },
      },
      payouts: true,
      disputes: true,
    },
  });

  if (!booking) {
    return { status: 'missing_booking' as const };
  }

  if (booking.status !== BookingStatus.COMPLETED) {
    return { status: 'booking_not_completed' as const };
  }

  if (!booking.artisan.payoutAccount?.isVerified) {
    return { status: 'missing_payout_account' as const };
  }

  if (
    booking.disputes.some((dispute) => {
      const blockingDisputeStatuses: DisputeStatus[] = [
        DisputeStatus.OPEN,
        DisputeStatus.UNDER_REVIEW,
      ];

      return blockingDisputeStatuses.includes(dispute.status);
    })
  ) {
    return { status: 'blocked_by_dispute' as const };
  }

  if (
    booking.payouts.some(
      (payout) =>
        payout.status === PayoutStatus.SENT || payout.status === PayoutStatus.PROCESSING
    )
  ) {
    return { status: 'already_released' as const };
  }

  const releasablePaymentStatuses: PaymentStatus[] = [
    PaymentStatus.PAID_HELD,
    PaymentStatus.PARTIALLY_REFUNDED,
  ];

  if (!booking.payment || !releasablePaymentStatuses.includes(booking.payment.status)) {
    return { status: 'payment_not_held' as const };
  }

  const reference = payoutReference(booking.id);

  let transfer;

  try {
    transfer = await initiatePaystackTransfer({
      amountKobo: toKobo(booking.payment.providerEarning),
      recipientCode: booking.artisan.payoutAccount.paystackRecipientCode,
      reason: `Bundo service payout for booking ${booking.id}`,
      reference,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Paystack could not send this payout';
    return { status: 'paystack_error' as const, message };
  }

  const result = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const payout = await tx.payout.create({
      data: {
        bookingId: booking.id,
        paymentId: booking.payment!.id,
        artisanId: booking.artisanId,
        amount: booking.payment!.providerEarning,
        status: PayoutStatus.PROCESSING,
        paystackTransferCode: transfer.data.transfer_code,
        paystackReference: reference,
        reason: 'Final service payout',
      },
    });

    const payment = await tx.payment.update({
      where: { id: booking.payment!.id },
      data: { status: PaymentStatus.RELEASED },
    });

    await tx.ledgerEntry.create({
      data: {
        bookingId: booking.id,
        paymentId: booking.payment!.id,
        type: LedgerEntryType.PROVIDER_PAYOUT,
        amount: booking.payment!.providerEarning,
        note: 'Provider earning released',
      },
    });

    return { payout, payment };
  });

  const offering = await db.offering.findUnique({
    where: { id: booking.offeringId },
    select: { title: true },
  });

  await createNotifications([
    {
      userId: booking.artisan.userId,
      type: NotificationType.PAYMENT,
      title: 'Payout released',
      body: `Your payout for ${offering?.title || 'a completed booking'} has been released.`,
      link: workspaceBookingLink(booking.id),
    },
    {
      userId: booking.customerId,
      type: NotificationType.PAYMENT,
      title: 'Provider payout sent',
      body: `Bundo has released payment for ${offering?.title || 'your completed booking'}.`,
      link: workspaceBookingLink(booking.id),
    },
  ]);

  return { status: 'released' as const, ...result };
};

export const syncPayoutFromPaystackTransfer = async (input: {
  reference: string;
  event: 'transfer.success' | 'transfer.failed' | 'transfer.reversed';
}) => {
  const payout = await db.payout.findFirst({
    where: { paystackReference: input.reference },
  });

  if (!payout) {
    logger.warn({ reference: input.reference, event: input.event }, 'Paystack transfer webhook: payout not found');
    return { status: 'missing_payout' as const };
  }

  if (input.event === 'transfer.success') {
    if (payout.status === PayoutStatus.SENT) {
      return { status: 'already_confirmed' as const, payout };
    }

    const updated = await db.payout.update({
      where: { id: payout.id },
      data: {
        status: PayoutStatus.SENT,
        sentAt: payout.sentAt ?? new Date(),
      },
    });

    return { status: 'confirmed' as const, payout: updated };
  }

  if (input.event === 'transfer.failed' || input.event === 'transfer.reversed') {
    const updated = await db.payout.update({
      where: { id: payout.id },
      data: { status: PayoutStatus.FAILED },
    });

    return { status: 'failed' as const, payout: updated };
  }

  return { status: 'ignored' as const };
};

export const createBookingDispute = async (input: {
  bookingId: string;
  raisedById: string;
  reason: string;
}) => {
  const booking = await db.booking.findUnique({
    where: { id: input.bookingId },
    include: { artisan: true },
  });

  if (!booking) {
    return { status: 'missing_booking' as const };
  }

  const isCustomer = booking.customerId === input.raisedById;
  const isArtisan = booking.artisan.userId === input.raisedById;

  if (!isCustomer && !isArtisan) {
    return { status: 'forbidden' as const };
  }

  const existingOpenDispute = await db.dispute.findFirst({
    where: {
      bookingId: booking.id,
      status: {
        in: [DisputeStatus.OPEN, DisputeStatus.UNDER_REVIEW],
      },
    },
  });

  if (existingOpenDispute) {
    return { status: 'already_open' as const, dispute: existingOpenDispute };
  }

  const dispute = await db.dispute.create({
    data: {
      bookingId: booking.id,
      raisedById: input.raisedById,
      reason: input.reason.trim(),
      status: DisputeStatus.OPEN,
    },
  });

  await createNotifications([
    {
      userId: booking.customerId,
      type: NotificationType.DISPUTE,
      title: 'Dispute opened',
      body: 'Your dispute has been recorded and is awaiting admin review.',
      link: workspaceBookingLink(booking.id),
    },
    {
      userId: booking.artisan.userId,
      type: NotificationType.DISPUTE,
      title: 'Booking dispute opened',
      body: 'A dispute has been opened on one of your bookings.',
      link: workspaceBookingLink(booking.id),
    },
  ]);

  return { status: 'created' as const, dispute };
};

export const resolveBookingDispute = async (input: {
  disputeId: string;
  action: 'RELEASE' | 'REFUND_FULL' | 'REFUND_PARTIAL';
  adminId: string;
  resolution?: string;
  refundAmount?: number;
}) => {
  if (!isPaystackConfigured()) {
    return { status: 'paystack_not_configured' as const };
  }

  const dispute = await db.dispute.findUnique({
    where: { id: input.disputeId },
    include: {
      booking: {
        include: {
          payment: true,
          artisan: {
            include: { payoutAccount: true },
          },
          payouts: true,
        },
      },
    },
  });

  if (!dispute) {
    return { status: 'missing_dispute' as const };
  }

  const unresolvedStatuses: DisputeStatus[] = [
    DisputeStatus.OPEN,
    DisputeStatus.UNDER_REVIEW,
  ];

  if (!unresolvedStatuses.includes(dispute.status)) {
    return { status: 'already_resolved' as const, dispute };
  }

  const payment = dispute.booking.payment;

  if (!payment) {
    return { status: 'missing_payment' as const };
  }

  const disputablePaymentStatuses: PaymentStatus[] = [
    PaymentStatus.PAID_HELD,
    PaymentStatus.PARTIALLY_REFUNDED,
  ];

  if (!disputablePaymentStatuses.includes(payment.status)) {
    return { status: 'payment_not_held' as const };
  }

  if (input.action === 'RELEASE') {
    const released = await releaseBookingPayment(dispute.booking.id);

    if (released.status !== 'released') {
      return released;
    }

    const updatedDispute = await db.dispute.update({
      where: { id: dispute.id },
      data: {
        status: DisputeStatus.RESOLVED_RELEASE,
        resolution:
          input.resolution?.trim() ||
          `Resolved by admin ${input.adminId}: payout released to artisan`,
      },
    });

    return {
      status: 'resolved_release' as const,
      dispute: updatedDispute,
      payment: released.payment,
      payout: released.payout,
    };
  }

  const refundAmount =
    input.action === 'REFUND_FULL'
      ? payment.amount
      : Math.round(Number(input.refundAmount || 0));

  if (!Number.isFinite(refundAmount) || refundAmount <= 0) {
    return { status: 'invalid_refund_amount' as const };
  }

  if (refundAmount > payment.amount) {
    return { status: 'refund_too_large' as const };
  }

  const refund = await createPaystackRefund({
    transactionReference: payment.paystackReference,
    customerNote:
      input.resolution?.trim() || 'Bundo marketplace dispute resolution refund',
    ...(refundAmount !== payment.amount
      ? { amountKobo: toKobo(refundAmount) }
      : {}),
  });

  const remainingGross = payment.amount - refundAmount;
  const nextPlatformFee =
    refundAmount === payment.amount
      ? 0
      : Math.round(remainingGross * (platformFeePercent() / 100));
  const nextProviderEarning = Math.max(remainingGross - nextPlatformFee, 0);
  const nextPaymentStatus =
    refundAmount === payment.amount
      ? PaymentStatus.REFUNDED
      : PaymentStatus.PARTIALLY_REFUNDED;
  const nextDisputeStatus =
    refundAmount === payment.amount
      ? DisputeStatus.RESOLVED_REFUND
      : DisputeStatus.RESOLVED_PARTIAL;

  const result = await db.$transaction(async (tx: Prisma.TransactionClient) => {
    const updatedPayment = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: nextPaymentStatus,
        platformFee: nextPlatformFee,
        providerEarning: nextProviderEarning,
      },
    });

    await tx.ledgerEntry.create({
      data: {
        bookingId: dispute.booking.id,
        paymentId: payment.id,
        type: LedgerEntryType.CUSTOMER_REFUND,
        amount: refundAmount,
        note:
          refundAmount === payment.amount
            ? 'Full refund issued after dispute resolution'
            : 'Partial refund issued after dispute resolution',
      },
    });

    const updatedDispute = await tx.dispute.update({
      where: { id: dispute.id },
      data: {
        status: nextDisputeStatus,
        resolution:
          input.resolution?.trim() ||
          `Resolved by admin ${input.adminId}: refunded ${refundAmount} NGN`,
      },
    });

    return {
      payment: updatedPayment,
      dispute: updatedDispute,
    };
  });

  await createNotifications([
    {
      userId: dispute.booking.customerId,
      type: NotificationType.DISPUTE,
      title:
        refundAmount === payment.amount
          ? 'Full refund issued'
          : 'Partial refund issued',
      body:
        refundAmount === payment.amount
          ? 'Bundo issued a full refund after dispute resolution.'
          : `Bundo issued a partial refund of ${refundAmount} NGN after dispute resolution.`,
      link: workspaceBookingLink(dispute.booking.id),
    },
    {
      userId: dispute.booking.artisan.userId,
      type: NotificationType.DISPUTE,
      title: 'Dispute resolved',
      body:
        refundAmount === payment.amount
          ? 'A disputed booking was resolved with a full refund to the customer.'
          : `A disputed booking was resolved with a partial refund of ${refundAmount} NGN.`,
      link: workspaceBookingLink(dispute.booking.id),
    },
  ]);

  return {
    status: 'resolved_refund' as const,
    ...result,
    refundReference: refund.data.transaction_reference,
  };
};
