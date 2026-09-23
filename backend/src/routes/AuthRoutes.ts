import { Router } from 'express';
import { currentUser, login, logout, register } from '../controllers/AuthController.js';
import { requireAuth } from '../core/security/AuthMiddleware.js';

export const authRoutes = Router();
authRoutes.use((_request, response, next) => {
  response.setHeader('Cache-Control', 'no-store');
  next();
});
authRoutes.post('/register', register);
authRoutes.post('/login', login);
authRoutes.post('/logout', logout);
authRoutes.get('/me', requireAuth, currentUser);
