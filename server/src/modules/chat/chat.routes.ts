import { Router } from 'express';
import { verifyFirebaseToken } from '../../middlewares/verifyFirebaseToken';
import { env } from '../../config/env';
import { buildCloudinaryUploadSignature } from '../../utils/cloudinarySignature';
import {
  createMessage,
  getConversationMessages,
  getConversationsForUser,
} from './chat.service';

const router = Router();

function validateMessagePayload(body: unknown, imageUrl: unknown, imageCloudinaryId: unknown) {
  if (body !== undefined && (typeof body !== 'string' || !body.trim())) {
    return 'body must be a non-empty string when provided';
  }

  if (imageUrl !== undefined && (typeof imageUrl !== 'string' || !imageUrl.trim())) {
    return 'imageUrl must be a non-empty string when provided';
  }

  if (
    imageCloudinaryId !== undefined &&
    (typeof imageCloudinaryId !== 'string' || !imageCloudinaryId.trim())
  ) {
    return 'imageCloudinaryId must be a non-empty string when provided';
  }

  if (!body && !imageUrl) {
    return 'body or imageUrl is required';
  }

  return null;
}

router.post('/messages/sign-upload', verifyFirebaseToken, async (_req, res) => {
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = 'bundo/chat-images';
  const signature = buildCloudinaryUploadSignature(
    { folder, timestamp },
    env.CLOUDINARY_API_SECRET
  );

  return res.json({
    message: 'Upload signature created',
    upload: {
      cloudName: env.CLOUDINARY_CLOUD_NAME,
      apiKey: env.CLOUDINARY_API_KEY,
      timestamp,
      folder,
      signature,
    },
  });
});

router.post('/messages', verifyFirebaseToken, async (req, res) => {
  const { artisanId, conversationId, body, imageUrl, imageCloudinaryId } = req.body;

  if (artisanId !== undefined && typeof artisanId !== 'string') {
    return res.status(400).json({ message: 'artisanId must be a string' });
  }

  if (conversationId !== undefined && typeof conversationId !== 'string') {
    return res.status(400).json({ message: 'conversationId must be a string' });
  }

  if (!artisanId && !conversationId) {
    return res.status(400).json({
      message: 'artisanId or conversationId is required',
    });
  }

  const validationError = validateMessagePayload(body, imageUrl, imageCloudinaryId);

  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  const result = await createMessage({
    senderId: (req as any).user.firebaseUid,
    senderRole: (req as any).user.role,
    artisanId,
    conversationId,
    body: typeof body === 'string' ? body : '',
    imageUrl,
    imageCloudinaryId,
  });

  if (result.status === 'missing_conversation') {
    return res.status(404).json({ message: 'Conversation not found' });
  }

  if (result.status === 'missing_artisan_id') {
    return res.status(400).json({ message: 'artisanId is required' });
  }

  if (result.status === 'missing_artisan') {
    return res.status(404).json({ message: 'Artisan not found' });
  }

  if (result.status === 'self_message') {
    return res.status(403).json({ message: 'You cannot message yourself' });
  }

  if (result.status === 'forbidden') {
    return res.status(403).json({
      message: 'You can only message inside your own conversations',
    });
  }

  return res.status(201).json({
    message: 'Message sent',
    conversation: result.conversation,
    chatMessage: result.message,
  });
});

router.get('/conversations', verifyFirebaseToken, async (req, res) => {
  const conversations = await getConversationsForUser({
    firebaseUid: (req as any).user.firebaseUid,
    role: (req as any).user.role,
  });

  return res.json({
    message: 'Conversations fetched',
    conversations,
  });
});

router.post('/conversations/:id/messages', verifyFirebaseToken, async (req, res) => {
  const { body, imageUrl, imageCloudinaryId } = req.body;

  const validationError = validateMessagePayload(body, imageUrl, imageCloudinaryId);

  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  const result = await createMessage({
    senderId: (req as any).user.firebaseUid,
    senderRole: (req as any).user.role,
    conversationId: String(req.params.id),
    body: typeof body === 'string' ? body : '',
    imageUrl,
    imageCloudinaryId,
  });

  if (result.status === 'missing_conversation') {
    return res.status(404).json({ message: 'Conversation not found' });
  }

  if (result.status === 'forbidden') {
    return res.status(403).json({
      message: 'You can only message inside your own conversations',
    });
  }

  return res.status(201).json({
    message: 'Message sent',
    conversation: result.conversation,
    chatMessage: result.message,
  });
});

router.get('/conversations/:id/messages', verifyFirebaseToken, async (req, res) => {
  const result = await getConversationMessages({
    conversationId: String(req.params.id),
    firebaseUid: (req as any).user.firebaseUid,
    role: (req as any).user.role,
  });

  if (result.status === 'missing_conversation') {
    return res.status(404).json({ message: 'Conversation not found' });
  }

  if (result.status === 'forbidden') {
    return res.status(403).json({
      message: 'You can only view your own conversations',
    });
  }

  return res.json({
    message: 'Conversation messages fetched',
    conversation: result.conversation,
    messages: result.messages,
  });
});

export default router;
