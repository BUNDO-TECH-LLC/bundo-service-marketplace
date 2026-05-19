import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { BookingStatus, PaymentStatus, Role, UserStatus } from '@prisma/client';
import db from './db/client';

const SLUG = 'smoke-lifecycle-category';
const CUSTOMER_UID = 'smoke-lifecycle-customer';
const ARTISAN_UID = 'smoke-lifecycle-artisan';
const ADMIN_UID = 'smoke-lifecycle-admin';

vi.mock('./middlewares/verifyFirebaseToken', () => ({
  verifyFirebaseToken: (req: any, _res: any, next: any) => {
    const mode = String(req.headers['x-smoke-auth'] || '');
    const users: Record<string, object> = {
      customer: {
        firebaseUid: CUSTOMER_UID,
        email: 'smoke.customer@test.local',
        phone: null,
        role: Role.CUSTOMER,
        status: UserStatus.ACTIVE,
        fcmToken: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      artisan: {
        firebaseUid: ARTISAN_UID,
        email: 'smoke.artisan@test.local',
        phone: null,
        role: Role.ARTISAN,
        status: UserStatus.ACTIVE,
        fcmToken: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      admin: {
        firebaseUid: ADMIN_UID,
        email: 'smoke.admin@test.local',
        phone: null,
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
        fcmToken: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
    req.user = users[mode] || users.customer;
    next();
  },
}));

import { createApp } from './createApp';

const hasDatabase = Boolean(process.env.DATABASE_URL);

async function wipeFixture() {
  const uids = [CUSTOMER_UID, ARTISAN_UID, ADMIN_UID];
  await db.notification.deleteMany({ where: { userId: { in: uids } } });
  await db.payment.deleteMany({ where: { customerId: CUSTOMER_UID } });
  await db.booking.deleteMany({ where: { customerId: CUSTOMER_UID } });
  const artisan = await db.artisanProfile.findUnique({ where: { userId: ARTISAN_UID } });
  if (artisan) {
    await db.message.deleteMany({
      where: { conversation: { customerId: CUSTOMER_UID, artisanId: artisan.id } },
    });
    await db.conversation.deleteMany({
      where: { customerId: CUSTOMER_UID, artisanId: artisan.id },
    });
    await db.offering.deleteMany({ where: { artisanId: artisan.id } });
    await db.artisanProfile.delete({ where: { id: artisan.id } }).catch(() => undefined);
  }
  await db.user.deleteMany({
    where: { firebaseUid: { in: [CUSTOMER_UID, ARTISAN_UID, ADMIN_UID] } },
  });
  await db.category.deleteMany({ where: { slug: SLUG } });
}

describe.skipIf(!hasDatabase)(
  'Smoke: booking lifecycle, admin jobs, and chat',
  () => {
    const app = createApp();
    let offeringId: string;
    let bookingId: string;
    let artisanProfileId: string;
    let conversationId: string;

    beforeAll(async () => {
      await wipeFixture();

      const category = await db.category.create({
        data: { name: 'Smoke Lifecycle', slug: SLUG, iconKey: 'needle' },
      });

      await db.user.createMany({
        data: [
          {
            firebaseUid: CUSTOMER_UID,
            email: 'smoke.customer@test.local',
            role: Role.CUSTOMER,
            status: UserStatus.ACTIVE,
          },
          {
            firebaseUid: ARTISAN_UID,
            email: 'smoke.artisan@test.local',
            role: Role.ARTISAN,
            status: UserStatus.ACTIVE,
          },
          {
            firebaseUid: ADMIN_UID,
            email: 'smoke.admin@test.local',
            role: Role.ADMIN,
            status: UserStatus.ACTIVE,
          },
        ],
      });

      const artisan = await db.artisanProfile.create({
        data: {
          userId: ARTISAN_UID,
          displayName: 'Smoke Artisan',
          city: 'Lagos',
          lat: 6.45,
          lng: 3.39,
          verifyStatus: 'APPROVED',
        },
      });

      const offering = await db.offering.create({
        data: {
          artisanId: artisan.id,
          categoryId: category.id,
          title: 'Smoke plumbing visit',
          description: 'smoke test',
          priceFrom: 10_000,
        },
      });
      offeringId = offering.id;
    }, 60_000);

    afterAll(async () => {
      await wipeFixture();
    });

    it('customer creates booking and conversation thread', async () => {
      const res = await request(app)
        .post('/bookings')
        .set('Authorization', 'Bearer smoke')
        .set('x-smoke-auth', 'customer')
        .send({
          offeringId,
          scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
          note: 'Smoke test booking',
        });

      expect(res.status).toBe(201);
      expect(res.body.booking.status).toBe(BookingStatus.REQUESTED);
      bookingId = res.body.booking.id;
      artisanProfileId = res.body.booking.artisanId;

      const conv = await db.conversation.findUnique({
        where: {
          customerId_artisanId: {
            customerId: CUSTOMER_UID,
            artisanId: res.body.booking.artisanId,
          },
        },
      });
      expect(conv).toBeTruthy();
      conversationId = conv!.id;
    });

    it('artisan accepts → appointment with lifecycle chat message', async () => {
      const res = await request(app)
        .patch(`/bookings/${bookingId}/status`)
        .set('Authorization', 'Bearer smoke')
        .set('x-smoke-auth', 'artisan')
        .send({ status: BookingStatus.ACCEPTED });

      expect(res.status).toBe(200);
      expect(res.body.booking.status).toBe(BookingStatus.ACCEPTED);

      await db.payment.create({
        data: {
          bookingId,
          customerId: CUSTOMER_UID,
          artisanId: artisanProfileId,
          amount: 10_000,
          platformFee: 1_000,
          providerEarning: 9_000,
          status: PaymentStatus.PAID_HELD,
          paystackReference: `smoke-pay-${bookingId}`,
          paidAt: new Date(),
        },
      });

      const messages = await db.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
      });
      expect(messages.some((m) => m.body.includes('Booking accepted'))).toBe(true);
    });

    it('artisan marks ongoing then completed', async () => {
      const ongoing = await request(app)
        .patch(`/bookings/${bookingId}/status`)
        .set('Authorization', 'Bearer smoke')
        .set('x-smoke-auth', 'artisan')
        .send({ status: BookingStatus.ONGOING });

      expect(ongoing.status).toBe(200);
      expect(ongoing.body.booking.status).toBe(BookingStatus.ONGOING);

      const completed = await request(app)
        .patch(`/bookings/${bookingId}/status`)
        .set('Authorization', 'Bearer smoke')
        .set('x-smoke-auth', 'artisan')
        .send({ status: BookingStatus.COMPLETED });

      expect(completed.status).toBe(200);
      expect(completed.body.booking.status).toBe(BookingStatus.COMPLETED);
    });

    it('customer and artisan can exchange chat messages', async () => {
      const customerMsg = await request(app)
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', 'Bearer smoke')
        .set('x-smoke-auth', 'customer')
        .send({ body: 'Hello from smoke customer' });

      expect(customerMsg.status).toBe(201);

      const artisanMsg = await request(app)
        .post(`/conversations/${conversationId}/messages`)
        .set('Authorization', 'Bearer smoke')
        .set('x-smoke-auth', 'artisan')
        .send({ body: 'Hello from smoke artisan' });

      expect(artisanMsg.status).toBe(201);

      const thread = await request(app)
        .get(`/conversations/${conversationId}/messages`)
        .set('Authorization', 'Bearer smoke')
        .set('x-smoke-auth', 'customer');

      expect(thread.status).toBe(200);
      expect(thread.body.messages.length).toBeGreaterThanOrEqual(2);
    });

    it('admin lists appointments and opens conversation', async () => {
      const list = await request(app)
        .get('/admin/bookings?stage=completed&limit=20')
        .set('Authorization', 'Bearer smoke')
        .set('x-smoke-auth', 'admin');

      expect(list.status).toBe(200);
      const row = list.body.bookings.find((b: { id: string }) => b.id === bookingId);
      expect(row).toBeTruthy();
      expect(row.conversationId).toBe(conversationId);

      const conv = await request(app)
        .get(`/admin/conversations/${conversationId}`)
        .set('Authorization', 'Bearer smoke')
        .set('x-smoke-auth', 'admin');

      expect(conv.status).toBe(200);
      expect(conv.body.conversation.messages?.length).toBeGreaterThan(0);

      const reply = await request(app)
        .post(`/admin/conversations/${conversationId}/messages`)
        .set('Authorization', 'Bearer smoke')
        .set('x-smoke-auth', 'admin')
        .send({ body: 'Smoke admin support reply' });

      expect(reply.status).toBe(201);
    });

    it('rejects invalid artisan status jump', async () => {
      const fresh = await request(app)
        .post('/bookings')
        .set('Authorization', 'Bearer smoke')
        .set('x-smoke-auth', 'customer')
        .send({ offeringId });

      const id = fresh.body.booking.id;

      const bad = await request(app)
        .patch(`/bookings/${id}/status`)
        .set('Authorization', 'Bearer smoke')
        .set('x-smoke-auth', 'artisan')
        .send({ status: BookingStatus.COMPLETED });

      expect(bad.status).toBe(409);
    });
  }
);
