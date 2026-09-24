import { Router } from 'express';
import { downloadFile, listConversationFiles, uploadFile } from '../controllers/FileController.js';
import { requireAuth } from '../core/security/AuthMiddleware.js';

export const fileRoutes = Router();
fileRoutes.post('/files/upload', requireAuth, uploadFile);
fileRoutes.get('/files/:fileId/download', requireAuth, downloadFile);
fileRoutes.get('/conversations/:conversationId/files', requireAuth, listConversationFiles);
