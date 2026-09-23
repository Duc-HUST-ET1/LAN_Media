import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import type { Database } from '../core/database/Database.js';
import type { User, UserRecord, UserRole } from '../models/User.js';

interface UserRow extends RowDataPacket {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  display_name: string;
  avatar: string | null;
  role: UserRole;
  created_at: Date;
  updated_at: Date;
}

function toRecord(row: UserRow): UserRecord {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    passwordHash: row.password_hash,
    displayName: row.display_name,
    avatar: row.avatar,
    role: row.role,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export function toPublicUser(user: UserRecord | User): User {
  const { id, username, email, displayName, avatar, role, createdAt, updatedAt } = user;
  return { id, username, email, displayName, avatar, role, createdAt, updatedAt };
}

const columns = 'id, username, email, password_hash, display_name, avatar, role, created_at, updated_at';

export class UserRepository {
  constructor(private readonly database: Database) {}

  async createUser(input: { username: string; email: string; passwordHash: string; displayName: string }): Promise<UserRecord> {
    const id = randomUUID();
    await this.database.execute(
      'INSERT INTO users (id, username, email, password_hash, display_name) VALUES (?, ?, ?, ?, ?)',
      [id, input.username, input.email, input.passwordHash, input.displayName],
    );
    const user = await this.findById(id);
    if (!user) throw new Error('Created user could not be loaded.');
    return user;
  }

  async findById(id: string): Promise<UserRecord | null> {
    const [row] = await this.database.query<UserRow>(`SELECT ${columns} FROM users WHERE id = ? LIMIT 1`, [id]);
    return row ? toRecord(row) : null;
  }

  async listPublicExcept(userId: string): Promise<User[]> {
    const rows = await this.database.query<UserRow>(`SELECT ${columns} FROM users WHERE id <> ? ORDER BY display_name, username`, [userId]);
    return rows.map((row) => toPublicUser(toRecord(row)));
  }

  async listPublic(): Promise<User[]> {
    const rows = await this.database.query<UserRow>(`SELECT ${columns} FROM users ORDER BY display_name, username`);
    return rows.map((row) => toPublicUser(toRecord(row)));
  }

  async findByUsername(username: string): Promise<UserRecord | null> {
    const [row] = await this.database.query<UserRow>(`SELECT ${columns} FROM users WHERE username = ? LIMIT 1`, [username]);
    return row ? toRecord(row) : null;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    const [row] = await this.database.query<UserRow>(`SELECT ${columns} FROM users WHERE email = ? LIMIT 1`, [email]);
    return row ? toRecord(row) : null;
  }

  async findByLogin(login: string): Promise<UserRecord | null> {
    const [row] = await this.database.query<UserRow>(`SELECT ${columns} FROM users WHERE username = ? OR email = ? LIMIT 1`, [login, login]);
    return row ? toRecord(row) : null;
  }

  async existsByUsername(username: string): Promise<boolean> {
    const [row] = await this.database.query<UserRow>('SELECT id FROM users WHERE username = ? LIMIT 1', [username]);
    return row !== undefined;
  }

  async existsByEmail(email: string): Promise<boolean> {
    const [row] = await this.database.query<UserRow>('SELECT id FROM users WHERE email = ? LIMIT 1', [email]);
    return row !== undefined;
  }
}
