import type { Request, Response } from 'express';
import { appConfig } from '../core/config/AppConfig.js';
import { getSessionToken, serializeClearedSessionCookie, serializeSessionCookie } from '../core/security/AuthMiddleware.js';
import { database } from '../core/database/Database.js';
import { SessionRepository } from '../repositories/SessionRepository.js';
import { UserRepository } from '../repositories/UserRepository.js';
import { AuthService } from '../services/AuthService.js';

const authService = new AuthService(new UserRepository(database), new SessionRepository(database));
const cookieMaxAge = appConfig.sessionTtlHours * 60 * 60;

export async function register(request: Request, response: Response): Promise<void> {
  const session = await authService.register(request.body as unknown);
  response.setHeader('Set-Cookie', serializeSessionCookie(session.token, cookieMaxAge));
  response.status(201).json({ user: session.user });
}

export async function login(request: Request, response: Response): Promise<void> {
  const session = await authService.login(request.body as unknown);
  response.setHeader('Set-Cookie', serializeSessionCookie(session.token, cookieMaxAge));
  response.status(200).json({ user: session.user });
}

export async function logout(request: Request, response: Response): Promise<void> {
  await authService.logout(getSessionToken(request));
  response.setHeader('Set-Cookie', serializeClearedSessionCookie());
  response.status(204).end();
}

export function currentUser(_request: Request, response: Response): void {
  if (!response.locals.authenticatedUser) {
    response.status(401).json({ error: { message: 'Authentication required.' } });
    return;
  }
  response.json({ user: response.locals.authenticatedUser });
}
