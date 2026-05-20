import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import type { ActionRunner } from '../appTypes';

type Props = {
  token: string;
  conversationId: string;
  viewerRole: 'CUSTOMER' | 'ARTISAN';
  artisanProfileId: string;
  otherPartyFirebaseUid: string;
  customerContact?: { email?: string | null; phone?: string | null };
  busy: boolean;
  runAction: ActionRunner;
  onViewArtisanProfile: () => void;
  onAfterInboxChange: () => Promise<void>;
};

export function ChatThreadOverflowMenu({
  token,
  conversationId,
  viewerRole,
  artisanProfileId,
  otherPartyFirebaseUid,
  customerContact,
  busy,
  runAction,
  onViewArtisanProfile,
  onAfterInboxChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const onDocClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEscape);
    };
  }, [open]);

  async function patchInbox(inbox: 'SPAM' | 'ARCHIVED') {
    await api(`/conversations/${conversationId}/inbox`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ inbox }),
    });
    setOpen(false);
    await onAfterInboxChange();
  }

  async function submitReport() {
    const detail = window.prompt('Optional note for our team (or leave blank):') ?? '';
    await api(`/conversations/${conversationId}/report`, {
      method: 'POST',
      token,
      body: JSON.stringify({ reportedUserId: otherPartyFirebaseUid, detail: detail.trim() || undefined }),
    });
    setOpen(false);
  }

  const confirmSpam = () => {
    if (!window.confirm('Move this chat to spam? It will be hidden from your inbox.')) {
      return;
    }
    void runAction(() => patchInbox('SPAM'), 'Chat moved to spam');
  };

  const confirmDelete = () => {
    if (
      !window.confirm(
        'Remove this chat from your inbox? You will not see it here anymore. The other person may still have access to the thread.'
      )
    ) {
      return;
    }
    void runAction(() => patchInbox('ARCHIVED'), 'Chat removed from your inbox');
  };

  const confirmReport = () => {
    if (
      !window.confirm('Report this user to Bundo? Our team may review messages in this conversation.')
    ) {
      return;
    }
    void runAction(() => submitReport(), 'Thanks — your report was submitted');
  };

  return (
    <>
      <div className="chat-thread-overflow" ref={rootRef}>
        <button
          type="button"
          className="chat-overflow-trigger"
          aria-expanded={open}
          aria-haspopup="true"
          disabled={busy}
          aria-label="Chat options"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="chat-overflow-dot" aria-hidden />
          <span className="chat-overflow-dot" aria-hidden />
          <span className="chat-overflow-dot" aria-hidden />
        </button>

        {open && (
          <div className="chat-overflow-menu" role="menu">
            {viewerRole === 'CUSTOMER' && (
              <button
                type="button"
                role="menuitem"
                className="chat-overflow-item"
                onClick={() => {
                  setOpen(false);
                  if (artisanProfileId) {
                    onViewArtisanProfile();
                  }
                }}
              >
                View artisan profile
              </button>
            )}
            {viewerRole === 'ARTISAN' && (
              <button
                type="button"
                role="menuitem"
                className="chat-overflow-item"
                onClick={() => {
                  setOpen(false);
                  setCustomerOpen(true);
                }}
              >
                Customer details
              </button>
            )}
            <button type="button" role="menuitem" className="chat-overflow-item" onClick={confirmSpam}>
              Move to spam
            </button>
            <button type="button" role="menuitem" className="chat-overflow-item" onClick={confirmReport}>
              Report user
            </button>
            <button type="button" role="menuitem" className="chat-overflow-item danger" onClick={confirmDelete}>
              Delete chat
            </button>
          </div>
        )}
      </div>

      {customerOpen && (
        <div className="chat-customer-sheet-backdrop" role="presentation" onClick={() => setCustomerOpen(false)}>
          <div
            className="chat-customer-sheet"
            role="dialog"
            aria-labelledby="chat-customer-sheet-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="chat-customer-sheet-head">
              <h3 id="chat-customer-sheet-title">Customer</h3>
              <button type="button" className="chat-customer-sheet-close" aria-label="Close" onClick={() => setCustomerOpen(false)}>
                ×
              </button>
            </header>
            <p className="chat-customer-sheet-note">Customer accounts don’t have a public profile. Use the details below for this booking conversation.</p>
            <dl className="chat-customer-sheet-dl">
              <div>
                <dt>Email</dt>
                <dd>{customerContact?.email || '—'}</dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>{customerContact?.phone || '—'}</dd>
              </div>
            </dl>
          </div>
        </div>
      )}
    </>
  );
}
