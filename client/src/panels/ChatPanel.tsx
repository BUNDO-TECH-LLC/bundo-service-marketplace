import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { formatMessageTime } from '../lib/formatting';
import { ChatComposer, type ChatComposerPayload } from '../components/ChatComposer';
import { uploadChatImage } from '../lib/chatUpload';
import { ChatThreadOverflowMenu } from '../components/ChatThreadOverflowMenu';
import { useAppRoot } from '../app/appRootContext';
import { useMediaQuery } from '../hooks/useMediaQuery';
import type { ActionRunner } from '../appTypes';
import type { Conversation, Message } from '../types';

/** Matches `.messenger-shell` responsive breakpoint in `styles.css`. */
const MESSENGER_MOBILE_BREAKPOINT = '(max-width: 900px)';

export function ChatPanel({
  token,
  currentUserId,
  conversations,
  busy,
  runAction,
  refreshConversations,
}: {
  token: string;
  currentUserId: string;
  conversations: Conversation[];
  busy: boolean;
  runAction: ActionRunner;
  refreshConversations: () => Promise<void>;
}) {
  const { openArtisanProfile, me } = useAppRoot();
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [filter, setFilter] = useState<'all' | 'incoming'>('all');
  const narrowMessenger = useMediaQuery(MESSENGER_MOBILE_BREAKPOINT);
  const mobileInboxMode = narrowMessenger && !activeConversation;
  const mobileThreadMode = narrowMessenger && activeConversation;

  const incomingConversations = useMemo(
    () =>
      conversations.filter((conversation) => {
        const latest = conversation.messages?.[0];
        return Boolean(latest && latest.senderId !== currentUserId);
      }),
    [conversations, currentUserId]
  );
  const visibleConversations = filter === 'incoming' ? incomingConversations : conversations;

  const CHAT_POLL_MS = 12_000;

  async function fetchMessages(conversationId: string) {
    const response = await api<{
      conversation: Conversation;
      messages: Message[];
    }>(`/conversations/${conversationId}/messages`, { token });
    setActiveConversation(response.conversation);
    setMessages(response.messages);
  }

  async function openConversation(conversationId: string) {
    await fetchMessages(conversationId);
  }

  function backToInbox() {
    setActiveConversation(null);
    setMessages([]);
  }

  useEffect(() => {
    const refresh = () => {
      void refreshConversations().catch(() => undefined);
      if (activeConversation) {
        void fetchMessages(activeConversation.id).catch(() => undefined);
      }
    };

    // Skip polling while the tab is hidden to save requests/battery.
    const intervalId = window.setInterval(() => {
      if (document.hidden) {
        return;
      }
      refresh();
    }, CHAT_POLL_MS);

    // Refetch immediately when the user returns to the tab so chat feels live.
    const onVisible = () => {
      if (!document.hidden) {
        refresh();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [activeConversation?.id, refreshConversations, token]);

  async function reply({ body, imageFile }: ChatComposerPayload) {
    if (!activeConversation) return;

    const imagePayload =
      imageFile && imageFile.size > 0 ? await uploadChatImage(token, imageFile) : {};

    if (!body && !('imageUrl' in imagePayload)) {
      throw new Error('Write a message or attach an image.');
    }

    await api(`/conversations/${activeConversation.id}/messages`, {
      method: 'POST',
      token,
      body: JSON.stringify({ body, ...imagePayload }),
    });
    await openConversation(activeConversation.id);
    await refreshConversations();
  }

  function conversationTitle(conversation: Conversation) {
    return conversation.artisan?.displayName || conversation.customer?.email || 'Conversation';
  }

  function conversationInitial(conversation: Conversation) {
    return conversationTitle(conversation).slice(0, 1).toUpperCase();
  }

  function latestMessage(conversation: Conversation) {
    const latest = conversation.messages?.[0];
    return latest?.body || (latest?.imageUrl ? 'Photo attachment' : 'Booking conversation ready');
  }

  const viewerRole = me?.role;
  const canUseChatActions = viewerRole === 'CUSTOMER' || viewerRole === 'ARTISAN';
  const otherPartyFirebaseUid =
    activeConversation && canUseChatActions
      ? viewerRole === 'CUSTOMER'
        ? activeConversation.artisan?.userId ?? ''
        : activeConversation.customerId
      : '';

  async function afterInboxChange() {
    await refreshConversations();
    backToInbox();
  }

  return (
    <article
      className={`panel-card messages-panel${mobileInboxMode ? ' messages-panel--mobile-inbox' : ''}${
        mobileThreadMode ? ' messages-panel--mobile-thread' : ''
      }`}
    >
      <div className="messages-head">
        <div>
          <p className="eyebrow">Messages</p>
          <h2>Inbox</h2>
          <p>Chat with customers or artisans from one clean workspace.</p>
        </div>
        <div className="message-tabs" role="tablist" aria-label="Message filters">
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
            All messages
          </button>
          <button className={filter === 'incoming' ? 'active' : ''} onClick={() => setFilter('incoming')}>
            Incoming
          </button>
        </div>
      </div>

      <div
        className={`messenger-shell${mobileInboxMode ? ' messenger-shell--mobile-inbox' : ''}${
          mobileThreadMode ? ' messenger-shell--mobile-thread' : ''
        }`}
      >
        <aside className="conversation-rail">
          {visibleConversations.length === 0 && (
            <div className="conversation-empty">
              <strong>No {filter === 'incoming' ? 'incoming ' : ''}messages yet</strong>
              <span>Booking conversations appear here automatically when a job is opened.</span>
            </div>
          )}
          {visibleConversations.map((conversation) => {
            const latest = conversation.messages?.[0];
            const isIncoming = Boolean(latest && latest.senderId !== currentUserId);

            return (
              <button
                className={`conversation-row ${activeConversation?.id === conversation.id ? 'active' : ''}`}
                key={conversation.id}
                onClick={() => openConversation(conversation.id)}
              >
                <span className="conversation-avatar">{conversationInitial(conversation)}</span>
                <span className="conversation-copy">
                  <strong>{conversationTitle(conversation)}</strong>
                  <small>{latestMessage(conversation)}</small>
                </span>
                {isIncoming && <em>New</em>}
              </button>
            );
          })}
        </aside>

        <section className="chatbox">
          {!activeConversation && (
            <div className="chat-empty">
              <span className="conversation-avatar large">B</span>
              <h3>Select a conversation</h3>
              <p>Choose a thread from the left to read messages and send replies.</p>
            </div>
          )}

          {activeConversation && (
            <>
              <header className={`chatbox-head${narrowMessenger ? ' chatbox-head--mobile' : ''}`}>
                <div className="chatbox-head-main">
                  {narrowMessenger && (
                    <button type="button" className="chat-back-button" onClick={backToInbox} aria-label="Back to inbox">
                      ← Back
                    </button>
                  )}
                  <span className="conversation-avatar">{conversationInitial(activeConversation)}</span>
                  <div>
                    <h3>{conversationTitle(activeConversation)}</h3>
                    <p>
                      {activeConversation.artisan?.city ||
                        activeConversation.customer?.email ||
                        'Bundo conversation'}
                    </p>
                  </div>
                </div>
                {canUseChatActions && otherPartyFirebaseUid && (
                  <ChatThreadOverflowMenu
                    token={token}
                    conversationId={activeConversation.id}
                    viewerRole={viewerRole}
                    artisanProfileId={activeConversation.artisanId}
                    otherPartyFirebaseUid={otherPartyFirebaseUid}
                    customerContact={{
                      email: activeConversation.customer?.email,
                      phone: activeConversation.customer?.phone,
                    }}
                    busy={busy}
                    runAction={runAction}
                    onViewArtisanProfile={() => void openArtisanProfile(activeConversation.artisanId)}
                    onAfterInboxChange={afterInboxChange}
                  />
                )}
              </header>

              <div className="chat-message-list">
                <div className="chat-date-divider">
                  <span>Today</span>
                </div>
                {messages.map((message) => {
                  const mine = message.senderId === currentUserId;

                  return (
                    <div className={`chat-message-row ${mine ? 'mine' : 'theirs'}`} key={message.id}>
                      {!mine && <span className="conversation-avatar">{conversationInitial(activeConversation)}</span>}
                      <div className="chat-message">
                        {message.imageUrl && (
                          <img className="chat-image" src={message.imageUrl} alt="Chat attachment" />
                        )}
                        {message.body && <p>{message.body}</p>}
                        <small>
                          {formatMessageTime(message.createdAt)}
                          {mine ? ' Sent' : ''}
                        </small>
                      </div>
                    </div>
                  );
                })}
              </div>

              <ChatComposer
                busy={busy}
                placeholder="Write a message"
                submitLabel="Send"
                onSubmit={(payload) => runAction(() => reply(payload), 'Reply sent')}
              />
            </>
          )}
        </section>
      </div>
    </article>
  );
}
