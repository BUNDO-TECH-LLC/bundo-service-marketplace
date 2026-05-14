import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appPath = path.join(__dirname, '../../src/App.tsx');
const s = fs.readFileSync(appPath, 'utf8');

function slice(startNeedle, endNeedle) {
  const a = s.indexOf(startNeedle);
  const b = s.indexOf(endNeedle, a);
  if (a === -1 || b === -1) throw new Error(`Missing: ${startNeedle} .. ${endNeedle}`);
  return s.slice(a, b);
}

const helpTopicsData = slice('const helpTopics = ', '\n\nfunction HelpCenter(');
const helpTopicsFile = `export type HelpQuestion = [string, string];
export type HelpSection = { heading: string; questions: HelpQuestion[] };
export type HelpTopic = { id: string; icon: string; title: string; sections: HelpSection[] };

export const helpTopics: HelpTopic[] = ${helpTopicsData.replace(/^const helpTopics = /, '')}`;

const helpCenterBody = slice('function HelpCenter(', '\n\nfunction AccountSettingsPanel(');
const helpCenterFile = `import { helpTopics } from './helpTopics';

export function HelpCenter${helpCenterBody.slice('function HelpCenter'.length)}`;

const loggedInBody = slice('function LoggedInHome(', '\n\nfunction Hero(');
const loggedInFile = `import { FormEvent, useState } from 'react';
import type { User } from 'firebase/auth';
import { api } from '../lib/api';
import { categoryIcon } from '../lib/categoryIcon';
import { heroImage } from '../lib/marketingAssets';
import { money } from '../lib/formatting';
import { nigeriaStates } from '../lib/geo';
import { userDisplayName } from '../lib/userDisplayName';
import type { ActionRunner, BookingSuccessState } from '../appTypes';
import type { ApiUser, Artisan, Booking, Category, Offering } from '../types';
import { EmptyState } from '../components/EmptyState';

export function LoggedInHome${loggedInBody.slice('function LoggedInHome'.length)}`;

const profileBody = slice('function ArtisanProfilePage(', '\n\nfunction AppPromo(');
const profileFile = `import { FormEvent, useState } from 'react';
import { api } from '../lib/api';
import { money } from '../lib/formatting';
import { userDisplayName } from '../lib/userDisplayName';
import type { ActionRunner, BookingSuccessState } from '../appTypes';
import type { Artisan, Booking, Review, Role } from '../types';
import { EmptyState } from '../components/EmptyState';

export function ArtisanProfilePage${profileBody.slice('function ArtisanProfilePage'.length)}`;

const dashBody = slice('function ArtisanDashboard(', '\n\nfunction AdminBookingsPanel(');
const dashFile = `import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { api } from '../lib/api';
import { bookingDate } from '../lib/bookingDisplay';
import { formatMessageTime, money } from '../lib/formatting';
import { userDisplayName } from '../lib/userDisplayName';
import type { ActionRunner } from '../appTypes';
import type { Artisan, ArtisanKycSubmission, AvailabilitySlot, Booking } from '../types';
import { EmptyState } from '../components/EmptyState';
import { StatCard } from '../components/StatCard';

export function ArtisanDashboard${dashBody.slice('function ArtisanDashboard'.length)}`;

const authBody = slice('function AuthBox(', '\n\nfunction categoryIcon(');
const authFile = `import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { api, ApiError } from '../lib/api';
import { auth } from '../lib/firebase';
import {
  clearPendingSignupRole,
  needsEmailVerification,
  readPendingSignupRole,
  savePendingSignupRole,
} from '../lib/authSignupStorage';
import { resolveApiSession } from '../lib/resolveApiSession';
import type { ApiUser, Role } from '../types';
import type { SignupRole, View, WorkspaceSection } from '../appTypes';
import bundoLogo from '../assets/bundo-logo.png';

export function AuthBox${authBody.slice('function AuthBox'.length)}`;

const adminBookings = slice('function AdminBookingsPanel(', '\n\nfunction AdminKycPanel(');
const adminKyc = slice('function AdminKycPanel(', '\n\nfunction adminMetricLabel(');
const adminMetric = slice('function adminMetricLabel(', '\n\nfunction AdminConsole(');
const adminConsole = slice('function AdminConsole(', '\n\nfunction AdminOverviewPanel(');
const overview = slice('function AdminOverviewPanel(', '\n\nfunction AdminProfilesPanel(');
const profiles = slice('function AdminProfilesPanel(', '\n\nfunction AdminCatalogPanel(');
const catalog = slice('function AdminCatalogPanel(', '\n\nexport default App');

const adminBookingsFile = `import { api } from '../lib/api';
import { bookingDate, paymentLabel, statusLabel } from '../lib/bookingDisplay';
import { money } from '../lib/formatting';
import type { ActionRunner } from '../appTypes';
import type { Booking } from '../types';
import { EmptyState } from '../components/EmptyState';

export function AdminBookingsPanel${adminBookings.slice('function AdminBookingsPanel'.length)}`;

const adminKycFile = `import { api } from '../lib/api';
import { bookingDate } from '../lib/bookingDisplay';
import type { ActionRunner, AdminArtisanRecord } from '../appTypes';
import type { ArtisanKycSubmission } from '../types';
import { EmptyState } from '../components/EmptyState';

export function AdminKycPanel${adminKyc.slice('function AdminKycPanel'.length)}`;

const adminMetricFile = `export function adminMetricLabel${adminMetric.slice('function adminMetricLabel'.length)}`;

const adminConsoleFile = `import { AdminChatPanel } from '../panels/AdminChatPanel';
import type { ActionRunner, AdminArtisanRecord, AdminCategoryRecord, AdminSection, AdminUserRecord } from '../appTypes';
import type { ArtisanKycSubmission, Booking, Conversation } from '../types';
import { AdminBookingsPanel } from './AdminBookingsPanel';
import { AdminCatalogPanel } from './AdminCatalogPanel';
import { AdminKycPanel } from './AdminKycPanel';
import { AdminOverviewPanel } from './AdminOverviewPanel';
import { AdminProfilesPanel } from './AdminProfilesPanel';

export function AdminConsole${adminConsole.slice('function AdminConsole'.length)}`;

const overviewFile = `import type { AdminSection, AdminArtisanRecord, AdminUserRecord } from '../appTypes';
import type { ArtisanKycSubmission, Booking, Conversation } from '../types';
import { EmptyState } from '../components/EmptyState';
import { adminMetricLabel } from './adminMetricLabel';

export function AdminOverviewPanel${overview.slice('function AdminOverviewPanel'.length)}`;

const profilesFile = `import { api } from '../lib/api';
import type { ActionRunner, AdminArtisanRecord, AdminUserRecord } from '../appTypes';
import type { Artisan, Role } from '../types';

export function AdminProfilesPanel${profiles.slice('function AdminProfilesPanel'.length)}`;

const catalogFile = `import { api } from '../lib/api';
import type { ActionRunner, AdminCategoryRecord } from '../appTypes';

export function AdminCatalogPanel${catalog.slice('function AdminCatalogPanel'.length)}`;

const root = path.join(__dirname, '../../src');
fs.mkdirSync(path.join(root, 'help'), { recursive: true });
fs.mkdirSync(path.join(root, 'views'), { recursive: true });
fs.mkdirSync(path.join(root, 'admin'), { recursive: true });
fs.mkdirSync(path.join(root, 'auth'), { recursive: true });

fs.writeFileSync(path.join(root, 'help/helpTopics.ts'), helpTopicsFile);
fs.writeFileSync(path.join(root, 'help/HelpCenter.tsx'), helpCenterFile);
fs.writeFileSync(path.join(root, 'views/LoggedInHome.tsx'), loggedInFile);
fs.writeFileSync(path.join(root, 'views/ArtisanProfilePage.tsx'), profileFile);
fs.writeFileSync(path.join(root, 'views/ArtisanDashboard.tsx'), dashFile);
fs.writeFileSync(path.join(root, 'auth/AuthBox.tsx'), authFile);
fs.writeFileSync(path.join(root, 'admin/adminMetricLabel.ts'), adminMetricFile);
fs.writeFileSync(path.join(root, 'admin/AdminBookingsPanel.tsx'), adminBookingsFile);
fs.writeFileSync(path.join(root, 'admin/AdminKycPanel.tsx'), adminKycFile);
fs.writeFileSync(path.join(root, 'admin/AdminOverviewPanel.tsx'), overviewFile);
fs.writeFileSync(path.join(root, 'admin/AdminProfilesPanel.tsx'), profilesFile);
fs.writeFileSync(path.join(root, 'admin/AdminCatalogPanel.tsx'), catalogFile);
fs.writeFileSync(path.join(root, 'admin/AdminConsole.tsx'), adminConsoleFile);

console.log('Extracted modules OK');
