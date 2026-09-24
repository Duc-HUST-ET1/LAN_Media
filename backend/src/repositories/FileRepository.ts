import { randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import type { Database } from '../core/database/Database.js';

export interface StoredFile { id: string; ownerId: string; conversationId: string; messageId: string | null; originalName: string; storageKey: string; mimeType: string; size: number; }
export interface SharedFile extends StoredFile { senderName: string; createdAt: string; }
interface FileRow extends RowDataPacket { id: string; owner_id: string; conversation_id: string; message_id: string | null; original_name: string; storage_path: string; media_type: string; size_bytes: string | number; }
interface SharedFileRow extends FileRow { sender_name: string; created_at: Date; }
export class FileRepository {
  constructor(private readonly database: Database) {}
  async create(input: Omit<StoredFile, 'id' | 'messageId'>): Promise<string> {
    const id = randomUUID();
    await this.database.execute('INSERT INTO files (id, owner_id, conversation_id, original_name, storage_path, media_type, size_bytes) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, input.ownerId, input.conversationId, input.originalName, input.storageKey, input.mimeType, input.size]);
    return id;
  }
  async find(id: string): Promise<StoredFile | null> {
    const [row] = await this.database.query<FileRow>('SELECT id, owner_id, conversation_id, message_id, original_name, storage_path, media_type, size_bytes FROM files WHERE id = ?', [id]);
    return row ? { id: row.id, ownerId: row.owner_id, conversationId: row.conversation_id, messageId: row.message_id,
      originalName: row.original_name, storageKey: row.storage_path, mimeType: row.media_type, size: Number(row.size_bytes) } : null;
  }
  async listForConversation(conversationId: string): Promise<SharedFile[]> {
    const rows = await this.database.query<SharedFileRow>(`SELECT f.id, f.owner_id, f.conversation_id, f.message_id, f.original_name, f.storage_path, f.media_type, f.size_bytes,
      u.display_name AS sender_name, m.created_at FROM files f JOIN messages m ON m.id = f.message_id
      JOIN users u ON u.id = m.sender_id WHERE f.conversation_id = ? AND m.type = 'FILE' ORDER BY m.created_at DESC`, [conversationId]);
    return rows.map(row => ({ id: row.id, ownerId: row.owner_id, conversationId: row.conversation_id, messageId: row.message_id,
      originalName: row.original_name, storageKey: row.storage_path, mimeType: row.media_type, size: Number(row.size_bytes),
      senderName: row.sender_name, createdAt: new Date(row.created_at).toISOString() }));
  }
  async removeAfterFailedUpload(fileId: string, messageId?: string): Promise<void> {
    if (messageId) await this.database.execute('DELETE FROM messages WHERE id = ?', [messageId]);
    await this.database.execute("DELETE FROM messages WHERE type = 'FILE' AND content = ?", [fileId]);
    await this.database.execute('DELETE FROM files WHERE id = ?', [fileId]);
  }
}
