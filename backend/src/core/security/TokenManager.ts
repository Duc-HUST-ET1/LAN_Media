import { createHash, randomBytes } from 'node:crypto';

export class TokenManager {
  createToken(): string {
    return randomBytes(32).toString('base64url');
  }

  hashToken(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }
}
