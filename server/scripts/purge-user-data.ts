/**
 * One-time pre-launch purge of user-generated marketplace data.
 *
 * Keeps service categories and one or more admin accounts. Does not touch
 * migrations or schema.
 *
 * Usage:
 *   PURGE_CONFIRM=YES npm run db:purge -- --keep-admin-email=you@bundo.ng
 *   PURGE_CONFIRM=YES npm run db:purge -- --keep-admin-uid=<firebase-uid>
 *   PURGE_CONFIRM=YES npm run db:purge -- --keep-admin-email=you@bundo.ng --firebase
 *
 * After running:
 *   npm run db:seed
 *   Delete remaining test users in Firebase Console if you skipped --firebase
 */

import 'dotenv/config';
import { getAuth } from 'firebase-admin/auth';
import { PrismaClient, Role } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { buildPoolConfig } from '../src/db/poolConfig';
import '../src/config/firebase';

const CONFIRM_ENV = 'PURGE_CONFIRM';
const REQUIRED_CONFIRM_VALUE = 'YES';

function readArgs(argv: string[]) {
  const keepAdminUids: string[] = [];
  const keepAdminEmails: string[] = [];
  let purgeFirebase = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg) {
      continue;
    }

    if (arg === '--firebase') {
      purgeFirebase = true;
      continue;
    }

    if (arg.startsWith('--keep-admin-uid=')) {
      const uid = arg.slice('--keep-admin-uid='.length).trim();
      if (uid) {
        keepAdminUids.push(uid);
      }
      continue;
    }

    if (arg === '--keep-admin-uid') {
      const uid = argv[index + 1]?.trim();
      if (uid) {
        keepAdminUids.push(uid);
        index += 1;
      }
      continue;
    }

    if (arg.startsWith('--keep-admin-email=')) {
      const email = arg.slice('--keep-admin-email='.length).trim();
      if (email) {
        keepAdminEmails.push(email);
      }
      continue;
    }

    if (arg === '--keep-admin-email') {
      const email = argv[index + 1]?.trim();
      if (email) {
        keepAdminEmails.push(email);
        index += 1;
      }
    }
  }

  return { keepAdminUids, keepAdminEmails, purgeFirebase };
}

async function resolveKeepAdminUids(
  db: PrismaClient,
  keepAdminUids: string[],
  keepAdminEmails: string[]
) {
  const resolved = [...keepAdminUids];

  for (const email of keepAdminEmails) {
    const user = await db.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
      select: { firebaseUid: true, email: true, role: true },
    });

    if (!user) {
      throw new Error(`No Postgres user found for --keep-admin-email=${email}`);
    }

    if (user.role !== Role.ADMIN) {
      throw new Error(
        `User ${user.email ?? email} is not ADMIN (current role: ${user.role ?? 'null'}). Promote them first.`
      );
    }

    resolved.push(user.firebaseUid);
  }

  return [...new Set(resolved)];
}

async function deleteFirebaseUsersExcept(keepUids: Set<string>) {
  const auth = getAuth();

  let nextPageToken: string | undefined;
  let deleted = 0;
  let kept = 0;

  do {
    const page = await auth.listUsers(1000, nextPageToken);
    const toDelete = page.users
      .map((user) => user.uid)
      .filter((uid: string) => !keepUids.has(uid));

    kept += page.users.length - toDelete.length;

    for (let index = 0; index < toDelete.length; index += 100) {
      const batch = toDelete.slice(index, index + 100);
      if (batch.length === 0) {
        continue;
      }

      const result = await auth.deleteUsers(batch);
      deleted += result.successCount;
      if (result.failureCount > 0) {
        console.warn(`Firebase deleteUsers reported ${result.failureCount} failures in this batch.`);
      }
    }

    nextPageToken = page.pageToken;
  } while (nextPageToken);

  console.log(`Firebase Auth: deleted ${deleted} users, kept ${kept}.`);
}

async function main() {
  const { keepAdminUids, keepAdminEmails, purgeFirebase } = readArgs(process.argv.slice(2));

  if (process.env[CONFIRM_ENV] !== REQUIRED_CONFIRM_VALUE) {
    throw new Error(
      `Refusing to purge without ${CONFIRM_ENV}=${REQUIRED_CONFIRM_VALUE}. This deletes user-generated data irreversibly.`
    );
  }

  if (keepAdminUids.length === 0 && keepAdminEmails.length === 0) {
    throw new Error(
      'Provide at least one --keep-admin-email=<email> or --keep-admin-uid=<firebase-uid> to retain your operator account.'
    );
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  const pool = new Pool(buildPoolConfig(databaseUrl));
  const adapter = new PrismaPg(pool);
  const db = new PrismaClient({ adapter });

  try {
    const resolvedKeepAdminUids = await resolveKeepAdminUids(db, keepAdminUids, keepAdminEmails);
    const keepSet = new Set(resolvedKeepAdminUids);
    const keptAdmins = await db.user.findMany({
      where: {
        firebaseUid: { in: resolvedKeepAdminUids },
        role: Role.ADMIN,
      },
      select: { firebaseUid: true, email: true },
    });

    if (keptAdmins.length !== resolvedKeepAdminUids.length) {
      const missing = resolvedKeepAdminUids.filter(
        (uid) => !keptAdmins.some((admin) => admin.firebaseUid === uid)
      );
      throw new Error(
        `These keep-admin UIDs are missing or not ADMIN in Postgres: ${missing.join(', ')}`
      );
    }

    const counts = {
      users: await db.user.count(),
      artisanProfiles: await db.artisanProfile.count(),
      bookings: await db.booking.count(),
      payments: await db.payment.count(),
      conversations: await db.conversation.count(),
      categories: await db.category.count(),
    };

    console.log('Current database snapshot:');
    console.log(counts);
    console.log(
      `Keeping ${keptAdmins.length} admin account(s): ${keptAdmins
        .map((admin) => admin.email || admin.firebaseUid)
        .join(', ')}`
    );
    console.log('Purging user-generated data…');

    await db.$transaction(async (tx) => {
      await tx.chatUserReport.deleteMany();
      await tx.message.deleteMany();
      await tx.adminNote.deleteMany();
      await tx.notification.deleteMany();
      await tx.ledgerEntry.deleteMany();
      await tx.dispute.deleteMany();
      await tx.payout.deleteMany();
      await tx.payment.deleteMany();
      await tx.review.deleteMany();
      await tx.booking.deleteMany();
      await tx.artisanKycSubmission.deleteMany();
      await tx.portfolioImage.deleteMany();
      await tx.availabilitySlot.deleteMany();
      await tx.offering.deleteMany();
      await tx.providerPayoutAccount.deleteMany();
      await tx.conversation.deleteMany();
      await tx.artisanProfile.deleteMany();
      await tx.user.deleteMany({
        where: {
          firebaseUid: { notIn: resolvedKeepAdminUids },
        },
      });
    });

    const after = {
      users: await db.user.count(),
      artisanProfiles: await db.artisanProfile.count(),
      bookings: await db.booking.count(),
      payments: await db.payment.count(),
      conversations: await db.conversation.count(),
      categories: await db.category.count(),
    };

    console.log('Post-purge snapshot:');
    console.log(after);

    if (purgeFirebase) {
      await deleteFirebaseUsersExcept(keepSet);
    } else {
      console.log('Skipped Firebase Auth cleanup. Re-run with --firebase or delete test users manually.');
    }

    console.log('Purge complete. Run `npm run db:seed` to sync service categories.');
  } finally {
    await db.$disconnect();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
