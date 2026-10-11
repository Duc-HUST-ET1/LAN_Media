import { Router } from 'express';
import { networkStatus } from '../controllers/NetworkController.js';
import { requireAuth } from '../core/security/AuthMiddleware.js';
export const networkRoutes=Router();
networkRoutes.get('/status',requireAuth,networkStatus);
