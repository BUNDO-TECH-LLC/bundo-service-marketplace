import { useState } from 'react';
import { api } from '../lib/api';
import { uploadChatImage } from '../lib/chatUpload';
import type { ActionRunner } from '../appTypes';
import type { Conversation } from '../types';

export function AdminChatPanel({
  token,
  conversations,
  busy,
  runAction,
  refresh,
}: {
  token: string;
  conversations: Conversation[];
  busy: boolean;
  runAction: ActionRunner;
  refresh: () => Promise<void>;
}) {
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);

  async function openConversation(conversationId: string) {
    const response = await api<{ conversation: Conversation }>(`/admin/conversations/${conversationId}`, { token });
    setActiveConversation(response.conversation);
  }

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

  async function sendAdminReply(formElement: HTMLFormElement) {
    if (!activeConversation) return;
    const form = new FormData(formElement);
    const body = String(form.get('body') || '').trim();
    const imageFile = form.get('image');
    const imagePayload =
      imageFile instanceof File && imageFile.size > 0 ? await uploadChatImage(token, imageFile) : {};

    if (!body && !('imageUrl' in imagePayload)) {
      throw new Error('Write a message or attach an image.');
    }

    await api(`/admin/conversations/${activeConversation.id}/messages`, {
      method: 'POST',
      token,
      body: JSON.stringify({ body, ...imagePayload }),
    });
    formElement.reset();
    await openConversation(activeConversation.id);
    await refresh();
  }

  return (
    <section className="admin-chat">
      <section className="section-head compact">
        <p className="eyebrow">Support</p>
        <h2>Conversation access</h2>
        <p>Admins can inspect customer/artisan chats, reply as Bundo support, and leave private operational notes.</p>
      </section>
      <div className="dashboard-grid">
        <article className="panel-card">
          <h2>All conversations</h2>
          {conversations.length === 0 && <p>No conversations yet.</p>}
          {conversations.map((conversation) => (
            <button className="list-button" key={conversation.id} onClick={() => openConversation(conversation.id)}>
              <strong>{conversation.artisan?.displayName || 'Artisan'}</strong>
              <span>{conversation.customer?.email || conversation.customerId}</span>
            </button>
          ))}
        </article>

        <article className="panel-card wide-panel">
          <h2>Thread and notes</h2>
          {!activeConversation && <p>Select a conversation to review messages and notes.</p>}
          {activeConversation && (
            <>
              <div className="message-list">
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

              <form
                className="reply-form admin-reply-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  runAction(() => sendAdminReply(form), 'Admin reply sent');
                }}
              >
                <label className="chat-attach-button">
                  Photo
                  <input name="image" type="file" accept="image/*" disabled={busy} />
                </label>
                <input name="body" placeholder="Reply in this customer-artisan chat as Bundo support" />
                <button disabled={busy}>Send reply</button>
              </form>

              <h3>Admin notes</h3>
              {(activeConversation.adminNotes || []).length === 0 && <p>No notes yet.</p>}
              {activeConversation.adminNotes?.map((note) => (
                <div className="note-row" key={note.id}>
                  <strong>{note.admin?.email || 'Admin'}</strong>
                  <p>{note.body}</p>
                </div>
              ))}

              <form
                className="reply-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  runAction(() => createNote(form), 'Admin note saved');
                }}
              >
                <input name="body" placeholder="Add an internal note" required />
                <button disabled={busy}>Save note</button>
              </form>
            </>
          )}
        </article>
      </div>
    </section>
  );
}
