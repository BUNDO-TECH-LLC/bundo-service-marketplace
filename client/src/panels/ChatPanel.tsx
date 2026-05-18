import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { formatMessageTime } from '../lib/formatting';
import { uploadChatImage } from '../lib/chatUpload';
import type { ActionRunner } from '../appTypes';
import type { Conversation, Message } from '../types';

export function ChatPanel({
  token,
  currentUserId,
  conversations,
  busy,
  runAction,
  refresh,
}: {
  token: string;
  currentUserId: string;
  conversations: Conversation[];
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
}) {
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [filter, setFilter] = useState<'all' | 'incoming'>('all');

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

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refresh().catch(() => undefined);
      if (activeConversation) {
        void fetchMessages(activeConversation.id).catch(() => undefined);
      }
    }, CHAT_POLL_MS);

    return () => window.clearInterval(intervalId);
  }, [activeConversation?.id, token]);

  async function reply(formElement: HTMLFormElement) {
    if (!activeConversation) return;
    const form = new FormData(formElement);
    const body = String(form.get('body') || '').trim();
    const imageFile = form.get('image');
    const imagePayload =
      imageFile instanceof File && imageFile.size > 0 ? await uploadChatImage(token, imageFile) : {};

    if (!body && !('imageUrl' in imagePayload)) {
      throw new Error('Write a message or attach an image.');
    }

    await api(`/conversations/${activeConversation.id}/messages`, {
      method: 'POST',
      token,
      body: JSON.stringify({ body, ...imagePayload }),
    });
    formElement.reset();
    await openConversation(activeConversation.id);
    await refresh();
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

  return (
    <article className="panel-card messages-panel">
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

      <div className="messenger-shell">
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
              <header className="chatbox-head">
                <span className="conversation-avatar">{conversationInitial(activeConversation)}</span>
                <div>
                  <h3>{conversationTitle(activeConversation)}</h3>
                  <p>
                    {activeConversation.artisan?.city ||
                      activeConversation.customer?.email ||
                      'Bundo conversation'}
                  </p>
                </div>
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

              <form
                className="chat-composer"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  runAction(() => reply(form), 'Reply sent');
                }}
              >
                <label className="chat-attach-button">
                  Photo
                  <input name="image" type="file" accept="image/*" disabled={busy} />
                </label>
                <input name="body" placeholder="Write a message" />
                <button disabled={busy}>Send</button>
              </form>
            </>
          )}
        </section>
      </div>
    </article>
  );
}
