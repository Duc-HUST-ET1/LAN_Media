import { Router } from 'express';
import { listUsers, onlineUsers } from '../controllers/UserController.js';
import { requireAuth } from '../core/security/AuthMiddleware.js';
export const userRoutes = Router();
userRoutes.get('/', requireAuth, listUsers);
userRoutes.get('/online', requireAuth, onlineUsers);
