import { FormEvent, useEffect, useMemo, useState } from 'react';
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

export function AuthBox({
  firebaseUser,
  me,
  authPromptSignal = 0,
  unreadCount,
  onReady,
  onNavigate,
  onWorkspaceSection,
  onNotice,
}: {
  firebaseUser: User | null;
  me: ApiUser | null;
  authPromptSignal?: number;
  unreadCount: number;
  onReady: (token: string, user: ApiUser) => void;
  onNavigate: (view: View) => void;
  onWorkspaceSection: (section: WorkspaceSection) => void;
  onNotice: (message: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup' | 'reset'>('login');
  const [authStep, setAuthStep] = useState<'role' | 'account' | 'verify'>('account');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [preferredRole, setPreferredRole] = useState<SignupRole | null>(null);
  const [pendingAuthUser, setPendingAuthUser] = useState<User | null>(null);
  const [pendingEmailVerificationUser, setPendingEmailVerificationUser] = useState<User | null>(null);

  useEffect(() => {
    if (!drawerOpen) {
      setShowPassword(false);
      setShowConfirmPassword(false);
    }
  }, [drawerOpen]);

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
  }, [authPromptSignal]);

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

    if (!session.user.role && session.user.role !== 'ADMIN') {
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
    await sendEmailVerification(user);
    setPendingEmailVerificationUser(user);
    setAuthStep('verify');
    onNotice('Verification email sent. Check your inbox, then come back to continue.');
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
        onNotice('Email is not verified yet. Open the verification link, then try again.');
        return;
      }

      await finishAuth(refreshedUser, 'signup', readPendingSignupRole(refreshedUser.email) || preferredRole, true);
    } catch (error) {
      onNotice(error instanceof Error ? error.message : 'Could not check verification status');
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
      onNotice('Password reset email sent. Check your inbox.');
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
    if (!auth) return;

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
    if (!auth) return;

    if (mode === 'signup' && !preferredRole) {
      setAuthStep('role');
      onNotice('Choose how you want to use Bundo first.');
      return;
    }

    setSubmitting(true);
    onNotice('');
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const credential = await signInWithPopup(auth, provider);
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
    setPreferredRole(null);
    setConfirmPassword('');
    setPendingAuthUser(null);
    setPendingEmailVerificationUser(null);
    setMode('login');
    setAuthStep('account');
    setDrawerOpen(true);
  }

  function openSignup(role: SignupRole | null = null) {
    setPreferredRole(role);
    setConfirmPassword('');
    setPendingAuthUser(null);
    setPendingEmailVerificationUser(null);
    setMode('signup');
    setAuthStep(role ? 'account' : 'role');
    setDrawerOpen(true);
  }

  function openResetPassword() {
    setPassword('');
    setConfirmPassword('');
    setPendingAuthUser(null);
    setPendingEmailVerificationUser(null);
    setMode('reset');
    setAuthStep('account');
  }

  function switchMode() {
    if (mode === 'login' || mode === 'reset') {
      openSignup();
      return;
    }

    setMode('login');
    setPreferredRole(null);
    setConfirmPassword('');
    setPendingAuthUser(null);
    setPendingEmailVerificationUser(null);
    setAuthStep('account');
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

        {drawerOpen && (
          <div className="auth-overlay" role="presentation" onClick={() => setDrawerOpen(false)}>
            <aside
              className="auth-drawer"
              aria-label="Complete account setup"
              aria-modal="true"
              role="dialog"
              onClick={(event) => event.stopPropagation()}
            >
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
            </aside>
          </div>
        )}
      </div>
    );
  }

  if (firebaseUser && me) {
    const displayName = userDisplayName(firebaseUser, me);
    const initial = displayName.slice(0, 1).toUpperCase();
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

    return (
      <div className="auth-summary">
        <button
          className="account-chip"
          type="button"
          aria-label="Open account menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span className="account-avatar">{initial}</span>
          {unreadCount > 0 && <span className="account-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
        </button>

        {menuOpen && (
          <div className="account-menu">
            <div className="account-menu-head">
              <span className="account-avatar large">{initial}</span>
              <div>
                <strong>{displayName}</strong>
                <small>{firebaseUser.email || me?.email || roleLabel}</small>
                <em>{roleLabel}</em>
              </div>
            </div>

            {role === 'ARTISAN' ? (
              <>
                <button onClick={() => goToWorkspace('overview')}>Dashboard</button>
                <button onClick={() => goToWorkspace('profile')}>Your profile</button>
                <button onClick={() => goToWorkspace('offers')}>Manage offers</button>
                <button onClick={() => goToWorkspace('bookings')}>Booking requests</button>
                <button onClick={() => goToWorkspace('messages')}>Messages</button>
                <button onClick={() => goToWorkspace('reviews')}>Reviews</button>
                <button onClick={() => goToWorkspace('notifications')}>Notifications</button>
              </>
            ) : role === 'ADMIN' ? (
              <>
                <button onClick={() => goTo('admin')}>Admin center</button>
                <button onClick={() => goToWorkspace('overview')}>Dashboard</button>
                <button onClick={() => goTo('admin', 'Support chats are in the admin conversation panel')}>Support chats</button>
                <button onClick={() => goToWorkspace('notifications')}>Notifications</button>
              </>
            ) : (
              <>
                <button onClick={() => goTo('home')}>Dashboard</button>
                <button onClick={() => goToWorkspace('bookings')}>My bookings</button>
                <button onClick={() => goToWorkspace('messages')}>Messages</button>
                <button onClick={() => goToWorkspace('notifications')}>Notifications</button>
              </>
            )}

            <button onClick={() => goTo('help')}>Help</button>
            <button
              className="danger-menu-item"
              onClick={() => {
                setMenuOpen(false);
                onNavigate('home');
                onNotice('Signed out');
                auth && signOut(auth);
              }}
            >
              Log out
            </button>
          </div>
        )}
      </div>
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

      {drawerOpen && (
        <div className="auth-overlay" role="presentation" onClick={() => setDrawerOpen(false)}>
          <aside
            className="auth-drawer"
            aria-label="Authentication panel"
            aria-modal="true"
            role="dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="drawer-head">
              <img className="drawer-logo" src={bundoLogo} alt="Bundo logo" />
              <button type="button" onClick={() => setDrawerOpen(false)}>Close</button>
            </div>

            {authStep === 'verify' ? (
              <>
                <p className="eyebrow">Verify your email</p>
                <h2>Check your inbox</h2>
                <p className="drawer-copy">
                  We sent a verification link to {pendingEmailVerificationUser?.email || email || 'your email address'}.
                  Open that link, then return here to continue into your Bundo account.
                </p>
                <div className="auth-status-card">
                  <strong>Email verification required</strong>
                  <span>
                    This helps protect bookings, messages, payments, and artisan verification from fake or mistyped accounts.
                  </span>
                </div>
                <div className="auth-action-stack">
                  <button type="button" onClick={confirmEmailVerification} disabled={submitting}>
                    {submitting ? 'Checking...' : "I've verified my email"}
                  </button>
                  <button type="button" className="secondary-button" onClick={resendVerification} disabled={submitting}>
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
                    <button type="button" className="google-auth-button" onClick={continueWithGoogle} disabled={!firebaseReady || submitting}>
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
                      <span className="password-input-wrap">
                        <input
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          placeholder="Your password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                          minLength={6}
                          required
                        />
                        <button
                          type="button"
                          className="password-toggle"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          aria-pressed={showPassword}
                          onClick={() => setShowPassword((visible) => !visible)}
                        >
                          {showPassword ? 'Hide' : 'Show'}
                        </button>
                      </span>
                    </label>
                  )}
                  {mode === 'signup' && (
                    <label>
                      Verify password
                      <span className="password-input-wrap">
                        <input
                          value={confirmPassword}
                          onChange={(event) => setConfirmPassword(event.target.value)}
                          placeholder="Retype your password"
                          type={showConfirmPassword ? 'text' : 'password'}
                          autoComplete="new-password"
                          minLength={6}
                          required
                        />
                        <button
                          type="button"
                          className="password-toggle"
                          aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                          aria-pressed={showConfirmPassword}
                          onClick={() => setShowConfirmPassword((visible) => !visible)}
                        >
                          {showConfirmPassword ? 'Hide' : 'Show'}
                        </button>
                      </span>
                    </label>
                  )}
              <button disabled={!firebaseReady || submitting}>
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
          </aside>
        </div>
      )}
    </div>
  );
}