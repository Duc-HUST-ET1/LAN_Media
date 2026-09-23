import type { Request, RequestHandler } from 'express';
import type { User } from '../../models/User.js';
import { SessionRepository } from '../../repositories/SessionRepository.js';
import { database } from '../database/Database.js';
import { TokenManager } from './TokenManager.js';

export const sessionCookieName = 'lan_media_session';
const sessions = new SessionRepository(database);
const tokens = new TokenManager();

export function getSessionToken(request: Request): string | null {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) return null;
  for (const cookie of cookieHeader.split(';')) {
    const separator = cookie.indexOf('=');
    if (separator < 0 || cookie.slice(0, separator).trim() !== sessionCookieName) continue;
    try {
      return decodeURIComponent(cookie.slice(separator + 1).trim()) || null;
    } catch {
      return null;
    }
  }
  return null;
}

export function serializeSessionCookie(token: string, maxAgeSeconds: number): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${sessionCookieName}=${encodeURIComponent(token)}; Max-Age=${maxAgeSeconds}; Path=/; HttpOnly; SameSite=Lax${secure}`;
}

export function serializeClearedSessionCookie(): string {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `${sessionCookieName}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax${secure}`;
}

export function hashSessionToken(token: string): string {
  return tokens.hashToken(token);
}

export const requireAuth: RequestHandler = async (request, response, next) => {
  try {
    const token = getSessionToken(request);
    if (!token) {
      response.status(401).json({ error: { message: 'Authentication required.' } });
      return;
    }
    const user: User | null = await sessions.findSession(tokens.hashToken(token));
    if (!user) {
      response.status(401).json({ error: { message: 'Authentication required.' } });
      return;
    }
    response.locals.authenticatedUser = user;
    next();
  } catch (error) {
    next(error);
  }
};
