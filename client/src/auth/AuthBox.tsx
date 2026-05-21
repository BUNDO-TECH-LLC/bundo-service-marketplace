import { FormEvent, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { User } from 'firebase/auth';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { api, ApiError } from '../lib/api';
import { auth, firebaseReady } from '../lib/firebase';
import { markArtisanApplicant } from '../lib/artisanApplication';
import type { AuthDrawerPrompt } from '../lib/authDrawerPrompt';
import { validateEmailAddress } from '../lib/emailValidation';
import {
  clearSessionSignupIntent,
  needsEmailVerification,
  readPendingSignupIntent,
  readPendingSignupPhone,
  resolveSignupIntent,
  savePendingSignupIntent,
  savePendingSignupPhone,
  saveSessionSignupIntent,
} from '../lib/authSignupStorage';
import { finalizeAuthSession } from '../lib/authSessionFlow';
import { sendBundoPasswordResetEmail } from '../lib/authEmailVerification';
import { resolveApiSession } from '../lib/resolveApiSession';
import { userDisplayName } from '../lib/userDisplayName';
import type { ApiUser, Role } from '../types';
import type { SignupRole, View, WorkspaceSection } from '../appTypes';
import bundoLogo from '../assets/bundo-logo.png';
import { EmailInboxHint } from '../components/EmailInboxHint';
import { sendBundoEmailVerification } from '../lib/authEmailVerification';
import { signInWithGooglePopup } from '../lib/authSessionFlow';
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
}) {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [emailError, setEmailError] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [authStep, setAuthStep] = useState<'account' | 'verify'>('account');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [signupIntent, setSignupIntent] = useState<SignupRole | null>(null);
  const [pendingAuthUser, setPendingAuthUser] = useState<User | null>(null);
  const [pendingEmailVerificationUser, setPendingEmailVerificationUser] = useState<User | null>(null);

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
    forceTokenRefresh = false
  ) {
    const rememberedPhone = readPendingSignupPhone(firebaseAuthUser.email);
    const phoneToApply =
      authMode === 'signup' ? phone.trim() || rememberedPhone || undefined : undefined;
    const artisanIntent =
      resolveSignupIntent(firebaseAuthUser.email, signupIntent) === 'ARTISAN';

    const bootstrapSession = await resolveApiSession(firebaseAuthUser, forceTokenRefresh);
    const rolePatch = !bootstrapSession.user.role ? ('CUSTOMER' as const) : undefined;

    const { session } = await finalizeAuthSession(firebaseAuthUser, {
      mode: authMode === 'login' ? 'login' : 'signup',
      intendedRole: rolePatch,
      phone: phoneToApply,
      forceTokenRefresh,
    });

    onReady(session.token, session.user);

    if (session.user.role === 'ARTISAN') {
      onNavigate('home');
      onNotice(
        'Your artisan account is active. Manage jobs, messages, and offerings from your workspace.'
      );
    } else if (artisanIntent && session.user.role === 'CUSTOMER') {
      markArtisanApplicant();
      onNavigate('home');
      onNotice('Complete your artisan profile and verification. You will become an artisan after admin approval.');
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
    setSignupIntent(null);
    setPendingAuthUser(null);
    setPendingEmailVerificationUser(null);
    setAuthStep('account');
    clearSessionSignupIntent();
  }

  async function sendVerification(user: User) {
    if (signupIntent === 'ARTISAN') {
      saveSessionSignupIntent('ARTISAN');
      savePendingSignupIntent(user.email, 'ARTISAN');
    }
    savePendingSignupPhone(user.email, phone.trim() || null);
    await sendBundoEmailVerification(user);
    setPendingEmailVerificationUser(user);
    setAuthStep('verify');
    onNotice('Verification email sent. Check your inbox and spam folder, then come back to continue.');
  }

  async function confirmEmailVerification() {
    const user = pendingEmailVerificationUser || auth?.currentUser;

    if (!user) {
      onNotice('Sign in again so we can check your verification status.');
      return;
    }

    setSubmitting(true);
    try {
      await user.reload();
      const refreshedUser = auth?.currentUser || user;

      if (!refreshedUser.emailVerified) {
        onNotice(
          'Email is not verified yet. Open the link in your inbox (or spam folder), then try again.'
        );
        return;
      }

      await finishAuth(refreshedUser, 'signup', true);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Could not check verification status';
      onNotice(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function resendVerification() {
    const user = pendingEmailVerificationUser || auth?.currentUser;

    if (!user) {
      onNotice('Sign in again so we can send a verification email.');
      return;
    }

    setSubmitting(true);
    try {
      await sendVerification(user);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'Could not send verification email');
    } finally {
      setSubmitting(false);
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
      setAuthStep('account');
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
      onNotice('Sign-in is not configured. Add VITE_FIREBASE_* to your client environment and reload.');
      return;
    }

    if (!validateEmailField()) {
      onNotice(emailError || 'Enter a valid email address.');
      return;
    }

    if (mode === 'signup' && (!firstName.trim() || !lastName.trim())) {
      onNotice('Enter your first and last name.');
      return;
    }

    if (mode === 'signup' && !phone.trim()) {
      onNotice('Enter your phone number (include country code, e.g. +234…).');
      return;
    }

    if (mode === 'signup' && password.length < 8) {
      onNotice('Password must be at least 8 characters.');
      return;
    }

    if (mode === 'signup' && password !== confirmPassword) {
      onNotice('Passwords do not match. Please retype them and try again.');
      return;
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
        if (signupIntent === 'ARTISAN') {
          saveSessionSignupIntent('ARTISAN');
        }
      }

      if (mode === 'signup' && !credential.user.emailVerified) {
        await sendVerification(credential.user);
        return;
      }

      if (mode === 'login' && credential.user.providerData.some((provider) => provider.providerId === 'password') && !credential.user.emailVerified) {
        setPendingEmailVerificationUser(credential.user);
        setAuthStep('verify');
        onNotice('Please verify your email before continuing.');
        return;
      }

      await finishAuth(credential.user);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'Could not sign in');
    } finally {
      setSubmitting(false);
    }
  }

  async function continueWithGoogle() {
    if (!auth) {
      onNotice('Sign-in is not configured. Add VITE_FIREBASE_* to your client environment and reload.');
      return;
    }

    if (mode === 'signup' && (!firstName.trim() || !lastName.trim())) {
      onNotice('Enter your first and last name before continuing with Google.');
      return;
    }

    if (mode === 'signup' && !phone.trim()) {
      onNotice('Enter your phone number before continuing with Google.');
      return;
    }

    if (!validateEmailField() && mode === 'signup') {
      onNotice(emailError || 'Enter a valid email address.');
      return;
    }

    setSubmitting(true);
    onNotice('');
    try {
      const credential = await signInWithGooglePopup();

      if (mode === 'signup') {
        const displayName = combinedDisplayName();
        if (displayName) {
          await updateProfile(credential.user, { displayName });
        }
        if (signupIntent === 'ARTISAN') {
          saveSessionSignupIntent('ARTISAN');
        }
        savePendingSignupPhone(credential.user.email, phone.trim());
      }

      await finishAuth(credential.user, mode);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'Could not continue with Google');
    } finally {
      setSubmitting(false);
    }
  }

  function openLogin(prefillEmail?: string) {
    onOpenAuth?.();
    setSignupIntent(null);
    setConfirmPassword('');
    setPhone('');
    setPendingAuthUser(null);
    setPendingEmailVerificationUser(null);
    setMode('login');
    setAuthStep('account');
    if (prefillEmail) {
      setEmail(prefillEmail);
    }
    setDrawerOpen(true);
    onNotice('');
  }

  function openSignup(intent: SignupRole | null = null) {
    onOpenAuth?.();
    setSignupIntent(intent);
    saveSessionSignupIntent(intent);
    setConfirmPassword('');
    setPendingAuthUser(null);
    setPendingEmailVerificationUser(null);
    setMode('signup');
    setAuthStep('account');
    setDrawerOpen(true);
    onNotice('');
  }

  function openResetPassword(prefillEmail?: string) {
    setPassword('');
    setConfirmPassword('');
    setPhone('');
    setPendingAuthUser(null);
    setPendingEmailVerificationUser(null);
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
    if (!authDrawerPrompt) return;

    onOpenAuth?.();

    const prefillEmail = authDrawerPrompt.email;

    if (authDrawerPrompt.mode === 'login') {
      openLogin(prefillEmail);
    } else if (authDrawerPrompt.mode === 'reset') {
      openResetPassword(prefillEmail);
    } else if (authDrawerPrompt.mode === 'choose-role') {
      markArtisanApplicant();
      onNavigate('home');
      onNotice('Complete your artisan profile and verification to get approved.');
    } else {
      openSignup(authDrawerPrompt.role ?? null);
      if (prefillEmail) {
        setEmail(prefillEmail);
      }
    }

    onAuthDrawerPromptHandled?.();
  }, [authDrawerPrompt, onAuthDrawerPromptHandled, onOpenAuth, onNavigate, onNotice]);

  useEffect(() => {
    if (!firebaseUser || !me || me.role) {
      return;
    }

    void finishAuth(firebaseUser, 'login', true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time legacy role backfill
  }, [firebaseUser, me?.role, me?.firebaseUid]);

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
                Sign-in is not configured. Add VITE_FIREBASE_* to your client environment and reload.
              </p>
            )}

            {authStep === 'verify' ? (
              <>
                <p className="eyebrow">Verify your email</p>
                <h2>Check your inbox</h2>
                <p className="drawer-copy">
                  We sent a verification link to {pendingEmailVerificationUser?.email || email || 'your email address'}.
                  Open that link, then return here to continue into your Bundo account.
                </p>
                <EmailInboxHint email={pendingEmailVerificationUser?.email || email || undefined} />
                <div className="auth-status-card">
                  <strong>Email verification required</strong>
                  <span>
                    This helps protect bookings, messages, payments, and artisan verification from fake or mistyped accounts.
                  </span>
                </div>
                <div className="auth-action-stack">
                  <button type="button" onClick={() => void confirmEmailVerification()} disabled={submitting}>
                    {submitting ? 'Checking...' : "I've verified my email"}
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => void resendVerification()}
                    disabled={submitting}
                  >
                    Resend verification email
                  </button>
                  <button type="button" className="mode-switch" onClick={() => openLogin()}>
                    Back to login
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="eyebrow">
                  {mode === 'reset' ? 'Reset access' : mode === 'login' ? 'Welcome back' : 'Create your account'}
                </p>
            <h2>
                  {mode === 'reset'
                    ? 'Reset your password'
                    : mode === 'login'
                    ? 'Login to your account'
                    : 'Sign up for Bundo'}
            </h2>
            <p className="drawer-copy">
                  {mode === 'reset'
                    ? 'Enter your account email and Firebase will send a secure password reset link.'
                    : mode === 'login'
                    ? 'Continue with Google or your email to pick up your marketplace workflow.'
                    : 'Every account starts as a client. You can apply to become an artisan later from your dashboard after verification.'}
            </p>

                {mode !== 'reset' && (
                  <>
                    <button
                      type="button"
                      className="google-auth-button"
                      onClick={() => void continueWithGoogle()}
                      disabled={!firebaseReady || submitting}
                    >
                      <span aria-hidden="true">G</span>
                      Continue with Google
                    </button>

                    <div className="auth-divider"><span>or</span></div>
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
                  {mode === 'signup' && (
                    <label>
                      Phone number
                      <input
                        value={phone}
                        onChange={(event) => setPhone(event.target.value)}
                        placeholder="+2348012345678"
                        type="tel"
                        autoComplete="tel"
                        required
                      />
                    </label>
                  )}
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
                        : 'Create account'}
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