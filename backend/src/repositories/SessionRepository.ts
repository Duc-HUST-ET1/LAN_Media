import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import type { Database } from '../core/database/Database.js';
import type { User, UserRole } from '../models/User.js';

interface SessionUserRow extends RowDataPacket {
  id: string;
  username: string;
  email: string;
  display_name: string;
  avatar: string | null;
  role: UserRole;
  created_at: Date;
  updated_at: Date;
}

function toUser(row: SessionUserRow): User {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    displayName: row.display_name,
    avatar: row.avatar,
    role: row.role,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export class SessionRepository {
  constructor(private readonly database: Database) {}

  async createSession(userId: string, tokenHash: string, expiresAt: Date, deviceId?: string): Promise<string> {
    const id = randomUUID();
    await this.database.execute(
      'INSERT INTO sessions (id, user_id, token_hash, expires_at, device_id) VALUES (?, ?, ?, ?, ?)',
      [id, userId, tokenHash, expiresAt, deviceId ?? null],
    );
    return id;
  }

  async findSession(tokenHash: string): Promise<User | null> {
    const [row] = await this.database.query<SessionUserRow>(
      `SELECT u.id, u.username, u.email, u.display_name, u.avatar, u.role, u.created_at, u.updated_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > UTC_TIMESTAMP(3)
       LIMIT 1`,
      [tokenHash],
    );
    return row ? toUser(row) : null;
  }

  async findSessionIdentity(tokenHash: string): Promise<{ id: string; user: User } | null> {
    const [row] = await this.database.query<SessionUserRow & { session_id: string }>(
      `SELECT s.id AS session_id, u.id, u.username, u.email, u.display_name, u.avatar, u.role, u.created_at, u.updated_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > UTC_TIMESTAMP(3) LIMIT 1`, [tokenHash],
    );
    return row ? { id: row.session_id, user: toUser(row) } : null;
  }

  async revokeSession(tokenHash: string): Promise<void> {
    await this.database.execute(
      'UPDATE sessions SET revoked_at = UTC_TIMESTAMP(3) WHERE token_hash = ? AND revoked_at IS NULL',
      [tokenHash],
    );
  }

  async revokeSessionById(sessionId: string, userId: string): Promise<boolean> {
    const result = await this.database.execute('UPDATE sessions SET revoked_at = UTC_TIMESTAMP(3) WHERE id = ? AND user_id = ? AND revoked_at IS NULL', [sessionId, userId]);
    return result.affectedRows > 0;
  }

  async touchActivity(sessionId:string):Promise<void>{
    await this.database.execute(`UPDATE devices d JOIN sessions s ON s.device_id=d.id SET d.last_seen_at=UTC_TIMESTAMP(3),d.last_active_at=UTC_TIMESTAMP(3)
      WHERE s.id=? AND (d.last_active_at IS NULL OR d.last_active_at<DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 5 MINUTE))`,[sessionId]);
  }

  async deleteExpiredSessions(): Promise<number> {
    const result = await this.database.execute(
      'DELETE FROM sessions WHERE expires_at <= UTC_TIMESTAMP(3) OR revoked_at <= DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 30 DAY)',
    );
    return result.affectedRows;
  }
}
