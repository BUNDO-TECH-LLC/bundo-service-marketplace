import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { OnboardingIntent, Role } from '@prisma/client';
import { verifyFirebaseToken } from '../../middlewares/verifyFirebaseToken';
import { asyncHandler } from '../../middlewares/errorHandler';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../utils/errors';
import { throwOnServiceStatus } from '../../utils/resultErrors';
import {
  completeCustomerProfile,
  deleteUserAccount,
  serializeUser,
  setUserOnboardingIntent,
  updateUserFcmToken,
  updateUserNotificationPreferences,
  updateUserPhone,
  updateUserRole,
} from './users.service';
import { validateEmailFormat, validateSignupEmail } from './emailValidation.service';
import {
  assertEmailAvailableForSignup,
  assertPhoneAvailableForSignup,
  emailAccountExists,
} from './signupAvailability.service';

const router = Router();

const signupProbeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === 'production' ? 20 : 200,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

router.post(
  '/validate-email',
  signupProbeLimiter,
  asyncHandler(async (req, res) => {
    const { email, purpose } = req.body;

    if (typeof email !== 'string') {
      throw new ValidationError('email is required');
    }

    const result = await validateSignupEmail(email);

    if (purpose === 'signup') {
      await assertEmailAvailableForSignup(result.email);
    }

    res.json({
      message: 'Email looks valid',
      email: result.email,
      available: purpose === 'signup' ? true : undefined,
    });
  })
);

router.post(
  '/validate-signup-phone',
  signupProbeLimiter,
  asyncHandler(async (req, res) => {
    const { phone } = req.body;

    if (typeof phone !== 'string' || !phone.trim()) {
      throw new ValidationError('phone is required');
    }

    await assertPhoneAvailableForSignup(phone);

    res.json({
      message: 'Phone number is available',
    });
  })
);

router.post(
  '/email-account-status',
  signupProbeLimiter,
  asyncHandler(async (req, res) => {
    const { email } = req.body;

    if (typeof email !== 'string') {
      throw new ValidationError('email is required');
    }

    const result = validateEmailFormat(email);
    const exists = await emailAccountExists(result.email);

    res.json({
      message: exists ? 'Account found' : 'No account found',
      email: result.email,
      exists,
    });
  })
);

router.patch(
  '/role',
  verifyFirebaseToken,
  asyncHandler(async (req, res) => {
    const { role } = req.body;

    if (![Role.CUSTOMER, Role.ARTISAN].includes(role)) {
      throw new ValidationError('Role must be CUSTOMER or ARTISAN');
    }

    const result = await updateUserRole((req as any).user.firebaseUid, role);

    throwOnServiceStatus(result.status, {
      missing_user: new NotFoundError('User'),
      locked_role: new ConflictError(
        'This role change requires admin support. Artisan accounts remain under verification control.',
        'LOCKED_ROLE'
      ),
    });

    res.json({
      message: 'Role updated',
      user: result.user,
    });
  })
);

router.patch(
  '/fcm-token',
  verifyFirebaseToken,
  asyncHandler(async (req, res) => {
    const { fcmToken } = req.body;

    if (typeof fcmToken !== 'string' || !fcmToken.trim()) {
      throw new ValidationError('fcmToken is required');
    }

    const user = await updateUserFcmToken((req as any).user.firebaseUid, fcmToken.trim());

    res.json({
      message: 'FCM token updated',
      user,
    });
  })
);

router.delete(
  '/fcm-token',
  verifyFirebaseToken,
  asyncHandler(async (req, res) => {
    const user = await updateUserFcmToken((req as any).user.firebaseUid, null);

    res.json({
      message: 'FCM token removed',
      user,
    });
  })
);

router.patch(
  '/phone',
  verifyFirebaseToken,
  asyncHandler(async (req, res) => {
    const { phone } = req.body;

    if (typeof phone !== 'string') {
      throw new ValidationError('phone is required');
    }

    const user = await updateUserPhone((req as any).user.firebaseUid, phone);

    res.json({
      message: 'Phone updated',
      user,
    });
  })
);

router.patch(
  '/onboarding-intent',
  verifyFirebaseToken,
  asyncHandler(async (req, res) => {
    const { intent } = req.body;

    if (intent !== null && intent !== OnboardingIntent.ARTISAN) {
      throw new ValidationError('intent must be ARTISAN or null');
    }

    const result = await setUserOnboardingIntent((req as any).user.firebaseUid, intent);

    if (result.status === 'already_artisan') {
      res.json({
        message: 'Artisan account already active',
        user: serializeUser(result.user),
      });
      return;
    }

    throwOnServiceStatus(result.status, {
      missing_user: new NotFoundError('User'),
      locked_role: new ForbiddenError('This account cannot start artisan onboarding.'),
    });

    res.json({
      message: intent ? 'Artisan onboarding started' : 'Artisan onboarding intent cleared',
      user: serializeUser(result.user!),
    });
  })
);

router.patch(
  '/profile',
  verifyFirebaseToken,
  asyncHandler(async (req, res) => {
    const { phone, state, area, address } = req.body;

    if (typeof phone !== 'string') {
      throw new ValidationError('phone is required');
    }

    if (typeof state !== 'string') {
      throw new ValidationError('state is required');
    }

    const result = await completeCustomerProfile((req as any).user.firebaseUid, {
      phone,
      state,
      ...(typeof area === 'string' ? { area } : {}),
      ...(typeof address === 'string' ? { address } : {}),
    });

    throwOnServiceStatus(result.status, {
      missing_user: new NotFoundError('User'),
      not_customer: new ForbiddenError('Only customer accounts use this profile form.'),
    });

    res.json({
      message: 'Profile saved',
      user: serializeUser(result.user!),
    });
  })
);

router.patch(
  '/notification-preferences',
  verifyFirebaseToken,
  asyncHandler(async (req, res) => {
    const { bookings, messages, marketing } = req.body;
    const patch: Record<string, boolean> = {};

    if (bookings !== undefined) {
      if (typeof bookings !== 'boolean') throw new ValidationError('bookings must be a boolean');
      patch.bookings = bookings;
    }
    if (messages !== undefined) {
      if (typeof messages !== 'boolean') throw new ValidationError('messages must be a boolean');
      patch.messages = messages;
    }
    if (marketing !== undefined) {
      if (typeof marketing !== 'boolean') throw new ValidationError('marketing must be a boolean');
      patch.marketing = marketing;
    }

    if (!Object.keys(patch).length) {
      throw new ValidationError('Provide at least one preference to update');
    }

    const result = await updateUserNotificationPreferences((req as any).user.firebaseUid, patch);

    throwOnServiceStatus(result.status, {
      missing_user: new NotFoundError('User'),
    });

    res.json({
      message: 'Notification preferences updated',
      preferences: result.preferences,
    });
  })
);

router.delete(
  '/account',
  verifyFirebaseToken,
  asyncHandler(async (req, res) => {
    const { confirm } = req.body;

    if (confirm !== 'DELETE') {
      throw new ValidationError('Send { "confirm": "DELETE" } to permanently delete your account.');
    }

    const result = await deleteUserAccount((req as any).user.firebaseUid);

    throwOnServiceStatus(result.status, {
      missing_user: new NotFoundError('User'),
      locked_role: new ConflictError('Admin accounts cannot be deleted from the app.', 'LOCKED_ROLE'),
      active_bookings: new ConflictError(
        'Finish or cancel your active bookings before deleting your account.',
        'ACTIVE_BOOKINGS'
      ),
      held_payments: new ConflictError(
        'Resolve held payments before deleting your account. Contact support if you need help.',
        'HELD_PAYMENTS'
      ),
      open_disputes: new ConflictError(
        'Resolve open disputes before deleting your account.',
        'OPEN_DISPUTES'
      ),
    });

    res.json({ message: 'Account deleted' });
  })
);

export default router;
