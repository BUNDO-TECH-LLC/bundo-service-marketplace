import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { ChatComposer, type ChatComposerPayload } from '../components/ChatComposer';
import { EmptyState } from '../components/EmptyState';
import { uploadChatImage } from '../lib/chatUpload';
import { useMediaQuery } from '../hooks/useMediaQuery';
import type { ActionRunner } from '../appTypes';
import type { Conversation } from '../types';

const ADMIN_CHAT_MOBILE_BREAKPOINT = '(max-width: 900px)';

export function AdminChatPanel({
  token,
  conversations,
  busy,
  runAction,
  refresh,
  initialConversationId,
  onConversationOpened,
}: {
  token: string;
  conversations: Conversation[];
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
  initialConversationId?: string | null;
  onConversationOpened?: () => void;
}) {
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const narrowChat = useMediaQuery(ADMIN_CHAT_MOBILE_BREAKPOINT);
  const mobileInboxMode = narrowChat && !activeConversation;
  const mobileThreadMode = narrowChat && activeConversation;

  async function openConversation(conversationId: string) {
    const response = await api<{ conversation: Conversation }>(`/admin/conversations/${conversationId}`, { token });
    setActiveConversation(response.conversation);
  }

  useEffect(() => {
    if (!initialConversationId) {
      return;
    }

    void (async () => {
      await openConversation(initialConversationId);
      onConversationOpened?.();
    })();
  }, [initialConversationId, onConversationOpened, token]);

  async function createNote(formElement: HTMLFormElement) {
    if (!activeConversation) return;
    const form = new FormData(formElement);
    const body = String(form.get('body') || '');

    await api(`/admin/conversations/${activeConversation.id}/notes`, {
      method: 'POST',
      token,
      body: JSON.stringify({ body }),
    });
    formElement.reset();
    await openConversation(activeConversation.id);
    await refresh();
  }

  async function sendAdminReply({ body, imageFile }: ChatComposerPayload) {
    if (!activeConversation) return;

    const imagePayload =
      imageFile && imageFile.size > 0 ? await uploadChatImage(token, imageFile) : {};

    if (!body && !('imageUrl' in imagePayload)) {
      throw new Error('Write a message or attach an image.');
    }

    await api(`/admin/conversations/${activeConversation.id}/messages`, {
      method: 'POST',
      token,
      body: JSON.stringify({ body, ...imagePayload }),
    });
    await openConversation(activeConversation.id);
    await refresh();
  }

  return (
    <section
      className={`admin-panel admin-chat${mobileInboxMode ? ' admin-chat--mobile-inbox' : ''}${
        mobileThreadMode ? ' admin-chat--mobile-thread' : ''
      }`}
    >
      <p className="admin-panel-lead muted">
        Inspect customer–artisan threads, reply as Bundo support, and keep private operational notes.
      </p>

      <div className="admin-chat-layout">
        <article className="admin-surface admin-chat-inbox">
          <div className="admin-surface-head">
            <div>
              <p className="eyebrow">Inbox</p>
              <h3>Conversations</h3>
            </div>
            <span className="admin-surface-count">{conversations.length}</span>
          </div>
          <div className="admin-chat-inbox-list">
            {conversations.length === 0 && (
              <EmptyState title="No conversations yet" body="Threads appear when customers and artisans message each other." />
            )}
            {conversations.map((conversation) => (
              <button
                className={`admin-chat-inbox-item${activeConversation?.id === conversation.id ? ' active' : ''}`}
                key={conversation.id}
                type="button"
                onClick={() => openConversation(conversation.id)}
              >
                <strong>{conversation.artisan?.displayName || 'Artisan'}</strong>
                <span>{conversation.customer?.email || conversation.customerId}</span>
              </button>
            ))}
          </div>
        </article>

        <article className="admin-surface admin-chat-thread">
          {narrowChat && activeConversation && (
            <button
              type="button"
              className="chat-back-button chat-back-button--block"
              onClick={() => setActiveConversation(null)}
              aria-label="Back to all conversations"
            >
              ← Back to inbox
            </button>
          )}
          <div className="admin-surface-head">
            <div>
              <p className="eyebrow">Thread</p>
              <h3>{activeConversation ? 'Messages & notes' : 'Select a conversation'}</h3>
            </div>
          </div>

          {!activeConversation && (
            <EmptyState
              title="No thread selected"
              body="Choose a conversation from the inbox to read messages and reply."
            />
          )}

          {activeConversation && (
            <>
              <div className="admin-chat-messages message-list">
                {(activeConversation.messages?.length ?? 0) === 0 && (
                  <p className="muted admin-chat-empty-copy">No messages in this thread yet.</p>
                )}
                {activeConversation.messages?.map((message) => (
                  <div className="message-bubble" key={message.id}>
                    <strong>{message.sender?.email || message.sender?.role || 'User'}</strong>
                    {message.imageUrl && (
                      <img className="chat-image" src={message.imageUrl} alt="Chat attachment" />
                    )}
                    {message.body && <p>{message.body}</p>}
                  </div>
                ))}
              </div>

              <ChatComposer
                busy={busy}
                className="admin-reply-form"
                placeholder="Reply as Bundo support"
                submitLabel="Send reply"
                onSubmit={(payload) => runAction(() => sendAdminReply(payload), 'Admin reply sent')}
              />

              <div className="admin-chat-notes">
                <h4>Internal notes</h4>
                {(activeConversation.adminNotes || []).length === 0 && (
                  <p className="muted admin-chat-empty-copy">No internal notes yet.</p>
                )}
                {activeConversation.adminNotes?.map((note) => (
                  <div className="note-row" key={note.id}>
                    <strong>{note.admin?.email || 'Admin'}</strong>
                    <p>{note.body}</p>
                  </div>
                ))}

                <form
                  className="admin-note-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const form = event.currentTarget;
                    runAction(() => createNote(form), 'Admin note saved');
                  }}
                >
                  <input name="body" placeholder="Add an internal note (not visible to users)" required />
                  <button type="submit" className="secondary-button" disabled={busy}>
                    Save note
                  </button>
                </form>
              </div>
            </>
          )}
        </article>
      </div>
    </section>
  );
}
