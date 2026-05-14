import { Router } from 'express';
import { Role } from '@prisma/client';
import { verifyFirebaseToken } from '../../middlewares/verifyFirebaseToken';
import { requireRole } from '../../middlewares/requireRole';
import {
  getSupportedPayoutBanks,
  getPaymentForBooking,
  initializeBookingPayment,
  markPaymentReferencePaid,
  verifyPaymentReferenceForUser,
} from './payments.service';
import { verifyPaystackSignature } from './paystack.service';

const router = Router();

router.get('/payments/banks', verifyFirebaseToken, async (_req, res) => {
  const result = await getSupportedPayoutBanks();

  if (result.status === 'paystack_not_configured') {
    return res.status(503).json({ message: 'Paystack is not configured' });
  }

  return res.json({
    message: 'Supported payout banks fetched',
    banks: result.banks,
  });
});

router.post(
  '/payments/initialize',
  verifyFirebaseToken,
  requireRole(Role.CUSTOMER),
  async (req, res) => {
    const { bookingId } = req.body;

    if (!bookingId || typeof bookingId !== 'string') {
      return res.status(400).json({ message: 'bookingId is required' });
    }

    const result = await initializeBookingPayment({
      bookingId,
      customerId: (req as any).user.firebaseUid,
    });

    if (result.status === 'paystack_not_configured') {
      return res.status(503).json({ message: 'Paystack is not configured' });
    }

    if (result.status === 'missing_booking') {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (result.status === 'forbidden') {
      return res.status(403).json({ message: 'You can only pay for your own booking' });
    }

    if (result.status === 'not_payable') {
      return res.status(409).json({ message: 'Cancelled or declined bookings cannot be paid for' });
    }

    if (result.status === 'missing_email') {
      return res.status(400).json({ message: 'Your account needs an email before payment can start' });
    }

    if (result.status === 'already_paid') {
      return res.json({
        message: 'Payment already received',
        payment: result.payment,
        authorizationUrl: result.payment.authorizationUrl,
      });
    }

    return res.status(201).json({
      message: 'Payment initialized',
      payment: result.payment,
      authorizationUrl: result.payment.authorizationUrl,
    });
  }
);

router.get('/payments/:bookingId', verifyFirebaseToken, async (req, res) => {
  const result = await getPaymentForBooking({
    bookingId: String(req.params.bookingId),
    firebaseUid: (req as any).user.firebaseUid,
  });

  if (result.status === 'missing_booking') {
    return res.status(404).json({ message: 'Booking not found' });
  }

  if (result.status === 'forbidden') {
    return res.status(403).json({ message: 'You can only view payments that belong to your booking' });
  }

  return res.json({
    message: 'Payment fetched',
    payment: result.payment,
  });
});

router.post('/payments/verify-reference', verifyFirebaseToken, async (req, res) => {
  const { reference } = req.body;

  if (!reference || typeof reference !== 'string') {
    return res.status(400).json({ message: 'reference is required' });
  }

  const result = await verifyPaymentReferenceForUser({
    reference,
    firebaseUid: (req as any).user.firebaseUid,
  });

  if (result.status === 'missing_payment') {
    return res.status(404).json({ message: 'Payment not found' });
  }

  if (result.status === 'forbidden') {
    return res.status(403).json({ message: 'You can only verify your own payment' });
  }

  if (result.status === 'verification_failed') {
    return res.status(409).json({ message: 'Payment has not been confirmed by Paystack' });
  }

  return res.json({
    message: 'Payment verified',
    payment: result.payment,
  });
});

router.post('/webhooks/paystack', async (req, res) => {
  const signature = req.header('x-paystack-signature');
  const rawBody = (req as any).rawBody || '';

  if (!verifyPaystackSignature(rawBody, signature)) {
    return res.status(401).json({ message: 'Invalid Paystack signature' });
  }

  if (req.body?.event === 'charge.success' && req.body?.data?.reference) {
    await markPaymentReferencePaid(String(req.body.data.reference));
  }

  return res.json({ received: true });
});

export default router;
