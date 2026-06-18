import { FormEvent, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { User } from 'firebase/auth';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { api } from '../lib/api';
import { auth, firebaseReady } from '../lib/firebase';
import { SIGN_IN_UNAVAILABLE_WITH_EMAIL } from '../lib/productionMessages';
import { ARTISAN_ONBOARDING_PATH, artisanApplicantHomePath, markArtisanApplicant, stageArtisanApplicantIntent } from '../lib/artisanApplication';
import type { AuthDrawerPrompt } from '../lib/authDrawerPrompt';
import {
  checkEmailAccountStatus,
  checkEmailDeliverability,
  checkSignupPhoneAvailability,
  validateEmailAddress,
} from '../lib/emailValidation';
import { formatAuthFlowError } from '../lib/authErrors';
import {
  clearSessionSignupIntent,
  needsEmailVerification,
  clearGoogleRedirectIntent,
  readGoogleRedirectIntent,
  readPendingSignupIntent,
  readPendingSignupPhone,
  resolveSignupIntent,
  saveGoogleRedirectIntent,
  savePendingSignupIntent,
  savePendingSignupPhone,
  savePendingSignupRole,
  saveSessionSignupIntent,
} from '../lib/authSignupStorage';
import {
  finalizeAuthSession,
  getGoogleRedirectResult,
  startGoogleRedirectSignIn,
} from '../lib/authSessionFlow';
import { sendBundoPasswordResetEmail } from '../lib/authEmailVerification';
import { resolveApiSession } from '../lib/resolveApiSession';
import { userDisplayName } from '../lib/userDisplayName';
import type { ApiUser, Role } from '../types';
import type { SignupRole, View, WorkspaceSection } from '../appTypes';
import bundoLogo from '../assets/BundoLogo.png';
import { sendBundoEmailVerification } from '../lib/authEmailVerification';
import { LegalLinks } from '../components/LegalLinks';
import { PasswordInput } from '../components/PasswordInput';
import {
  IconAdmin,
  IconBookings,
  IconDashboard,
  IconHelp,
  IconMessages,
  IconNotifications,
  IconProfile,
  IconReviews,
  IconSettings,
} from '../components/TopbarNavIcons';
import { ProfileAccountMenu } from '../components/ProfileAccountMenu';
import { useElementById } from '../hooks/useElementById';
import { useMediaQuery } from '../hooks/useMediaQuery';

function AuthDrawer({
  open,
  onClose,
  ariaLabel,
  children,
}: {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div className="auth-overlay" role="presentation" onClick={onClose}>
      <aside
        className="auth-drawer"
        aria-label={ariaLabel}
        aria-modal="true"
        role="dialog"
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </aside>
    </div>,
    document.body
  );
}

export function AuthBox({
  firebaseUser,
  me,
  authDrawerPrompt = null,
  onAuthDrawerPromptHandled,
  unreadCount,
  onReady,
  onNavigate,
  onWorkspaceSection,
  onNotice,
  onOpenAuth,
  onNavigatePath,
}: {
  firebaseUser: User | null;
  me: ApiUser | null;
  authDrawerPrompt?: AuthDrawerPrompt | null;
  onAuthDrawerPromptHandled?: () => void;
  unreadCount: number;
  onReady: (token: string, user: ApiUser) => void;
  onNavigate: (view: View) => void;
  onWorkspaceSection: (section: WorkspaceSection) => void;
  onNotice: (message: string) => void;
  onOpenAuth?: () => void;
  onNavigatePath?: (path: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [authStep, setAuthStep] = useState<'role' | 'account'>('account');
  const [preferredRole, setPreferredRole] = useState<SignupRole | null>(null);
  const [pendingAuthUser, setPendingAuthUser] = useState<User | null>(null);
  const processedGoogleRedirectRef = useRef(false);
  const recoveredGoogleRedirectUserRef = useRef(false);

  const narrowViewport = useMediaQuery('(max-width: 768px)');
  const topbarPanelEl = useElementById(
    firebaseUser && me?.role && narrowViewport ? 'topbar-mobile-panel' : null
  );

  function combinedDisplayName() {
    return `${firstName.trim()} ${lastName.trim()}`.trim();
  }

  function validateEmailField(value = email) {
    const result = validateEmailAddress(value);
    if (!result.ok) {
      setEmailError(result.message);
      return false;
    }

    setEmail(result.normalized);
    setEmailError('');
    return true;
  }

  async function finishAuth(
    firebaseAuthUser: User,
    authMode = mode,
    roleOverride: SignupRole | null = preferredRole,
    forceTokenRefresh = false,
    options: { phoneOverride?: string | null } = {}
  ) {
    const rememberedPhone = readPendingSignupPhone(firebaseAuthUser.email);
    const resolvedPhone =
      options.phoneOverride !== undefined
        ? options.phoneOverride || undefined
        : phone.trim() || rememberedPhone || undefined;
    const phoneToApply = undefined;
    const resolvedRole = roleOverride || resolveSignupIntent(firebaseAuthUser.email, preferredRole);
    const artisanIntent = resolvedRole === 'ARTISAN';
    const intendedRole = resolvedRole === 'CUSTOMER' ? ('CUSTOMER' as const) : undefined;

    if (artisanIntent) {
      stageArtisanApplicantIntent();
    }

    const { session } = await finalizeAuthSession(firebaseAuthUser, {
      mode: authMode === 'login' ? 'login' : 'signup',
      intendedRole,
      phone: phoneToApply,
      forceTokenRefresh,
    });

    let nextUser = session.user;
    if (artisanIntent && session.user.role === 'CUSTOMER') {
      const updated = await markArtisanApplicant(session.token, session.user.firebaseUid);
      if (updated) {
        nextUser = updated;
        clearSessionSignupIntent();
      }
    }

    onReady(session.token, nextUser);

    if (artisanIntent && onNavigatePath) {
      onNavigatePath(artisanApplicantHomePath(nextUser, { email: firebaseAuthUser.email }));
    }

    if (session.user.role === 'ARTISAN') {
      onNotice(
        artisanIntent || authMode === 'signup'
          ? 'Your artisan onboarding is ready. Complete your profile, verification, and offerings for admin review.'
          : 'Your artisan account is active. Manage jobs, messages, and offerings from your workspace.'
      );
    } else if (artisanIntent && session.user.role === 'CUSTOMER') {
      onNotice('Account created. Continue with artisan onboarding on the next screen.');
    } else if (authMode === 'signup') {
      onNotice('Account created. Welcome to Bundo.');
    } else {
      onNotice('Signed in');
    }

    setDrawerOpen(false);
    setPassword('');
    setConfirmPassword('');
    setFirstName('');
    setLastName('');
    setPhone('');
    setPreferredRole(null);
    setPendingAuthUser(null);
    setAuthStep('account');
    if (!artisanIntent) {
      clearSessionSignupIntent();
    }
  }

  async function queueVerificationEmail(user: User) {
    if (preferredRole === 'ARTISAN') {
      saveSessionSignupIntent('ARTISAN');
      savePendingSignupIntent(user.email, 'ARTISAN');
      savePendingSignupRole(user.email, 'ARTISAN');
    } else if (preferredRole === 'CUSTOMER') {
      savePendingSignupRole(user.email, 'CUSTOMER');
    }
    savePendingSignupPhone(user.email, phone.trim() || null);

    try {
      await sendBundoEmailVerification(user);
      return true;
    } catch {
      return false;
    }
  }

  async function validateSignupEmailField() {
    if (!validateEmailField()) {
      return false;
    }

    const deliverability = await checkEmailDeliverability(email, { purpose: 'signup' });
    if (!deliverability.ok) {
      setEmailError(deliverability.message);
      onNotice(deliverability.message);
      return false;
    }

    setEmail(deliverability.normalized);
    setEmailError('');
    return true;
  }

  async function routeNewLoginEmailToSignup() {
    const status = await checkEmailAccountStatus(email);
    if (!status.ok) {
      setEmailError(status.message);
      onNotice(status.message);
      return true;
    }

    setEmail(status.normalized);
    if (status.exists) {
      return false;
    }

    const message = 'No Bundo account exists with this email yet. Choose how you want to use Bundo to create one.';
    setPassword('');
    setConfirmPassword('');
    setPreferredRole(null);
    saveSessionSignupIntent(null);
    setEmailError(message);
    setMode('signup');
    setAuthStep('role');
    onNotice(message);
    return true;
  }

  async function validateSignupPhoneField() {
    const availability = await checkSignupPhoneAvailability(phone);
    if (!availability.ok) {
      setPhoneError(availability.message);
      onNotice(availability.message);
      return false;
    }

    setPhone(availability.normalized);
    setPhoneError('');
    return true;
  }

  async function resolveOptionalSignupPhone(value: string | null | undefined) {
    const candidate = value?.trim();
    if (!candidate) {
      return undefined;
    }

    const availability = await checkSignupPhoneAvailability(candidate);
    if (!availability.ok) {
      setPhoneError(availability.message);
      onNotice(availability.message);
      return null;
    }

    setPhone(availability.normalized);
    setPhoneError('');
    return availability.normalized;
  }

  function isExistingGoogleAccount(user: User) {
    const created = user.metadata.creationTime;
    const lastSignIn = user.metadata.lastSignInTime;
    return Boolean(created && lastSignIn && created !== lastSignIn);
  }

  function showAuthFieldError(error: unknown, authMode: typeof mode) {
    const message = formatAuthFlowError(error, authMode === 'signup' ? 'signup' : 'login');
    onNotice(message);

    if (
      authMode === 'signup' &&
      (message.toLowerCase().includes('email') || message.toLowerCase().includes('account already exists'))
    ) {
      setEmailError(message);
    }

    if (authMode === 'signup' && message.toLowerCase().includes('phone')) {
      setPhoneError(message);
    }
  }

  async function resetPassword(event: FormEvent) {
    event.preventDefault();
    if (!auth) return;

    if (!email.trim()) {
      onNotice('Enter your email address first.');
      return;
    }

    setSubmitting(true);
    try {
      await sendBundoPasswordResetEmail(email.trim());
      onNotice('Password reset email sent. Check your inbox and spam folder.');
      setMode('login');
      setPassword('');
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'Could not send password reset email');
    } finally {
      setSubmitting(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!auth) {
      onNotice(SIGN_IN_UNAVAILABLE_WITH_EMAIL);
      return;
    }

    if (mode === 'signup' && !preferredRole) {
      setAuthStep('role');
      onNotice('Choose how you want to use Bundo first.');
      return;
    }

    if (!validateEmailField()) {
      onNotice(emailError || 'Enter a valid email address.');
      return;
    }

    if (mode === 'login') {
      setSubmitting(true);
      onNotice('Checking your account...');
      const routedToSignup = await routeNewLoginEmailToSignup();
      if (routedToSignup) {
        setSubmitting(false);
        return;
      }
    }

    if (mode === 'signup' && (!firstName.trim() || !lastName.trim())) {
      onNotice('Enter your first and last name.');
      setSubmitting(false);
      return;
    }

    if (mode === 'signup' && password.length < 8) {
      onNotice('Password must be at least 8 characters.');
      setSubmitting(false);
      return;
    }

    if (mode === 'signup' && password !== confirmPassword) {
      onNotice('Passwords do not match. Please retype them and try again.');
      setSubmitting(false);
      return;
    }

    if (mode === 'signup') {
      setSubmitting(true);
      onNotice('Checking your details...');
      const emailAvailable = await validateSignupEmailField();

      if (!emailAvailable) {
        setSubmitting(false);
        return;
      }
    }

    setSubmitting(true);
    onNotice('');
    try {
      const credential =
        mode === 'login'
          ? await signInWithEmailAndPassword(auth, email, password)
          : await createUserWithEmailAndPassword(auth, email, password);

      if (mode === 'signup') {
        const displayName = combinedDisplayName();
        if (displayName) {
          await updateProfile(credential.user, { displayName });
        }
        if (preferredRole === 'ARTISAN') {
          stageArtisanApplicantIntent();
          saveSessionSignupIntent('ARTISAN');
          savePendingSignupIntent(credential.user.email, 'ARTISAN');
        }
      }

      const isPasswordAccount = credential.user.providerData.some(
        (provider) => provider.providerId === 'password'
      );
      const needsVerify = isPasswordAccount && needsEmailVerification(credential.user);

      let verificationSent = false;
      if (needsVerify) {
        verificationSent = await queueVerificationEmail(credential.user);
      }

      await finishAuth(credential.user, mode);

      if (mode === 'signup' && verificationSent) {
        onNotice(
          'Account created. We sent a verification link—confirm when you can. You can resend it anytime from Settings.'
        );
      } else if (mode === 'signup') {
        onNotice(
          'Account created. We could not send a verification email yet—you can resend it from Settings when you are ready.'
        );
      } else if (mode === 'login' && needsVerify && verificationSent) {
        onNotice('Signed in. We sent a verification link—you can confirm or resend from Settings.');
      } else if (mode === 'login' && needsVerify) {
        onNotice('Signed in. Resend your verification email anytime from Settings.');
      }
    } catch (error) {
      showAuthFieldError(error, mode);
    } finally {
      setSubmitting(false);
    }
  }

  async function completeGoogleAuth(
    googleUser: User,
    authMode: 'login' | 'signup',
    roleOverride: SignupRole | null = preferredRole,
    options: { phoneOverride?: string | null; displayNameOverride?: string | null } = {}
  ) {
    const googleEmail = googleUser.email || '';
    let normalizedPhone: string | undefined;

    if (authMode === 'signup') {
      const displayName = options.displayNameOverride ?? combinedDisplayName();
      if (displayName && googleUser.displayName !== displayName) {
        await updateProfile(googleUser, { displayName });
      }

      if (roleOverride === 'ARTISAN') {
        saveSessionSignupIntent('ARTISAN');
        savePendingSignupIntent(googleEmail, 'ARTISAN');
      }

      const phoneCandidate =
        options.phoneOverride !== undefined ? options.phoneOverride : phone.trim();
      const phoneResult = await resolveOptionalSignupPhone(phoneCandidate);
      if (phoneResult === null) {
        await finishAuth(googleUser, 'signup', roleOverride, false, { phoneOverride: null });
        return;
      }

      normalizedPhone = phoneResult;
      if (normalizedPhone) {
        savePendingSignupPhone(googleEmail, normalizedPhone);
      }
    }

    if (authMode === 'signup' && isExistingGoogleAccount(googleUser)) {
      onNotice(
        'An account already exists with this Google email. You are signed in—use Log in next time if you prefer.'
      );
      await finishAuth(googleUser, 'login');
      return;
    }

    await finishAuth(googleUser, authMode, roleOverride, false, {
      phoneOverride: authMode === 'signup' ? normalizedPhone || null : undefined,
    });
  }

  async function continueWithGoogle() {
    if (!auth) {
      onNotice(SIGN_IN_UNAVAILABLE_WITH_EMAIL);
      return;
    }

    if (mode === 'signup' && !preferredRole) {
      setAuthStep('role');
      onNotice('Choose how you want to use Bundo first.');
      return;
    }

    setSubmitting(true);
    setGoogleSubmitting(true);
    onNotice('');
    try {
      saveGoogleRedirectIntent({
        mode: mode === 'signup' ? 'signup' : 'login',
        role: mode === 'signup' ? preferredRole : null,
        phone: mode === 'signup' && phone.trim() ? phone.trim() : null,
        displayName: mode === 'signup' ? combinedDisplayName() || null : null,
      });

      onNotice('Redirecting to Google to complete sign-in.');
      await startGoogleRedirectSignIn();
    } catch (error) {
      clearGoogleRedirectIntent();
      showAuthFieldError(error, mode);
    } finally {
      setSubmitting(false);
      setGoogleSubmitting(false);
    }
  }

  function chooseRole(role: SignupRole) {
    setPreferredRole(role);
    saveSessionSignupIntent(role);
    if (role === 'ARTISAN') {
      stageArtisanApplicantIntent();
    }
    if (email.trim()) {
      savePendingSignupRole(email.trim(), role);
    }

    if (pendingAuthUser) {
      void finishAuth(pendingAuthUser, 'signup', role);
      return;
    }

    setAuthStep('account');
    onNotice('');
  }

  function openLogin(prefillEmail?: string) {
    onOpenAuth?.();
    setPreferredRole(null);
    setConfirmPassword('');
    setPhone('');
    setEmailError('');
    setPhoneError('');
    setPendingAuthUser(null);
    setMode('login');
    setAuthStep('account');
    if (prefillEmail) {
      setEmail(prefillEmail);
    }
    setDrawerOpen(true);
    onNotice('');
  }

  function openSignup(role: SignupRole | null = null) {
    onOpenAuth?.();
    setPreferredRole(role);
    saveSessionSignupIntent(role);
    if (role === 'ARTISAN') {
      stageArtisanApplicantIntent();
    }
    setConfirmPassword('');
    setEmailError('');
    setPhoneError('');
    setPendingAuthUser(null);
    setMode('signup');
    setAuthStep(role ? 'account' : 'role');
    setDrawerOpen(true);
    onNotice('');
  }

  function openResetPassword(prefillEmail?: string) {
    setPassword('');
    setConfirmPassword('');
    setPhone('');
    setPendingAuthUser(null);
    setMode('reset');
    setAuthStep('account');
    if (prefillEmail) {
      setEmail(prefillEmail);
    }
    setDrawerOpen(true);
  }

  function switchMode() {
    if (mode === 'login' || mode === 'reset') {
      openSignup();
      return;
    }

    openLogin();
  }

  useEffect(() => {
    if (!auth || processedGoogleRedirectRef.current) {
      return;
    }

    processedGoogleRedirectRef.current = true;
    let cancelled = false;

    void (async () => {
      const intent = readGoogleRedirectIntent();

      try {
        const credential = await getGoogleRedirectResult();
        if (cancelled || !credential) {
          return;
        }

        clearGoogleRedirectIntent();
        const authMode = intent?.mode ?? 'login';
        const role = intent?.role ?? null;

        setMode(authMode);
        setPreferredRole(role);
        setAuthStep(authMode === 'signup' && !role ? 'role' : 'account');
        setSubmitting(true);
        setGoogleSubmitting(true);
        onNotice('Finishing Google sign-in...');
        await completeGoogleAuth(credential.user, authMode, role, {
          phoneOverride: intent?.phone ?? null,
          displayNameOverride: intent?.displayName ?? null,
        });
      } catch (error) {
        clearGoogleRedirectIntent();
        if (cancelled) {
          return;
        }

        const authMode = intent?.mode ?? 'login';
        setMode(authMode);
        setPreferredRole(intent?.role ?? null);
        setAuthStep(authMode === 'signup' && !intent?.role ? 'role' : 'account');
        setDrawerOpen(true);
        showAuthFieldError(error, authMode);
      } finally {
        if (!cancelled) {
          setSubmitting(false);
          setGoogleSubmitting(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!auth || !firebaseUser || recoveredGoogleRedirectUserRef.current) {
      return;
    }

    const intent = readGoogleRedirectIntent();
    if (!intent) {
      return;
    }

    recoveredGoogleRedirectUserRef.current = true;
    let cancelled = false;

    void (async () => {
      try {
        const authMode = intent.mode ?? 'login';
        const role = intent.role ?? null;

        setMode(authMode);
        setPreferredRole(role);
        setAuthStep(authMode === 'signup' && !role ? 'role' : 'account');
        setSubmitting(true);
        setGoogleSubmitting(true);
        onNotice('Finishing Google sign-in...');

        await completeGoogleAuth(firebaseUser, authMode, role, {
          phoneOverride: intent.phone ?? null,
          displayNameOverride: intent.displayName ?? null,
        });

        if (!cancelled) {
          clearGoogleRedirectIntent();
        }
      } catch (error) {
        if (!cancelled) {
          showAuthFieldError(error, intent.mode ?? 'login');
        }
      } finally {
        if (!cancelled) {
          setSubmitting(false);
          setGoogleSubmitting(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [firebaseUser]);

  useEffect(() => {
    if (!authDrawerPrompt) return;

    onOpenAuth?.();

    const prefillEmail = authDrawerPrompt.email;

    if (authDrawerPrompt.mode === 'login') {
      openLogin(prefillEmail);
    } else if (authDrawerPrompt.mode === 'reset') {
      openResetPassword(prefillEmail);
    } else if (authDrawerPrompt.mode === 'choose-role') {
      if (firebaseUser && me) {
        void (async () => {
          const token = await firebaseUser.getIdToken();
          await markArtisanApplicant(token, me.firebaseUid);
          if (onNavigatePath) {
            onNavigatePath(ARTISAN_ONBOARDING_PATH);
          } else {
            onNavigate('home');
          }
          onNotice('Continue with artisan onboarding.');
        })();
      } else {
        openSignup('ARTISAN');
      }
    } else {
      openSignup(authDrawerPrompt.role ?? null);
      if (prefillEmail) {
        setEmail(prefillEmail);
      }
    }

    onAuthDrawerPromptHandled?.();
  }, [authDrawerPrompt, firebaseUser, me, onAuthDrawerPromptHandled, onOpenAuth, onNavigate, onNotice]);

  if (firebaseUser && !me) {
    return (
      <div className="auth-entry">
        <button type="button" disabled>
          Signing in...
        </button>
      </div>
    );
  }

  if (firebaseUser && me && !me.role) {
    return (
      <div className="auth-entry role-completion-entry">
        <button
          type="button"
          onClick={() => {
            setMode('signup');
            setAuthStep('role');
            setDrawerOpen(true);
            onNotice('Choose client or artisan to finish setting up your Bundo account.');
          }}
        >
          Complete setup
        </button>

        <AuthDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} ariaLabel="Complete account setup">
          <div className="drawer-head">
            <img className="drawer-logo" src={bundoLogo} alt="Bundo logo" />
            <button type="button" onClick={() => setDrawerOpen(false)}>
              Close
            </button>
          </div>
          <p className="eyebrow">Finish setup</p>
          <h2>How will you use Bundo?</h2>
          <p className="drawer-copy">
            Choose the account type that matches how you want to use the marketplace. This unlocks the right
            dashboard, bookings flow, and verification steps.
          </p>
          <div className="role-choice-grid" aria-label="Choose account type">
            <button
              type="button"
              className="role-choice-card"
              onClick={() => void finishAuth(firebaseUser, 'signup', 'CUSTOMER', true)}
            >
              <span>Client</span>
              <strong>Find and book trusted services</strong>
              <small>Browse professionals, message artisans, request bookings, and track jobs from one place.</small>
            </button>
            <button
              type="button"
              className={`role-choice-card artisan${preferredRole === 'ARTISAN' ? ' role-choice-card--selected' : ''}`}
              onClick={() => void finishAuth(firebaseUser, 'signup', 'ARTISAN', true)}
            >
              <span>Artisan</span>
              <strong>Offer services on Bundo</strong>
              <small>
                Build your profile, add offerings, submit verification documents, and receive bookings after approval.
              </small>
            </button>
          </div>
          <button
            type="button"
            className="mode-switch"
            onClick={() => {
              onNotice('Signed out');
              if (auth) {
                void signOut(auth);
              }
            }}
          >
            Use another account
          </button>
        </AuthDrawer>
      </div>
    );
  }

  if (firebaseUser && me) {
    const displayName = userDisplayName(firebaseUser, me);
    const role = me?.role || null;
    const roleLabel = role ? role.toLowerCase() : 'setup account';

    const goTo = (target: View, message?: string) => {
      setMenuOpen(false);
      onNavigate(target);
      if (message) {
        onNotice(message);
      }
    };

    const goToWorkspace = (section: WorkspaceSection, message?: string) => {
      setMenuOpen(false);
      onWorkspaceSection(section);
      if (message) {
        onNotice(message);
      }
    };

    const roleHint =
      role === 'ARTISAN'
        ? null
        : role === 'CUSTOMER'
          ? 'Client'
          : role === 'ADMIN'
            ? 'Admin'
            : roleLabel;

    const logoutAction = () => {
      onNavigate('home');
      onNotice('Signed out');
      if (auth) {
        void signOut(auth);
      }
    };

    const customerGroups = [
      {
        title: 'Workspace',
        items: [
          {
            id: 'dashboard',
            label: 'Dashboard',
            icon: <IconDashboard />,
            onSelect: () => goTo('home'),
          },
          {
            id: 'bookings',
            label: 'My bookings',
            icon: <IconBookings />,
            onSelect: () => goToWorkspace('bookings'),
          },
          {
            id: 'messages',
            label: 'Messages',
            icon: <IconMessages />,
            onSelect: () => goToWorkspace('messages'),
          },
          {
            id: 'notifications',
            label: 'Notifications',
            icon: <IconNotifications />,
            onSelect: () => goToWorkspace('notifications'),
          },
        ],
      },
      {
        title: 'Support',
        items: [
          { id: 'help', label: 'Help', icon: <IconHelp />, onSelect: () => goTo('help') },
          { id: 'settings', label: 'Settings', icon: <IconSettings />, onSelect: () => goToWorkspace('settings') },
        ],
      },
      {
        items: [{ id: 'logout', label: 'Log out', danger: true, onSelect: logoutAction }],
      },
    ];

    const artisanGroups = [
      {
        title: 'Your business',
        items: [
          { id: 'profile', label: 'Profile', icon: <IconProfile />, onSelect: () => goToWorkspace('profile') },
          { id: 'reviews', label: 'Reviews', icon: <IconReviews />, onSelect: () => goToWorkspace('reviews') },
          { id: 'settings', label: 'Settings', icon: <IconSettings />, onSelect: () => goToWorkspace('settings') },
        ],
      },
      {
        title: 'Support',
        items: [{ id: 'help', label: 'Help', icon: <IconHelp />, onSelect: () => goTo('help') }],
      },
      {
        items: [{ id: 'logout', label: 'Log out', danger: true, onSelect: logoutAction }],
      },
    ];

    const adminGroups = [
      {
        title: 'Admin',
        items: [
          { id: 'admin', label: 'Admin center', icon: <IconAdmin />, onSelect: () => goTo('admin') },
          { id: 'dashboard', label: 'Dashboard', icon: <IconDashboard />, onSelect: () => goToWorkspace('overview') },
          {
            id: 'support',
            label: 'Support chats',
            icon: <IconMessages />,
            onSelect: () => goTo('admin', 'Support chats are in the admin conversation panel'),
          },
          {
            id: 'notifications',
            label: 'Notifications',
            icon: <IconNotifications />,
            onSelect: () => goToWorkspace('notifications'),
          },
        ],
      },
      {
        title: 'Support',
        items: [
          { id: 'help', label: 'Help', icon: <IconHelp />, onSelect: () => goTo('help') },
          { id: 'settings', label: 'Settings', icon: <IconSettings />, onSelect: () => goToWorkspace('settings') },
        ],
      },
      {
        items: [{ id: 'logout', label: 'Log out', danger: true, onSelect: logoutAction }],
      },
    ];

    const menuGroups = role === 'ARTISAN' ? artisanGroups : role === 'ADMIN' ? adminGroups : customerGroups;

    if (narrowViewport && me.role) {
      if (!topbarPanelEl) {
        // Avoid flashing the desktop avatar popover before #topbar-mobile-panel is resolved (layout).
        return null;
      }
      return createPortal(
        <div className="topbar-mobile-account-embed">
          <ProfileAccountMenu
            layout="inline"
            displayName={displayName}
            email={firebaseUser.email || me?.email}
            roleHint={roleHint}
            groups={menuGroups}
            onItemActivated={onOpenAuth}
          />
        </div>,
        topbarPanelEl
      );
    }

    return (
      <ProfileAccountMenu
        displayName={displayName}
        email={firebaseUser.email || me?.email}
        roleHint={roleHint}
        unreadCount={unreadCount}
        open={menuOpen}
        onOpenChange={setMenuOpen}
        groups={menuGroups}
        onItemActivated={onOpenAuth}
      />
    );
  }

  return (
    <div className="auth-entry">
      <button type="button" onClick={() => openLogin()}>
        Login
      </button>
      <button type="button" className="signup-link" onClick={() => openSignup()}>
        Sign up
      </button>

      <AuthDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} ariaLabel="Authentication panel">
            <div className="drawer-head">
              <img className="drawer-logo" src={bundoLogo} alt="Bundo logo" />
              <button type="button" onClick={() => setDrawerOpen(false)}>
                Close
              </button>
            </div>

            {!firebaseReady && (
              <p className="auth-form-error">
                {SIGN_IN_UNAVAILABLE_WITH_EMAIL}
              </p>
            )}

            {mode === 'signup' && authStep === 'role' ? (
              <>
                <p className="eyebrow">Create your account</p>
                <h2>How will you use Bundo?</h2>
                <p className="drawer-copy">
                  Pick the path that fits you first—like Upwork, you choose client or artisan before creating login
                  details. You can manage profile and verification from your dashboard after signup.
                </p>
                {emailError && <p className="auth-form-error">{emailError}</p>}

                <div className="role-choice-grid" aria-label="Choose account type">
                  <button
                    type="button"
                    className={`role-choice-card${preferredRole === 'CUSTOMER' ? ' role-choice-card--selected' : ''}`}
                    onClick={() => chooseRole('CUSTOMER')}
                  >
                    <span>Client</span>
                    <strong>Find and book trusted services</strong>
                    <small>Browse professionals, message artisans, request bookings, and track jobs.</small>
                  </button>
                  <button
                    type="button"
                    className={`role-choice-card artisan${preferredRole === 'ARTISAN' ? ' role-choice-card--selected' : ''}`}
                    onClick={() => chooseRole('ARTISAN')}
                  >
                    <span>Artisan</span>
                    <strong>Offer services on Bundo</strong>
                    <small>
                      Create a profile, add offerings, complete identity verification, and receive bookings after admin
                      approval.
                    </small>
                  </button>
                </div>

                <button type="button" className="mode-switch" onClick={switchMode}>
                  Already have an account? Login
                </button>
              </>
            ) : (
              <>
                <p className="eyebrow">
                  {mode === 'reset'
                    ? 'Reset access'
                    : mode === 'login'
                      ? 'Welcome back'
                      : preferredRole === 'ARTISAN'
                        ? 'Join as an artisan'
                        : 'Join as a client'}
                </p>
                <h2>
                  {mode === 'reset'
                    ? 'Reset your password'
                    : mode === 'login'
                      ? 'Login to your account'
                      : preferredRole === 'ARTISAN'
                        ? 'Create your artisan account'
                        : 'Create your client account'}
                </h2>
                <p className="drawer-copy">
                  {mode === 'reset'
                    ? 'Enter your account email and we will send a secure password reset link.'
                    : mode === 'login'
                      ? 'Continue with Google or your email to pick up your marketplace workflow.'
                      : preferredRole === 'ARTISAN'
                        ? 'Add your login details. After signup you go straight to artisan onboarding to set up your profile, offerings, and verification.'
                        : 'Add your login details, then browse, message, book, and manage service requests from your dashboard.'}
                </p>

                {mode === 'signup' && preferredRole && (
                  <div className="selected-role-banner">
                    <span>{preferredRole === 'ARTISAN' ? 'Artisan account' : 'Client account'}</span>
                    <button
                      type="button"
                      onClick={() => setAuthStep('role')}
                    >
                      Change
                    </button>
                  </div>
                )}

                {mode !== 'reset' && (
                  <>
                    <button
                      type="button"
                      className="google-auth-button"
                      onClick={() => void continueWithGoogle()}
                      disabled={!firebaseReady || submitting}
                    >
                      <span aria-hidden="true">G</span>
                      {googleSubmitting ? 'Connecting to Google...' : 'Continue with Google'}
                    </button>

                    <div className="auth-divider">
                      <span>or</span>
                    </div>
                  </>
                )}

                <form className="auth-form" onSubmit={mode === 'reset' ? resetPassword : submit}>
                  {mode === 'signup' && (
                    <div className="auth-name-grid">
                      <label>
                        First name
                        <input
                          value={firstName}
                          onChange={(event) => setFirstName(event.target.value)}
                          placeholder="First name"
                          type="text"
                          autoComplete="given-name"
                          required
                        />
                      </label>
                      <label>
                        Last name
                        <input
                          value={lastName}
                          onChange={(event) => setLastName(event.target.value)}
                          placeholder="Last name"
                          type="text"
                          autoComplete="family-name"
                          required
                        />
                      </label>
                    </div>
                  )}
              <label>
                Email
                    <input
                      value={email}
                      onChange={(event) => {
                        setEmail(event.target.value);
                        if (emailError) {
                          validateEmailField(event.target.value);
                        }
                      }}
                      onBlur={() => {
                        if (email.trim()) {
                          validateEmailField();
                        }
                      }}
                      placeholder="you@example.com"
                      type="email"
                      autoComplete="email"
                      aria-invalid={emailError ? 'true' : undefined}
                      required
                    />
                    {emailError && <span className="auth-field-error">{emailError}</span>}
              </label>
                  {mode !== 'reset' && (
                    <label>
                      Password
                      <PasswordInput
                        value={password}
                        onChange={setPassword}
                        placeholder="Your password"
                        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                        minLength={mode === 'signup' ? 8 : 6}
                        required
                      />
                    </label>
                  )}
                  {mode === 'signup' && (
                    <label>
                      Verify password
                      <PasswordInput
                        value={confirmPassword}
                        onChange={setConfirmPassword}
                        placeholder="Retype your password"
                        autoComplete="new-password"
                        minLength={8}
                        required
                      />
                    </label>
                  )}
              <button type="submit" disabled={!firebaseReady || submitting}>
                    {submitting
                      ? 'Please wait'
                      : mode === 'reset'
                        ? 'Send reset link'
                        : mode === 'login'
                          ? 'Login'
                          : preferredRole === 'ARTISAN'
                            ? 'Create artisan account'
                            : 'Create client account'}
              </button>
                  {mode === 'signup' && (
                    <p className="auth-legal-note">
                      By creating an account, you agree to our <LegalLinks />.
                    </p>
                  )}
            </form>

                {mode === 'login' && (
                  <button type="button" className="forgot-password-link" onClick={() => openResetPassword()}>
                    Forgot password?
                  </button>
                )}

                <button type="button" className="mode-switch" onClick={switchMode}>
                  {mode === 'login' || mode === 'reset' ? 'New here? Sign up' : 'Already have an account? Login'}
                </button>
              </>
            )}
      </AuthDrawer>
    </div>
  );
}