import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import type { Database } from '../core/database/Database.js';
import type { Message } from '../models/Message.js';

interface MessageRow extends RowDataPacket { id: string; conversation_id: string; sender_id: string; sender_name: string; type: 'TEXT'; content: string; created_at: Date; }
export class MessageRepository {
  constructor(private readonly database: Database) {}
  async create(conversationId: string, senderId: string, content: string): Promise<Message> {
    const id = randomUUID();
    await this.database.execute("INSERT INTO messages (id, conversation_id, sender_id, body, type, content) VALUES (?, ?, ?, ?, 'TEXT', ?)", [id, conversationId, senderId, content, content]);
    const [row] = await this.database.query<MessageRow>(`SELECT m.id, m.conversation_id, m.sender_id, u.display_name AS sender_name, m.type, m.content, m.created_at
      FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.id = ?`, [id]);
    return this.map(row);
  }
  async list(conversationId: string, limit: number, before?: string): Promise<Message[]> {
    const rows = await this.database.query<MessageRow>(`SELECT m.id, m.conversation_id, m.sender_id, u.display_name AS sender_name, m.type, m.content, m.created_at
      FROM messages m JOIN users u ON u.id = m.sender_id WHERE m.conversation_id = ? ${before ? 'AND m.created_at < ?' : ''}
      ORDER BY m.created_at DESC LIMIT ?`, before ? [conversationId, new Date(before), limit] : [conversationId, limit]);
    return rows.map(row => this.map(row)).reverse();
  }
  private map(row: MessageRow): Message { return { id: row.id, conversationId: row.conversation_id, senderId: row.sender_id, senderName: row.sender_name, type: row.type, content: row.content, createdAt: new Date(row.created_at).toISOString() }; }
}
