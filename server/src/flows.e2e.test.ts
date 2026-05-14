import { existsSync } from 'node:fs';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { Prisma, Role, UserStatus } from '@prisma/client';
import db from './db/client';
import { createBooking } from './modules/bookings/bookings.service';

const E2E_SLUG = 'e2e-pay-category';
const E2E_CUSTOMER_UID = 'e2e-payment-customer';
const E2E_ARTISAN_UID = 'e2e-payment-artisan';

vi.mock('./middlewares/verifyFirebaseToken', () => ({
  verifyFirebaseToken: (req: any, _res: any, next: any) => {
    const mode = String(req.headers['x-e2e-auth'] || '');
    if (mode === 'artisan') {
      req.user = {
        firebaseUid: E2E_ARTISAN_UID,
        email: 'e2e.payflow.artisan@gmail.com',
        phone: null,
        role: Role.ARTISAN,
        status: UserStatus.ACTIVE,
        fcmToken: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      next();
      return;
    }
    if (mode === 'pay-customer') {
      req.user = {
        firebaseUid: E2E_CUSTOMER_UID,
        email: 'e2e.payflow.customer@gmail.com',
        phone: null,
        role: Role.CUSTOMER,
        status: UserStatus.ACTIVE,
        fcmToken: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      next();
      return;
    }
    req.user = {
      firebaseUid: 'e2e-chat-customer',
      email: 'e2e.payflow.chat@gmail.com',
      phone: null,
      role: Role.CUSTOMER,
      status: UserStatus.ACTIVE,
      fcmToken: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    next();
  },
}));

import { createApp } from './createApp';

const hasDotEnv = existsSync(path.join(process.cwd(), '.env'));
const hasCloudinary = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
);
const hasPaystack =
  Boolean(process.env.PAYSTACK_SECRET_KEY && process.env.PAYSTACK_CALLBACK_URL) &&
  Boolean(process.env.DATABASE_URL);

const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

async function postToCloudinary(signBody: {
  upload: {
    cloudName: string;
    apiKey: string;
    timestamp: number;
    folder: string;
    signature: string;
  };
}) {
  const fd = new FormData();
  fd.append('file', new Blob([tinyPng]), 'e2e.png');
  fd.append('api_key', signBody.upload.apiKey);
  fd.append('timestamp', String(signBody.upload.timestamp));
  fd.append('folder', signBody.upload.folder);
  fd.append('signature', signBody.upload.signature);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${signBody.upload.cloudName}/image/upload`,
    { method: 'POST', body: fd }
  );
  const data = (await res.json()) as { secure_url?: string; public_id?: string; error?: { message?: string } };
  return { res, data };
}

async function wipeE2EPaymentFixture() {
  const uids = [E2E_CUSTOMER_UID, E2E_ARTISAN_UID, 'e2e-chat-customer'];

  await db.notification.deleteMany({
    where: { userId: { in: uids } },
  });

  await db.ledgerEntry.deleteMany({
    where: { booking: { customerId: E2E_CUSTOMER_UID } },
  });
  await db.payment.deleteMany({ where: { customerId: E2E_CUSTOMER_UID } });
  await db.booking.deleteMany({ where: { customerId: E2E_CUSTOMER_UID } });

  const artisan = await db.artisanProfile.findUnique({ where: { userId: E2E_ARTISAN_UID } });

  const conversationOr: NonNullable<Prisma.ConversationWhereInput['OR']> = [
    { customerId: E2E_CUSTOMER_UID },
  ];
  if (artisan) {
    conversationOr.push({ artisanId: artisan.id });
  }

  const conversations = await db.conversation.findMany({
    where: { OR: conversationOr },
    select: { id: true },
  });

  if (conversations.length) {
    const ids = conversations.map((c) => c.id);
    await db.message.deleteMany({ where: { conversationId: { in: ids } } });
    await db.conversation.deleteMany({ where: { id: { in: ids } } });
  }

  if (artisan) {
    await db.offering.deleteMany({ where: { artisanId: artisan.id } });
    await db.portfolioImage.deleteMany({ where: { artisanId: artisan.id } });
    await db.availabilitySlot.deleteMany({ where: { artisanId: artisan.id } });
    await db.artisanProfile.delete({ where: { id: artisan.id } }).catch(() => undefined);
  }

  await db.user.deleteMany({
    where: { firebaseUid: { in: uids } },
  });
  await db.category.deleteMany({ where: { slug: E2E_SLUG } });
}

describe.skipIf(!hasDotEnv || !hasCloudinary)(
  'E2E: Cloudinary (portfolio + chat sign-upload → upload)',
  () => {
    const app = createApp();

    it('portfolio folder upload succeeds', async () => {
      const sign = await request(app)
        .post('/artisans/portfolio-images/sign-upload')
        .set('Authorization', 'Bearer e2e')
        .set('x-e2e-auth', 'artisan');

      expect(sign.status).toBe(200);
      const { res, data } = await postToCloudinary(sign.body);
      expect(
        res.ok,
        `Cloudinary upload failed: ${data.error?.message || JSON.stringify(data)}. Check CLOUDINARY_CLOUD_NAME matches your Cloudinary console (Settings → Product environment credentials).`
      ).toBe(true);
      expect(data.secure_url).toMatch(/^https:\/\//);
      expect(data.public_id).toBeTruthy();
    });

    it('chat folder upload succeeds', async () => {
      const sign = await request(app)
        .post('/messages/sign-upload')
        .set('Authorization', 'Bearer e2e')
        .set('x-e2e-auth', 'chat');

      expect(sign.status).toBe(200);
      const { res, data } = await postToCloudinary(sign.body);
      expect(
        res.ok,
        `Cloudinary upload failed: ${data.error?.message || JSON.stringify(data)}. Check CLOUDINARY_CLOUD_NAME matches your Cloudinary console (Settings → Product environment credentials).`
      ).toBe(true);
      expect(data.secure_url).toMatch(/^https:\/\//);
    });
  }
);

describe.skipIf(!hasDotEnv || !hasPaystack)('E2E: Paystack initialize', () => {
  const app = createApp();
  let bookingId: string;

  beforeAll(
    async () => {
      await wipeE2EPaymentFixture();

      const category = await db.category.create({
        data: {
          name: 'E2E Pay Category',
          slug: E2E_SLUG,
          iconKey: 'needle',
        },
      });

      await db.user.create({
        data: {
          firebaseUid: E2E_CUSTOMER_UID,
          email: 'e2e.payflow.customer@gmail.com',
          role: Role.CUSTOMER,
          status: UserStatus.ACTIVE,
        },
      });
      await db.user.create({
        data: {
          firebaseUid: E2E_ARTISAN_UID,
          email: 'e2e.payflow.artisan@gmail.com',
          role: Role.ARTISAN,
          status: UserStatus.ACTIVE,
        },
      });

      const artisan = await db.artisanProfile.create({
        data: {
          userId: E2E_ARTISAN_UID,
          displayName: 'E2E Artisan',
          city: 'Lagos',
          lat: 6.45,
          lng: 3.39,
        },
      });

      const offering = await db.offering.create({
        data: {
          artisanId: artisan.id,
          categoryId: category.id,
          title: 'E2E Service',
          description: 'integration',
          priceFrom: 5_000,
        },
      });

      const booking = await createBooking({
        customerId: E2E_CUSTOMER_UID,
        offeringId: offering.id,
      });
      if (!booking) {
        throw new Error('createBooking returned null');
      }
      bookingId = booking.id;
    },
    60_000
  );

  afterAll(async () => {
    await wipeE2EPaymentFixture();
  });

  it('POST /payments/initialize returns Paystack authorization URL', async () => {
    const res = await request(app)
      .post('/payments/initialize')
      .set('Authorization', 'Bearer e2e')
      .set('x-e2e-auth', 'pay-customer')
      .send({ bookingId });

    if (res.status !== 201) {
      expect.fail(
        `POST /payments/initialize expected 201, got ${res.status}: ${JSON.stringify(res.body)}`
      );
    }
    expect(res.body.authorizationUrl || res.body.payment?.authorizationUrl).toMatch(
      /^https:\/\//
    );
  });
});
