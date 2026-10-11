import { Router } from 'express';
import { listDevices, renameDevice, revokeDeviceSession } from '../controllers/DeviceController.js';
import { requireAuth } from '../core/security/AuthMiddleware.js';
export const deviceRoutes=Router();
deviceRoutes.use(requireAuth);
deviceRoutes.get('/',listDevices);
deviceRoutes.patch('/:deviceId',renameDevice);
deviceRoutes.delete('/:deviceId/session',revokeDeviceSession);
