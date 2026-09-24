import { createReadStream } from 'node:fs';
import type { RequestHandler } from 'express';
import { pipeline } from 'node:stream/promises';
import { ApiError } from '../core/errors/ApiError.js';
import { appConfig } from '../core/config/AppConfig.js';
import { database } from '../core/database/Database.js';
import { FileRepository } from '../repositories/FileRepository.js';
import { MessageRepository } from '../repositories/MessageRepository.js';
import { chatService } from './ChatController.js';
import { FileService } from '../services/FileService.js';
import { connectionManager } from '../websocket/ConnectionManager.js';

const files = new FileService(new FileRepository(database), new MessageRepository(database), chatService, appConfig.maxFileSize, appConfig.allowedFileTypes);
const authenticatedId = (id?: string) => { if (!id) throw new ApiError(401, 'Authentication required.'); return id; };
const routeId = (value: string | string[] | undefined) => { if (typeof value !== 'string') throw new ApiError(400, 'Invalid file identifier.'); return value; };

export const uploadFile: RequestHandler = async (request, response, next) => {
  try {
    const conversationId = request.header('x-conversation-id');
    if (!conversationId || conversationId.length > 64) throw new ApiError(400, 'X-Conversation-Id is required.');
    const message = await files.upload(request, authenticatedId(response.locals.authenticatedUser?.id), conversationId);
    const conversation = (await chatService.listConversations(message.senderId)).find(item => item.id === conversationId);
    connectionManager.sendToUsers(conversation?.members.map(member => member.userId) ?? [message.senderId], { type: 'chat.message', payload: { message } });
    response.status(201).json({ message });
  } catch (error) { next(error); }
};

export const downloadFile: RequestHandler = async (request, response, next) => {
  try {
    const file = await files.openDownload(routeId(request.params.fileId), authenticatedId(response.locals.authenticatedUser?.id));
    const safeFallback = file.name.replace(/["\\\r\n]/g, '_');
    response.set({
      'Content-Type': file.mimeType,
      'Content-Length': String(file.size),
      'Content-Disposition': `attachment; filename="${safeFallback}"; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    });
    await pipeline(createReadStream(file.path), response);
  } catch (error) {
    if (response.headersSent) response.destroy();
    else next(error);
  }
};

export const listConversationFiles: RequestHandler = async (request, response, next) => {
  try {
    const conversationId = routeId(request.params.conversationId);
    const items = await files.listConversationFiles(conversationId, authenticatedId(response.locals.authenticatedUser?.id));
    response.json({ files: items.map(file => ({ id: file.id, name: file.originalName, size: file.size, mimeType: file.mimeType,
      downloadUrl: `/api/files/${encodeURIComponent(file.id)}/download`, senderName: file.senderName, createdAt: file.createdAt })) });
  } catch (error) { next(error); }
};
