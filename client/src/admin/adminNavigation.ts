import type { AdminSection } from '../appTypes';
import type { AdminJobFilter } from '../lib/adminJobStages';
import type { Artisan, KycStatus } from '../types';

export type AdminProfilesFilter = 'all' | 'customer' | 'artisan' | 'admin';
export type AdminVerifyFilter = 'all' | Artisan['verifyStatus'];

export type AdminSectionIntent = {
  jobs?: { filter?: AdminJobFilter };
  profiles?: {
    profileFilter?: AdminProfilesFilter;
    verifyFilter?: AdminVerifyFilter;
  };
  verification?: { status?: Exclude<KycStatus, 'NOT_SUBMITTED'> };
};

export type AdminOverviewTarget = {
  section: AdminSection;
  intent?: AdminSectionIntent;
};

export const OVERVIEW_STAT_TARGETS = {
  users: { section: 'profiles', intent: { profiles: { profileFilter: 'all' } } },
  artisans: { section: 'profiles', intent: { profiles: { profileFilter: 'artisan' } } },
  bookings: { section: 'jobs', intent: { jobs: { filter: 'all' } } },
  payments: { section: 'finance' },
  openDisputes: { section: 'jobs', intent: { jobs: { filter: 'payouts' } } },
  conversations: { section: 'messages' },
} satisfies Record<string, AdminOverviewTarget>;

export const OVERVIEW_PRIORITY_TARGETS: AdminOverviewTarget[] = [
  {
    section: 'verification',
    intent: { verification: { status: 'PENDING' } },
  },
  {
    section: 'jobs',
    intent: { jobs: { filter: 'appointments' } },
  },
  {
    section: 'jobs',
    intent: { jobs: { filter: 'payouts' } },
  },
  {
    section: 'profiles',
    intent: { profiles: { profileFilter: 'artisan', verifyFilter: 'PENDING' } },
  },
];

export const OVERVIEW_PIPELINE_TARGETS: Array<
  AdminOverviewTarget & { statKey: string; label: string }
> = [
  {
    statKey: 'bookingRequests',
    label: 'Requests',
    section: 'jobs',
    intent: { jobs: { filter: 'requests' } },
  },
  {
    statKey: 'bookingAppointments',
    label: 'Appointments',
    section: 'jobs',
    intent: { jobs: { filter: 'appointments' } },
  },
  {
    statKey: 'bookingOngoing',
    label: 'In progress',
    section: 'jobs',
    intent: { jobs: { filter: 'ongoing' } },
  },
  {
    statKey: 'bookingCompleted',
    label: 'Completed',
    section: 'jobs',
    intent: { jobs: { filter: 'completed' } },
  },
  {
    statKey: 'approvedArtisans',
    label: 'Approved artisans',
    section: 'profiles',
    intent: { profiles: { profileFilter: 'artisan', verifyFilter: 'APPROVED' } },
  },
  {
    statKey: 'offerings',
    label: 'Active listings',
    section: 'catalog',
  },
];
