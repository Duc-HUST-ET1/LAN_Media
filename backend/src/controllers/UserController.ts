import type { RequestHandler } from 'express';
import { ApiError } from '../core/errors/ApiError.js';
import { chatService } from './ChatController.js';
import { connectionManager } from '../websocket/ConnectionManager.js';
export const listUsers: RequestHandler = async (_req, res, next) => { try { const id = res.locals.authenticatedUser?.id; if (!id) throw new ApiError(401, 'Authentication required.'); res.json({ users: await chatService.contacts(id) }); } catch (e) { next(e); } };
export const onlineUsers: RequestHandler = async (_req, res, next) => { try { const users = await chatService.onlineUsers(connectionManager.onlineUserIds()); res.json({ users }); } catch (e) { next(e); } };
