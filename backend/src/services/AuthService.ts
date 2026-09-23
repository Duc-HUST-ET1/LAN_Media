import { appConfig } from '../core/config/AppConfig.js';
import { ApiError } from '../core/errors/ApiError.js';
import { PasswordHasher } from '../core/security/PasswordHasher.js';
import { TokenManager } from '../core/security/TokenManager.js';
import { UserRepository, toPublicUser } from '../repositories/UserRepository.js';
import { SessionRepository } from '../repositories/SessionRepository.js';
import type { User } from '../models/User.js';

export interface AuthenticatedSession {
  user: User;
  token: string;
  expiresAt: Date;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ApiError(400, `${field} is required.`);
  }
  return value;
}

function isDuplicateEntry(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ER_DUP_ENTRY';
}

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: SessionRepository,
    private readonly passwordHasher = new PasswordHasher(),
    private readonly tokenManager = new TokenManager(),
  ) {}

  async register(input: unknown): Promise<AuthenticatedSession> {
    if (!isObject(input)) throw new ApiError(400, 'A JSON object is required.');
    const username = requireString(input.username, 'Username').trim().toLowerCase();
    const email = requireString(input.email, 'Email').trim().toLowerCase();
    const displayName = requireString(input.displayName, 'Display name').trim();
    const password = requireString(input.password, 'Password');

    if (username.length < 3 || username.length > 32 || !/^[a-z0-9_.-]+$/.test(username)) {
      throw new ApiError(400, 'Username must be 3–32 characters and use letters, numbers, dots, dashes, or underscores.');
    }
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ApiError(400, 'Enter a valid email address.');
    }
    if (displayName.length > 80) throw new ApiError(400, 'Display name must be at most 80 characters.');
    if (password.length < 12 || password.length > 128) {
      throw new ApiError(400, 'Password must be between 12 and 128 characters.');
    }
    if (await this.users.existsByUsername(username)) throw new ApiError(409, 'Username is already in use.');
    if (await this.users.existsByEmail(email)) throw new ApiError(409, 'Email is already in use.');

    try {
      const created = await this.users.createUser({ username, email, displayName, passwordHash: await this.passwordHasher.hash(password) });
      return await this.createSession(created.id, toPublicUser(created));
    } catch (error) {
      if (isDuplicateEntry(error)) throw new ApiError(409, 'Username or email is already in use.');
      throw error;
    }
  }

  async login(input: unknown): Promise<AuthenticatedSession> {
    if (!isObject(input)) throw new ApiError(400, 'A JSON object is required.');
    const identifier = requireString(input.identifier ?? input.username, 'Username or email').trim().toLowerCase();
    const password = requireString(input.password, 'Password');
    const user = await this.users.findByLogin(identifier);
    const passwordMatches = user
      ? await this.passwordHasher.verify(password, user.passwordHash)
      : (await this.passwordHasher.hash(password), false);
    if (!user || !passwordMatches) {
      throw new ApiError(401, 'Invalid username/email or password.');
    }
    return this.createSession(user.id, toPublicUser(user));
  }

  async logout(token: string | null): Promise<void> {
    if (token) await this.sessions.revokeSession(this.tokenManager.hashToken(token));
  }

  private async createSession(userId: string, user: User): Promise<AuthenticatedSession> {
    const token = this.tokenManager.createToken();
    const expiresAt = new Date(Date.now() + appConfig.sessionTtlHours * 60 * 60 * 1000);
    await this.sessions.createSession(userId, this.tokenManager.hashToken(token), expiresAt);
    return { user, token, expiresAt };
  }
}
