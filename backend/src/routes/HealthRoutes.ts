import { Router } from 'express';
import { getHealth } from '../controllers/HealthController.js';

export const healthRoutes = Router();
healthRoutes.get('/health', getHealth);
