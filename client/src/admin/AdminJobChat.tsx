import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { ChatComposer, type ChatComposerPayload } from '../components/ChatComposer';
import { uploadChatImage } from '../lib/chatUpload';
import type { ActionRunner } from '../appTypes';
import type { Conversation } from '../types';

export function AdminJobChat({
  token,
  conversationId,
  busy,
  runAction,
}: {
  token: string;
  conversationId: string;
  busy: boolean;
  runAction: ActionRunner;
}) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      setLoading(true);
      try {
        const response = await api<{ conversation: Conversation }>(
          `/admin/conversations/${conversationId}`,
          { token }
        );
        if (!cancelled) {
          setConversation(response.conversation);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [conversationId, token]);

  async function reload() {
    const response = await api<{ conversation: Conversation }>(
      `/admin/conversations/${conversationId}`,
      { token }
    );
    setConversation(response.conversation);
  }

  async function sendAdminReply({ body, imageFile }: ChatComposerPayload) {
    const imagePayload =
      imageFile && imageFile.size > 0 ? await uploadChatImage(token, imageFile) : {};

    if (!body && !('imageUrl' in imagePayload)) {
      throw new Error('Write a message or attach an image.');
    }

    await api(`/admin/conversations/${conversationId}/messages`, {
      method: 'POST',
      token,
      body: JSON.stringify({ body, ...imagePayload }),
    });
    await reload();
  }

  if (loading) {
    return <p className="admin-job-chat-loading">Loading conversation…</p>;
  }

  if (!conversation) {
    return <p className="admin-job-chat-loading">Conversation not found for this job.</p>;
  }

  return (
    <div className="admin-job-chat">
      <div className="message-list compact">
        {(conversation.messages || []).map((message) => (
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
        placeholder="Reply as Bundo support in this thread"
        submitLabel="Send reply"
        onSubmit={(payload) => runAction(() => sendAdminReply(payload), 'Admin reply sent')}
      />
    </div>
  );
}
