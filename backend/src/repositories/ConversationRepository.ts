import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import type { Database } from '../core/database/Database.js';
import type { Conversation, ConversationMember } from '../models/Conversation.js';

interface ConversationRow extends RowDataPacket { id: string; type: 'DIRECT' | 'GROUP'; name: string | null; created_by: string; updated_at: Date; }
interface MemberRow extends RowDataPacket { user_id: string; username: string; display_name: string; member_role: 'MEMBER' | 'ADMIN'; }
export class ConversationRepository {
  constructor(private readonly database: Database) {}

  async isMember(conversationId: string, userId: string): Promise<boolean> {
    const rows = await this.database.query<RowDataPacket & { found: number }>("SELECT 1 AS found FROM conversation_members WHERE conversation_id = ? AND user_id = ? AND left_at IS NULL LIMIT 1", [conversationId, userId]);
    return rows.length > 0;
  }

  async getRole(conversationId: string, userId: string): Promise<'MEMBER' | 'ADMIN' | null> {
    const [row] = await this.database.query<RowDataPacket & { member_role: 'MEMBER' | 'ADMIN' }>("SELECT member_role FROM conversation_members WHERE conversation_id = ? AND user_id = ? AND left_at IS NULL", [conversationId, userId]);
    return row?.member_role ?? null;
  }

  async getType(conversationId: string): Promise<'DIRECT' | 'GROUP' | null> {
    const [row] = await this.database.query<RowDataPacket & { type: 'DIRECT' | 'GROUP' }>('SELECT type FROM conversations WHERE id = ? LIMIT 1', [conversationId]);
    return row?.type ?? null;
  }

  async listForUser(userId: string): Promise<Conversation[]> {
    const rows = await this.database.query<ConversationRow>(`SELECT c.id, c.type, c.name, c.created_by, c.updated_at
      FROM conversations c JOIN conversation_members cm ON cm.conversation_id = c.id
      WHERE cm.user_id = ? AND cm.left_at IS NULL ORDER BY c.updated_at DESC`, [userId]);
    return Promise.all(rows.map(async row => ({ ...this.map(row), members: await this.members(row.id) })));
  }

  async members(conversationId: string): Promise<ConversationMember[]> {
    const rows = await this.database.query<MemberRow>(`SELECT u.id AS user_id, u.username, u.display_name, cm.member_role
      FROM conversation_members cm JOIN users u ON u.id = cm.user_id
      WHERE cm.conversation_id = ? AND cm.left_at IS NULL ORDER BY cm.joined_at`, [conversationId]);
    return rows.map(row => ({ userId: row.user_id, username: row.username, displayName: row.display_name, role: row.member_role }));
  }

  async createGroup(creatorId: string, name: string, memberIds: string[]): Promise<Conversation> {
    const id = randomUUID();
    await this.database.execute("INSERT INTO conversations (id, type, title, name, created_by) VALUES (?, 'GROUP', ?, ?, ?)", [id, name, name, creatorId]);
    const ids = [...new Set([creatorId, ...memberIds])];
    for (const userId of ids) await this.database.execute("INSERT INTO conversation_members (conversation_id, user_id, member_role) VALUES (?, ?, ?)", [id, userId, userId === creatorId ? 'ADMIN' : 'MEMBER']);
    const [row] = await this.database.query<ConversationRow>('SELECT id, type, name, created_by, updated_at FROM conversations WHERE id = ?', [id]);
    return { ...this.map(row), members: await this.members(id) };
  }

  async createOrFindDirect(userA: string, userB: string): Promise<Conversation> {
    const rows = await this.database.query<ConversationRow>(`SELECT c.id, c.type, c.name, c.created_by, c.updated_at FROM conversations c
      JOIN conversation_members a ON a.conversation_id = c.id AND a.user_id = ? AND a.left_at IS NULL
      JOIN conversation_members b ON b.conversation_id = c.id AND b.user_id = ? AND b.left_at IS NULL
      WHERE c.type = 'DIRECT' AND (SELECT COUNT(*) FROM conversation_members cm WHERE cm.conversation_id = c.id AND cm.left_at IS NULL) = 2
      ORDER BY c.created_at LIMIT 1`, [userA, userB]);
    if (rows[0]) return { ...this.map(rows[0]), members: await this.members(rows[0].id) };
    const id = randomUUID();
    await this.database.execute("INSERT INTO conversations (id, type, created_by) VALUES (?, 'DIRECT', ?)", [id, userA]);
    await this.database.execute("INSERT INTO conversation_members (conversation_id, user_id, member_role) VALUES (?, ?, 'ADMIN'), (?, ?, 'MEMBER')", [id, userA, id, userB]);
    const [row] = await this.database.query<ConversationRow>('SELECT id, type, name, created_by, updated_at FROM conversations WHERE id = ?', [id]);
    return { ...this.map(row), members: await this.members(id) };
  }

  async addMembers(conversationId: string, userIds: string[]): Promise<void> {
    for (const userId of [...new Set(userIds)]) {
      const existing = await this.database.query<RowDataPacket & { user_id: string; left_at: Date | null }>('SELECT user_id, left_at FROM conversation_members WHERE conversation_id = ? AND user_id = ?', [conversationId, userId]);
      if (existing.length === 0) await this.database.execute("INSERT INTO conversation_members (conversation_id, user_id, member_role) VALUES (?, ?, 'MEMBER')", [conversationId, userId]);
      else if (existing[0].left_at !== null) await this.database.execute("UPDATE conversation_members SET left_at = NULL, member_role = 'MEMBER', joined_at = UTC_TIMESTAMP(3) WHERE conversation_id = ? AND user_id = ?", [conversationId, userId]);
    }
  }

  async removeMember(conversationId: string, userId: string): Promise<void> {
    await this.database.execute('UPDATE conversation_members SET left_at = UTC_TIMESTAMP(3) WHERE conversation_id = ? AND user_id = ? AND left_at IS NULL', [conversationId, userId]);
  }

  async activeAdminCount(conversationId: string): Promise<number> {
    const [row] = await this.database.query<RowDataPacket & { count: number }>("SELECT COUNT(*) AS count FROM conversation_members WHERE conversation_id = ? AND member_role = 'ADMIN' AND left_at IS NULL", [conversationId]);
    return row?.count ?? 0;
  }
  private map(row: ConversationRow): Omit<Conversation, 'members'> { return { id: row.id, type: row.type, name: row.name, createdBy: row.created_by, updatedAt: new Date(row.updated_at).toISOString() }; }
}
