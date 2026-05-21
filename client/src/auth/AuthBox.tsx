import { FormEvent, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { User } from 'firebase/auth';
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { api, ApiError } from '../lib/api';
import { auth, firebaseReady } from '../lib/firebase';
import {
  clearPendingSignupRole,
  needsEmailVerification,
  readPendingSignupRole,
  savePendingSignupRole,
} from '../lib/authSignupStorage';
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
  authPromptSignal = 0,
  unreadCount,
  onReady,
  onNavigate,
  onWorkspaceSection,
  onNotice,
  onOpenAuth,
}: {
  firebaseUser: User | null;
  me: ApiUser | null;
  authPromptSignal?: number;
  unreadCount: number;
  onReady: (token: string, user: ApiUser) => void;
  onNavigate: (view: View) => void;
  onWorkspaceSection: (section: WorkspaceSection) => void;
  onNotice: (message: string) => void;
  onOpenAuth?: () => void;
}) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [authStep, setAuthStep] = useState<'role' | 'account' | 'verify'>('account');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [preferredRole, setPreferredRole] = useState<SignupRole | null>(null);
  const [pendingAuthUser, setPendingAuthUser] = useState<User | null>(null);
  const [pendingEmailVerificationUser, setPendingEmailVerificationUser] = useState<User | null>(null);

  const narrowViewport = useMediaQuery('(max-width: 768px)');
  const topbarPanelEl = useElementById(
    firebaseUser && me?.role && narrowViewport ? 'topbar-mobile-panel' : null
  );

  useEffect(() => {
    if (!authPromptSignal) return;

    if (firebaseUser && me && !me.role) {
      setMode('signup');
      setAuthStep('role');
      setDrawerOpen(true);
      return;
    }

    setPreferredRole('ARTISAN');
    setMode('signup');
    setAuthStep('account');
    setDrawerOpen(true);
  }, [authPromptSignal, firebaseUser, me]);

  async function finishAuth(
    firebaseAuthUser: User,
    authMode = mode,
    roleOverride = preferredRole,
    forceTokenRefresh = false
  ) {
    const rememberedRole = readPendingSignupRole(firebaseAuthUser.email);
    const intendedRole = roleOverride || rememberedRole;
    let session = await resolveApiSession(firebaseAuthUser, forceTokenRefresh);

    if (
      intendedRole &&
      session.user.role !== intendedRole &&
      session.user.role !== 'ADMIN' &&
      !(session.user.role === 'ARTISAN' && intendedRole === 'CUSTOMER')
    ) {
      await api('/users/role', {
        method: 'PATCH',
        token: session.token,
        body: JSON.stringify({ role: intendedRole }),
      });
      const refreshed = await api<{ user: ApiUser }>('/me', { token: session.token });
      session = {
        token: session.token,
        user: refreshed.user,
      };
    }

    if (!session.user.role) {
      setPendingAuthUser(firebaseAuthUser);
      setPreferredRole(rememberedRole);
      setMode('signup');
      setAuthStep(rememberedRole ? 'account' : 'role');
      setDrawerOpen(true);
      onNotice('Choose client or artisan to finish setting up your Bundo account.');
      return;
    }

    clearPendingSignupRole(firebaseAuthUser.email);
    onReady(session.token, session.user);
    if (session.user.role === 'ARTISAN') {
      if (authMode === 'signup' || intendedRole === 'ARTISAN') {
        onNavigate('home');
      } else {
        onWorkspaceSection('overview');
      }
      onNotice(
        'Your artisan onboarding is ready. Complete your profile, KYC, and offerings for admin review.'
      );
    } else if (authMode === 'signup') {
      onNotice('Account created. Welcome to Bundo.');
    } else {
      onNotice('Signed in');
    }

    setDrawerOpen(false);
    setPassword('');
    setConfirmPassword('');
    setFullName('');
    setPreferredRole(null);
    setPendingAuthUser(null);
    setPendingEmailVerificationUser(null);
    setAuthStep('account');
  }

  async function sendVerification(user: User) {
    savePendingSignupRole(user.email, preferredRole);
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

      await finishAuth(
        refreshedUser,
        'signup',
        readPendingSignupRole(refreshedUser.email) || preferredRole,
        true
      );
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
      await sendPasswordResetEmail(auth, email.trim());
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

    if (mode === 'signup' && !preferredRole) {
      setAuthStep('role');
      onNotice('Choose how you want to use Bundo first.');
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

      if (mode === 'signup' && fullName.trim()) {
        await updateProfile(credential.user, { displayName: fullName.trim() });
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

    if (mode === 'signup' && !preferredRole) {
      setAuthStep('role');
      onNotice('Choose how you want to use Bundo first.');
      return;
    }

    setSubmitting(true);
    onNotice('');
    try {
      const credential = await signInWithGooglePopup();
      await finishAuth(credential.user);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'Could not continue with Google');
    } finally {
      setSubmitting(false);
    }
  }

  function chooseRole(role: SignupRole) {
    setPreferredRole(role);

    if (pendingAuthUser) {
      void finishAuth(pendingAuthUser, 'signup', role);
      return;
    }

    setAuthStep('account');
    onNotice('');
  }

  function openLogin() {
    onOpenAuth?.();
    setPreferredRole(null);
    setConfirmPassword('');
    setPendingAuthUser(null);
    setPendingEmailVerificationUser(null);
    setMode('login');
    setAuthStep('account');
    setDrawerOpen(true);
    onNotice('');
  }

  function openSignup(role: SignupRole | null = null) {
    onOpenAuth?.();
    setPreferredRole(role);
    setConfirmPassword('');
    setPendingAuthUser(null);
    setPendingEmailVerificationUser(null);
    setMode('signup');
    setAuthStep(role ? 'account' : 'role');
    setDrawerOpen(true);
    onNotice('');
  }

  function openResetPassword() {
    setPassword('');
    setConfirmPassword('');
    setPendingAuthUser(null);
    setPendingEmailVerificationUser(null);
    setMode('reset');
    setAuthStep('account');
    setDrawerOpen(true);
  }

  function switchMode() {
    if (mode === 'login' || mode === 'reset') {
      openSignup();
      return;
    }

    openLogin();
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
                <button type="button" onClick={() => setDrawerOpen(false)}>Close</button>
              </div>
              <p className="eyebrow">Finish setup</p>
              <h2>How will you use Bundo?</h2>
              <p className="drawer-copy">Choose your account type so we can unlock the right marketplace actions.</p>
              <div className="role-choice-grid" aria-label="Choose account type">
                <button type="button" className="role-choice-card" onClick={() => void finishAuth(firebaseUser, 'signup', 'CUSTOMER', true)}>
                  <span>Client</span>
                  <strong>Find and book trusted services</strong>
                  <small>Browse professionals, message artisans, request bookings, and track jobs.</small>
                </button>
                <button type="button" className="role-choice-card artisan" onClick={() => void finishAuth(firebaseUser, 'signup', 'ARTISAN', true)}>
                  <span>Artisan</span>
                  <strong>Offer services on Bundo</strong>
                  <small>Create a profile, add offerings, complete verification, and receive bookings.</small>
                </button>
              </div>
              <button
                type="button"
                className="mode-switch"
                onClick={() => {
                  onNotice('Signed out');
                  auth && signOut(auth);
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
      <button type="button" onClick={openLogin}>
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
                  <button type="button" className="mode-switch" onClick={openLogin}>
                    Back to login
                  </button>
                </div>
              </>
            ) : mode === 'signup' && authStep === 'role' ? (
              <>
                <p className="eyebrow">Create your account</p>
                <h2>How will you use Bundo?</h2>
                <p className="drawer-copy">
                  Choose the account type that matches your first workflow. You can manage your setup from the dashboard after login.
                </p>

                <div className="role-choice-grid" aria-label="Choose account type">
                  <button type="button" className="role-choice-card" onClick={() => chooseRole('CUSTOMER')}>
                    <span>Client</span>
                    <strong>Find and book trusted services</strong>
                    <small>Browse professionals, message artisans, request bookings, and track jobs.</small>
                  </button>
                  <button type="button" className="role-choice-card artisan" onClick={() => chooseRole('ARTISAN')}>
                    <span>Artisan</span>
                    <strong>Offer services on Bundo</strong>
                    <small>Create a profile, add offerings, complete verification, and receive bookings.</small>
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
                    ? 'Enter your account email and Firebase will send a secure password reset link.'
                    : mode === 'login'
                    ? 'Continue with Google or your email to pick up your marketplace workflow.'
                    : preferredRole === 'ARTISAN'
                      ? 'Start with your login, then complete profile setup, verification, offerings, and admin review from your workspace.'
                      : 'Start with your login, then browse, message, book, and manage service requests from your dashboard.'}
            </p>

                {mode === 'signup' && (
                  <div className="selected-role-banner">
                    <span>{preferredRole === 'ARTISAN' ? 'Artisan account' : 'Client account'}</span>
                    <button type="button" onClick={() => setAuthStep('role')}>Change</button>
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
                      Continue with Google
                    </button>

                    <div className="auth-divider"><span>or</span></div>
                  </>
                )}

            <form className="auth-form" onSubmit={mode === 'reset' ? resetPassword : submit}>
                  {mode === 'signup' && (
                    <label>
                      Full name
                      <input
                        value={fullName}
                        onChange={(event) => setFullName(event.target.value)}
                        placeholder="Your full name"
                        type="text"
                        autoComplete="name"
                        required
                      />
                    </label>
                  )}
              <label>
                Email
                    <input
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      type="email"
                      autoComplete="email"
                      required
                    />
              </label>
                  {mode !== 'reset' && (
                    <label>
                      Password
                      <PasswordInput
                        value={password}
                        onChange={setPassword}
                        placeholder="Your password"
                        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                        minLength={6}
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
                        minLength={6}
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
                  <button type="button" className="forgot-password-link" onClick={openResetPassword}>
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