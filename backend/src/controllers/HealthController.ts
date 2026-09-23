import type { Request, Response } from 'express';
import { HealthService } from '../services/HealthService.js';

const healthService = new HealthService();

export async function getHealth(_request: Request, response: Response): Promise<void> {
  const status = await healthService.getStatus();
  response.status(status.status === 'ok' ? 200 : 503).json(status);
}
