import { Router } from 'express';
import { verifyFirebaseToken } from '../../middlewares/verifyFirebaseToken';
import { asyncHandler } from '../../middlewares/errorHandler';
import { ForbiddenError, NotFoundError, ValidationError } from '../../utils/errors';
import { respondIfChatSchemaError } from '../../utils/handleChatSchemaError';
import { throwOnServiceStatus } from '../../utils/resultErrors';
import { createCloudinarySignedUpload } from '../../utils/cloudinaryUploadConfig';
import {
  createMessage,
  getConversationMessages,
  getConversationsForUser,
  reportUserInConversation,
  updateMyConversationInboxState,
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

router.post(
  '/messages/sign-upload',
  verifyFirebaseToken,
  asyncHandler(async (_req, res) => {
    const upload = await createCloudinarySignedUpload('bundo/chat-images');

    res.json({
      message: 'Upload signature created',
      upload,
    });
  })
);

router.post(
  '/messages',
  verifyFirebaseToken,
  asyncHandler(async (req, res) => {
    try {
      const { artisanId, conversationId, body, imageUrl, imageCloudinaryId } = req.body;

      if (artisanId !== undefined && typeof artisanId !== 'string') {
        throw new ValidationError('artisanId must be a string');
      }

      if (conversationId !== undefined && typeof conversationId !== 'string') {
        throw new ValidationError('conversationId must be a string');
      }

      if (!artisanId && !conversationId) {
        throw new ValidationError('artisanId or conversationId is required');
      }

      const validationError = validateMessagePayload(body, imageUrl, imageCloudinaryId);

      if (validationError) {
        throw new ValidationError(validationError);
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

      throwOnServiceStatus(result.status, {
        missing_conversation: new NotFoundError('Conversation'),
        missing_artisan_id: new ValidationError('artisanId is required'),
        missing_artisan: new NotFoundError('Artisan'),
        self_message: new ForbiddenError('You cannot message yourself'),
        forbidden: new ForbiddenError('You can only message inside your own conversations'),
      });

      res.status(201).json({
        message: 'Message sent',
        conversation: result.conversation,
        chatMessage: result.message,
      });
    } catch (error: unknown) {
      if (respondIfChatSchemaError(error, res)) return;
      throw error;
    }
  })
);

router.get(
  '/conversations',
  verifyFirebaseToken,
  asyncHandler(async (req, res) => {
    try {
      const conversations = await getConversationsForUser({
        firebaseUid: (req as any).user.firebaseUid,
        role: (req as any).user.role,
      });

      res.json({
        message: 'Conversations fetched',
        conversations,
      });
    } catch (error: unknown) {
      if (respondIfChatSchemaError(error, res)) return;
      throw error;
    }
  })
);

router.patch(
  '/conversations/:id/inbox',
  verifyFirebaseToken,
  asyncHandler(async (req, res) => {
    try {
      const raw = req.body?.inbox;
      const allowed = ['ACTIVE', 'SPAM', 'ARCHIVED'] as const;
      if (typeof raw !== 'string' || !allowed.includes(raw as (typeof allowed)[number])) {
        throw new ValidationError('inbox must be ACTIVE, SPAM, or ARCHIVED');
      }

      const result = await updateMyConversationInboxState({
        conversationId: String(req.params.id),
        firebaseUid: (req as any).user.firebaseUid,
        role: (req as any).user.role,
        inbox: raw as 'ACTIVE' | 'SPAM' | 'ARCHIVED',
      });

      throwOnServiceStatus(result.status, {
        missing_conversation: new NotFoundError('Conversation'),
        forbidden: new ForbiddenError('You can only update your own conversations'),
      });

      res.json({ message: 'Conversation inbox updated' });
    } catch (error: unknown) {
      if (respondIfChatSchemaError(error, res)) return;
      throw error;
    }
  })
);

router.post(
  '/conversations/:id/report',
  verifyFirebaseToken,
  asyncHandler(async (req, res) => {
    try {
      const reportedUserId = req.body?.reportedUserId;
      const detail = req.body?.detail;

      if (typeof reportedUserId !== 'string' || !reportedUserId.trim()) {
        throw new ValidationError('reportedUserId is required');
      }

      if (detail !== undefined && typeof detail !== 'string') {
        throw new ValidationError('detail must be a string when provided');
      }

      const result = await reportUserInConversation({
        conversationId: String(req.params.id),
        reporterId: (req as any).user.firebaseUid,
        role: (req as any).user.role,
        reportedUserId: reportedUserId.trim(),
        detail: typeof detail === 'string' ? detail : null,
      });

      throwOnServiceStatus(result.status, {
        missing_conversation: new NotFoundError('Conversation'),
        forbidden: new ForbiddenError('You can only report from your own conversations'),
        invalid_reported_user: new ValidationError('You can only report the other person in this chat'),
      });

      res.status(201).json({ message: 'Report submitted. Our team may review this conversation.' });
    } catch (error: unknown) {
      if (respondIfChatSchemaError(error, res)) return;
      throw error;
    }
  })
);

router.post(
  '/conversations/:id/messages',
  verifyFirebaseToken,
  asyncHandler(async (req, res) => {
    try {
      const { body, imageUrl, imageCloudinaryId } = req.body;

      const validationError = validateMessagePayload(body, imageUrl, imageCloudinaryId);

      if (validationError) {
        throw new ValidationError(validationError);
      }

      const result = await createMessage({
        senderId: (req as any).user.firebaseUid,
        senderRole: (req as any).user.role,
        conversationId: String(req.params.id),
        body: typeof body === 'string' ? body : '',
        imageUrl,
        imageCloudinaryId,
      });

      throwOnServiceStatus(result.status, {
        missing_conversation: new NotFoundError('Conversation'),
        forbidden: new ForbiddenError('You can only message inside your own conversations'),
      });

      res.status(201).json({
        message: 'Message sent',
        conversation: result.conversation,
        chatMessage: result.message,
      });
    } catch (error: unknown) {
      if (respondIfChatSchemaError(error, res)) return;
      throw error;
    }
  })
);

router.get(
  '/conversations/:id/messages',
  verifyFirebaseToken,
  asyncHandler(async (req, res) => {
    try {
      const result = await getConversationMessages({
        conversationId: String(req.params.id),
        firebaseUid: (req as any).user.firebaseUid,
        role: (req as any).user.role,
      });

      throwOnServiceStatus(result.status, {
        missing_conversation: new NotFoundError('Conversation'),
        forbidden: new ForbiddenError('You can only view your own conversations'),
      });

      res.json({
        message: 'Conversation messages fetched',
        conversation: result.conversation,
        messages: result.messages,
      });
    } catch (error: unknown) {
      if (respondIfChatSchemaError(error, res)) return;
      throw error;
    }
  })
);

export default router;
