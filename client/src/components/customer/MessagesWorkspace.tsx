import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import { uploadChatImage } from '../../lib/chatUpload';
import {
  formatConversationPreviewTime,
  formatMessageDayLabel,
  formatMessageTime,
} from '../../lib/formatting';
import { artisanProfileImageUrl } from '../../lib/profileImage';
import type { ActionRunner } from '../../appTypes';
import type { Conversation, Message } from '../../types';
import { AppIcon } from '../ui/AppIcon';
import { ProfileAvatar } from '../ui/ProfileAvatar';

type MessagesWorkspaceProps = {
  token: string;
  currentUserId: string;
  conversations: Conversation[];
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
  onSearchArtisans: () => void;
};

function conversationTitle(conversation: Conversation) {
  return conversation.artisan?.displayName || conversation.customer?.email || 'Conversation';
}

function latestMessagePreview(conversation: Conversation) {
  const latest = conversation.messages?.[0];
  if (!latest) {
    return 'Start a conversation';
  }

  if (latest.body) {
    return latest.body;
  }

  return latest.imageUrl ? 'Photo attachment' : 'New message';
}

function groupMessagesByDay(messages: Message[]) {
  const groups: { label: string; messages: Message[] }[] = [];

  for (const message of messages) {
    const label = formatMessageDayLabel(message.createdAt);
    const last = groups[groups.length - 1];

    if (last?.label === label) {
      last.messages.push(message);
    } else {
      groups.push({ label, messages: [message] });
    }
  }

  return groups;
}

export function MessagesWorkspace({
  token,
  currentUserId,
  conversations,
  busy,
  runAction,
  refresh,
  onSearchArtisans,
}: MessagesWorkspaceProps) {
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [listQuery, setListQuery] = useState('');
  const [loadingThread, setLoadingThread] = useState(false);

  const filteredConversations = useMemo(() => {
    const query = listQuery.trim().toLowerCase();
    if (!query) {
      return conversations;
    }

    return conversations.filter((conversation) => {
      const title = conversationTitle(conversation).toLowerCase();
      const preview = latestMessagePreview(conversation).toLowerCase();
      return title.includes(query) || preview.includes(query);
    });
  }, [conversations, listQuery]);

  const hasConversations = conversations.length > 0;
  const messageGroups = useMemo(() => groupMessagesByDay(messages), [messages]);

  async function openConversation(conversationId: string) {
    setLoadingThread(true);

    try {
      const response = await api<{
        conversation: Conversation;
        messages: Message[];
      }>(`/conversations/${conversationId}/messages`, { token });

      setActiveConversation(response.conversation);
      setMessages(response.messages);
    } finally {
      setLoadingThread(false);
    }
  }

  useEffect(() => {
    if (filteredConversations.length === 0) {
      setActiveConversation(null);
      setMessages([]);
      return;
    }

    const stillVisible = activeConversation
      ? filteredConversations.some((conversation) => conversation.id === activeConversation.id)
      : false;

    if (!stillVisible) {
      void openConversation(filteredConversations[0].id);
    }
  }, [filteredConversations, activeConversation?.id, token]);

  async function reply(formElement: HTMLFormElement) {
    if (!activeConversation) {
      return;
    }

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

  const showWelcome = !hasConversations;
  const showSelectPrompt = hasConversations && !activeConversation && !loadingThread;

  return (
    <div className="messages-workspace">
      <div className="messages-workspace__shell">
        <aside className="messages-workspace__sidebar" aria-label="Conversation list">
          <h1 className="messages-workspace__sidebar-title">Messages</h1>

          <label className="messages-workspace__sidebar-search">
            <AppIcon icon="mingcute:search-line" size={18} className="messages-workspace__sidebar-search-icon" />
            <input
              type="search"
              value={listQuery}
              onChange={(event) => setListQuery(event.target.value)}
              placeholder="Search conversations"
              aria-label="Search conversations"
            />
          </label>

          {!hasConversations ? (
            <p className="messages-workspace__sidebar-empty">Conversations will appear here</p>
          ) : filteredConversations.length === 0 ? (
            <p className="messages-workspace__sidebar-empty">No conversations match your search</p>
          ) : (
            <ul className="messages-workspace__conversation-list">
              {filteredConversations.map((conversation) => {
                const latest = conversation.messages?.[0];
                const isActive = activeConversation?.id === conversation.id;
                const avatarUrl = artisanProfileImageUrl(conversation.artisan);
                const title = conversationTitle(conversation);

                return (
                  <li key={conversation.id}>
                    <button
                      type="button"
                      className={`messages-workspace__conversation ${isActive ? 'is-active' : ''}`}
                      onClick={() => openConversation(conversation.id)}
                    >
                      <ProfileAvatar
                        name={title}
                        imageUrl={avatarUrl}
                        className="messages-workspace__conversation-avatar"
                        textClassName="text-sm"
                      />
                      <span className="messages-workspace__conversation-copy">
                        <strong>{title}</strong>
                        <small>{latestMessagePreview(conversation)}</small>
                      </span>
                      {latest ? (
                        <time className="messages-workspace__conversation-time" dateTime={latest.createdAt}>
                          {formatConversationPreviewTime(latest.createdAt)}
                        </time>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <section className="messages-workspace__panel" aria-label="Message thread">
          {showWelcome ? (
            <div className="messages-workspace__welcome">
              <span className="messages-workspace__welcome-icon" aria-hidden="true">
                <AppIcon icon="mdi:forum-outline" size={42} />
              </span>
              <h2>Welcome to messages</h2>
              <p>Once you connect with an artisan, you will be able to chat here</p>
              <button type="button" className="messages-workspace__cta" onClick={onSearchArtisans}>
                Search for artisans
              </button>
            </div>
          ) : null}

          {showSelectPrompt ? (
            <div className="messages-workspace__welcome">
              <span className="messages-workspace__welcome-icon" aria-hidden="true">
                <AppIcon icon="mdi:forum-outline" size={42} />
              </span>
              <h2>Select a conversation</h2>
              <p>Choose a thread from the left to read messages and send replies.</p>
            </div>
          ) : null}

          {activeConversation ? (
            <>
              <header className="messages-workspace__thread-head">
                <ProfileAvatar
                  name={conversationTitle(activeConversation)}
                  imageUrl={artisanProfileImageUrl(activeConversation.artisan)}
                  className="messages-workspace__thread-avatar"
                  textClassName="text-sm"
                />
                <div className="messages-workspace__thread-meta">
                  <h2>{conversationTitle(activeConversation)}</h2>
                  <p>
                    <span className="messages-workspace__online-dot" aria-hidden="true" />
                    Online
                  </p>
                </div>
              </header>

              <div className="messages-workspace__thread-body">
                {loadingThread ? (
                  <p className="messages-workspace__thread-loading">Loading conversation…</p>
                ) : (
                  messageGroups.map((group) => (
                    <div className="messages-workspace__day-group" key={group.label}>
                      <div className="messages-workspace__day-divider" aria-label={group.label}>
                        <span>{group.label}</span>
                      </div>
                      {group.messages.map((message) => {
                        const mine = message.senderId === currentUserId;

                        return (
                          <div
                            className={`messages-workspace__message-row ${mine ? 'is-mine' : 'is-theirs'}`}
                            key={message.id}
                          >
                            {!mine ? (
                              <ProfileAvatar
                                name={conversationTitle(activeConversation)}
                                imageUrl={artisanProfileImageUrl(activeConversation.artisan)}
                                className="messages-workspace__bubble-avatar"
                                textClassName="text-xs"
                              />
                            ) : null}
                            <div className="messages-workspace__bubble-wrap">
                              <div className="messages-workspace__bubble">
                                {message.imageUrl ? (
                                  <img
                                    className="messages-workspace__bubble-image"
                                    src={message.imageUrl}
                                    alt="Chat attachment"
                                  />
                                ) : null}
                                {message.body ? <p>{message.body}</p> : null}
                              </div>
                              <small className="messages-workspace__bubble-meta">
                                {formatMessageTime(message.createdAt)}
                                {mine ? (
                                  <>
                                    {' '}
                                    <span aria-hidden="true">•</span> <em>Sent</em>
                                  </>
                                ) : null}
                              </small>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>

              <form
                className="messages-workspace__composer"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  runAction(() => reply(form), '');
                }}
              >
                <div className="messages-workspace__composer-tools" aria-hidden="true">
                  <button type="button" tabIndex={-1} aria-label="Text formatting">
                    <AppIcon icon="mdi:format-letter-case" size={20} />
                  </button>
                  <button type="button" tabIndex={-1} aria-label="Voice message">
                    <AppIcon icon="mdi:microphone-outline" size={20} />
                  </button>
                  <button type="button" tabIndex={-1} aria-label="Emoji picker">
                    <AppIcon icon="mdi:emoticon-happy-outline" size={20} />
                  </button>
                </div>
                <label className="messages-workspace__composer-field">
                  <span className="sr-only">Message</span>
                  <input name="body" placeholder="Send a message..." disabled={busy || loadingThread} />
                  <label className="messages-workspace__composer-attach">
                    <AppIcon icon="mdi:image-outline" size={20} />
                    <span className="sr-only">Attach image</span>
                    <input name="image" type="file" accept="image/*" disabled={busy || loadingThread} />
                  </label>
                </label>
                <button
                  type="submit"
                  className="messages-workspace__composer-send"
                  disabled={busy || loadingThread}
                  aria-label="Send message"
                >
                  <AppIcon icon="mdi:send" size={22} />
                </button>
              </form>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
