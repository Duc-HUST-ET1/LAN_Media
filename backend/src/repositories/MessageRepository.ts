import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import type { Database } from '../core/database/Database.js';
import type { FileMetadata, Message } from '../models/Message.js';

interface MessageRow extends RowDataPacket {
  id: string; conversation_id: string; sender_id: string; sender_name: string; type: 'TEXT' | 'FILE'; content: string;
  created_at: Date; file_id: string | null; original_name: string | null; size_bytes: string | number | null; media_type: string | null;
}
const selectMessage = `SELECT m.id, m.conversation_id, m.sender_id, u.display_name AS sender_name, m.type, m.content, m.created_at,
  f.id AS file_id, f.original_name, f.size_bytes, f.media_type
  FROM messages m JOIN users u ON u.id = m.sender_id LEFT JOIN files f ON f.message_id = m.id`;

export class MessageRepository {
  constructor(private readonly database: Database) {}
  async create(conversationId: string, senderId: string, content: string): Promise<Message> {
    const id = randomUUID();
    await this.database.execute("INSERT INTO messages (id, conversation_id, sender_id, body, type, content) VALUES (?, ?, ?, ?, 'TEXT', ?)", [id, conversationId, senderId, content, content]);
    return this.get(id);
  }
  async createFile(conversationId: string, senderId: string, fileId: string): Promise<Message> {
    const id = randomUUID();
    await this.database.execute("INSERT INTO messages (id, conversation_id, sender_id, body, type, content) VALUES (?, ?, ?, ?, 'FILE', ?)", [id, conversationId, senderId, '[file]', fileId]);
    await this.database.execute('UPDATE files SET message_id = ? WHERE id = ?', [id, fileId]);
    return this.get(id);
  }
  async get(id: string): Promise<Message> {
    const [row] = await this.database.query<MessageRow>(`${selectMessage} WHERE m.id = ?`, [id]);
    if (!row) throw new Error('Message could not be loaded.');
    return this.map(row);
  }
  async list(conversationId: string, limit: number, before?: string): Promise<Message[]> {
    const rows = await this.database.query<MessageRow>(`${selectMessage} WHERE m.conversation_id = ? ${before ? 'AND m.created_at < ?' : ''}
      ORDER BY m.created_at DESC LIMIT ?`, before ? [conversationId, new Date(before), limit] : [conversationId, limit]);
    return rows.map(row => this.map(row)).reverse();
  }
  private map(row: MessageRow): Message {
    const file: FileMetadata | undefined = row.file_id ? {
      id: row.file_id, name: row.original_name ?? 'download', size: Number(row.size_bytes ?? 0), mimeType: row.media_type ?? 'application/octet-stream',
      downloadUrl: `/api/files/${encodeURIComponent(row.file_id)}/download`,
    } : undefined;
    return { id: row.id, conversationId: row.conversation_id, senderId: row.sender_id, senderName: row.sender_name, type: row.type,
      content: row.type === 'FILE' ? '' : row.content, ...(file ? { file } : {}), createdAt: new Date(row.created_at).toISOString() };
  }
}
