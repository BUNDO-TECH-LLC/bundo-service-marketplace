import { Router } from 'express';
import { Role } from '@prisma/client';
import { verifyFirebaseToken } from '../../middlewares/verifyFirebaseToken';
import { requireRole } from '../../middlewares/requireRole';
import { asyncHandler } from '../../middlewares/errorHandler';
import {
  BadGatewayError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
  UnauthorizedError,
  ValidationError,
} from '../../utils/errors';
import { throwOnServiceStatus } from '../../utils/resultErrors';
import {
  getSupportedPayoutBanks,
  getPaymentForBooking,
  initializeBookingPayment,
  markPaymentReferencePaid,
  syncPayoutFromPaystackTransfer,
  verifyPaymentReferenceForUser,
} from './payments.service';
import { verifyPaystackSignature } from './paystack.service';

const router = Router();

const paystackUnavailable = new ServiceUnavailableError(
  'Paystack is not configured',
  'PAYSTACK_NOT_CONFIGURED'
);

router.get(
  '/payments/banks',
  verifyFirebaseToken,
  asyncHandler(async (_req, res) => {
    const result = await getSupportedPayoutBanks();

    throwOnServiceStatus(result.status, {
      paystack_not_configured: paystackUnavailable,
      paystack_error: new BadGatewayError(
        'Could not load payout banks right now. Try again in a moment.',
        'PAYSTACK_ERROR'
      ),
    });

    res.json({
      message: 'Supported payout banks fetched',
      banks: result.banks,
    });
  })
);

router.post(
  '/payments/initialize',
  verifyFirebaseToken,
  requireRole(Role.CUSTOMER),
  asyncHandler(async (req, res) => {
    const { bookingId } = req.body;

    if (!bookingId || typeof bookingId !== 'string') {
      throw new ValidationError('bookingId is required');
    }

    try {
      const result = await initializeBookingPayment({
        bookingId,
        customerId: (req as any).user.firebaseUid,
      });

      throwOnServiceStatus(result.status, {
        paystack_not_configured: paystackUnavailable,
        missing_booking: new NotFoundError('Booking'),
        forbidden: new ForbiddenError('You can only pay for your own booking'),
        not_payable: new ConflictError('Cancelled or declined bookings cannot be paid for'),
        missing_email: new ValidationError('Your account needs an email before payment can start'),
      });

      if (result.status === 'already_paid') {
        res.json({
          message: 'Payment already received',
          payment: result.payment,
          authorizationUrl: result.payment?.authorizationUrl,
        });
        return;
      }

      if (result.status !== 'initialized') {
        throw new Error('Unexpected payment initialization result');
      }

      res.status(201).json({
        message: 'Payment initialized',
        payment: result.payment,
        authorizationUrl: result.payment.authorizationUrl,
      });
    } catch (error) {
      if (error instanceof BadGatewayError || error instanceof ServiceUnavailableError) {
        throw error;
      }

      const message = error instanceof Error ? error.message : 'Paystack initialization failed';
      throw new BadGatewayError(`Could not start payment with Paystack: ${message}`);
    }
  })
);

router.get(
  '/payments/:bookingId',
  verifyFirebaseToken,
  asyncHandler(async (req, res) => {
    const result = await getPaymentForBooking({
      bookingId: String(req.params.bookingId),
      firebaseUid: (req as any).user.firebaseUid,
    });

    throwOnServiceStatus(result.status, {
      missing_booking: new NotFoundError('Booking'),
      forbidden: new ForbiddenError('You can only view payments that belong to your booking'),
    });

    res.json({
      message: 'Payment fetched',
      payment: result.payment,
    });
  })
);

router.post(
  '/payments/verify-reference',
  verifyFirebaseToken,
  asyncHandler(async (req, res) => {
    const { reference } = req.body;

    if (!reference || typeof reference !== 'string') {
      throw new ValidationError('reference is required');
    }

    const result = await verifyPaymentReferenceForUser({
      reference,
      firebaseUid: (req as any).user.firebaseUid,
    });

    throwOnServiceStatus(result.status, {
      missing_payment: new NotFoundError('Payment'),
      forbidden: new ForbiddenError('You can only verify your own payment'),
      verification_failed: new ConflictError(
        'Payment has not been confirmed by Paystack',
        'PAYMENT_VERIFICATION_FAILED'
      ),
      paystack_not_configured: new ServiceUnavailableError(
        'Payment confirmation is unavailable: Paystack is not configured, or simulation is disabled. Set PAYSTACK_SECRET_KEY for real payments, or ALLOW_PAYMENT_SIMULATION=true in non-production only for local demos.',
        'PAYSTACK_NOT_CONFIGURED'
      ),
    });

    if (result.status !== 'verified') {
      throw new Error('Unexpected payment verification result');
    }

    res.json({
      message: 'Payment verified',
      payment: result.payment,
      booking: result.booking,
    });
  })
);

router.post(
  '/webhooks/paystack',
  asyncHandler(async (req, res) => {
    const signature = req.header('x-paystack-signature');
    const rawBody = (req as any).rawBody || '';

    if (!verifyPaystackSignature(rawBody, signature)) {
      throw new UnauthorizedError('Invalid Paystack signature');
    }

    const event = req.body?.event;
    const reference = req.body?.data?.reference ? String(req.body.data.reference) : null;

    if (event === 'charge.success' && reference) {
      await markPaymentReferencePaid(reference);
    }

    if (
      reference &&
      (event === 'transfer.success' || event === 'transfer.failed' || event === 'transfer.reversed')
    ) {
      await syncPayoutFromPaystackTransfer({
        reference,
        event,
      });
    }

    res.json({ received: true });
  })
);

export default router;
