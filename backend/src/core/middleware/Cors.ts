import type { RequestHandler } from 'express';
import { appConfig } from '../config/AppConfig.js';

export const corsMiddleware: RequestHandler = (request, response, next) => {
  const origin = request.headers.origin;
  if (origin) {
    if (!appConfig.frontendOrigins.includes(origin)) {
      response.status(403).json({ error: { message: 'Origin is not allowed.' } });
      return;
    }
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Vary', 'Origin');
  }

  if (request.method === 'OPTIONS') {
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    response.status(204).end();
    return;
  }
  next();
};
