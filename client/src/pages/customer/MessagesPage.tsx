import { FormEvent, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { CustomerHeader } from '../../components/customer/CustomerHeader';
import { MessagesWorkspace } from '../../components/customer/MessagesWorkspace';
import { AppIcon } from '../../components/ui/AppIcon';
import { nigeriaStates } from '../../constants/data';
import { api } from '../../lib/api';
import { resolveApiSession } from '../../lib/authSession';
import { auth } from '../../lib/firebase';
import type { ActionRunner } from '../../appTypes';
import type { ApiUser, Conversation } from '../../types';
import {
  appRoutes,
  buildCategoriesPath,
  buildCustomerWorkspacePath,
} from '../../routes/paths';
import './MessagesPage.css';

type LocationDropdownProps = {
  value: string;
  onChange: (value: string) => void;
};

function LocationDropdown({ value, onChange }: LocationDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const selectedLocationLabel = value ? `${value}, Nigeria` : 'Lagos, Nigeria';

  return (
    <div className="relative min-w-0 flex-1" ref={dropdownRef}>
      <button
        className="flex w-full min-w-0 items-center gap-2.5 bg-transparent p-0 text-left"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Select location"
        onClick={() => setIsOpen((current) => !current)}
      >
        <AppIcon icon="mingcute:location-line" className="text-2xl leading-none text-[var(--color-ink)]" size={24} />
        <span className="min-w-0 flex-1 truncate pl-1 font-medium text-[var(--color-ink)]">
          {selectedLocationLabel}
        </span>
        <AppIcon
          icon="mdi:chevron-down"
          className={`text-[var(--color-ink)] transition-transform ${isOpen ? 'rotate-180' : ''}`}
          size={18}
        />
      </button>

      {isOpen ? (
        <div
          className="absolute top-[calc(100%+8px)] left-0 right-0 z-30 max-h-64 overflow-auto rounded-lg border border-[var(--color-input-border)] bg-[var(--color-paper)] p-1 shadow-[0_10px_28px_var(--shadow-light)]"
          role="listbox"
          aria-label="Location options"
        >
          <button
            className="w-full rounded-md px-3 py-2 text-left text-[var(--color-ink)] hover:bg-[var(--color-soft)]"
            type="button"
            onClick={() => {
              onChange('');
              setIsOpen(false);
            }}
          >
            Lagos, Nigeria
          </button>
          {nigeriaStates
            .filter((state) => state !== 'Lagos')
            .map((state) => (
              <button
                className="w-full rounded-md px-3 py-2 text-left text-[var(--color-ink)] hover:bg-[var(--color-soft)]"
                key={state}
                type="button"
                onClick={() => {
                  onChange(state);
                  setIsOpen(false);
                }}
              >
                {state}, Nigeria
              </button>
            ))}
        </div>
      ) : null}
    </div>
  );
}

export default function MessagesPage() {
  const navigate = useNavigate();
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [token, setToken] = useState('');
  const [me, setMe] = useState<ApiUser | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedState, setSelectedState] = useState('');

  useEffect(() => {
    if (!auth) {
      navigate(appRoutes.login, { replace: true });
      return undefined;
    }

    return onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);

      if (!user) {
        navigate(appRoutes.login, { replace: true });
        return;
      }

      try {
        const session = await resolveApiSession(user);

        if (session.user.role === 'ARTISAN') {
          navigate(appRoutes.artisanDashboard, { replace: true });
          return;
        }

        if (session.user.role === 'ADMIN') {
          navigate(appRoutes.admin, { replace: true });
          return;
        }

        setToken(session.token);
        setMe(session.user);
      } catch {
        navigate(appRoutes.login, { replace: true });
      }
    });
  }, [navigate]);

  useEffect(() => {
    if (!token) {
      return;
    }

    void refreshConversations();
  }, [token]);

  const runAction: ActionRunner = async (action, done = '') => {
    setBusy(true);
    setNotice('');

    try {
      await action();
      if (done) {
        setNotice(done);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  async function refreshConversations() {
    if (!token) {
      return;
    }

    setBusy(true);

    try {
      const response = await api<{ conversations: Conversation[] }>('/conversations', { token });
      setConversations(response.conversations);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not load your messages.');
    } finally {
      setBusy(false);
    }
  }

  function openCategories() {
    navigate(
      buildCategoriesPath({
        q: searchTerm.trim() || undefined,
        state: selectedState || undefined,
      })
    );
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    openCategories();
  }

  async function logout() {
    if (auth) {
      await signOut(auth);
    }

    navigate(appRoutes.home, { replace: true });
  }

  return (
    <div className="messages-page min-h-full bg-[var(--color-paper)] py-6">
      <CustomerHeader
        firebaseUser={firebaseUser}
        me={me}
        activeNav="messages"
        searchContent={
          <form
            className="grid w-[min(100%,402px)] justify-self-end grid-cols-[minmax(170px,1fr)_minmax(150px,0.92fr)] items-center rounded-lg border border-[var(--color-input-border)] bg-[var(--color-paper)] max-[1180px]:w-full max-[1180px]:justify-self-stretch max-[720px]:grid-cols-1"
            onSubmit={submitSearch}
          >
            <label className="flex min-w-0 items-center gap-2.5 px-3 py-2.5 first:border-r first:border-[var(--color-line)] max-[720px]:first:border-r-0 max-[720px]:first:border-b">
              <AppIcon icon="mingcute:search-line" className="text-2xl leading-none text-[var(--color-ink)]" size={24} />
              <input
                className="min-w-0 border-0 bg-transparent p-0 font-medium text-[var(--color-ink)] outline-none"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search for artisan"
                type="search"
                aria-label="Search for artisan"
              />
            </label>

            <div className="flex min-w-0 items-center px-3 py-2.5 max-[720px]:border-b">
              <LocationDropdown value={selectedState} onChange={setSelectedState} />
            </div>
          </form>
        }
        onOpenDashboard={() => navigate(appRoutes.customerDashboard)}
        onOpenMarketplace={openCategories}
        onOpenNotifications={() => navigate(buildCustomerWorkspacePath('notifications'))}
        onOpenWorkspace={(section) => navigate(buildCustomerWorkspacePath(section))}
        onUserUpdated={setMe}
        onLogout={logout}
      />

      <main className="messages-page__main app-screen-gutter">
        {notice ? <div className="notice mb-5">{notice}</div> : null}

        {me ? (
          <MessagesWorkspace
            token={token}
            currentUserId={me.firebaseUid}
            conversations={conversations}
            busy={busy}
            runAction={runAction}
            refresh={refreshConversations}
            onSearchArtisans={openCategories}
          />
        ) : null}
      </main>
    </div>
  );
}
