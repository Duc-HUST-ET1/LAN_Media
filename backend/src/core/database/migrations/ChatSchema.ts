import type { Database } from '../Database.js';

// Additive migration: preserves Phase 2 conversations and messages.
export async function up(database: Database): Promise<void> {
  await database.execute("ALTER TABLE conversation_members ADD COLUMN member_role ENUM('MEMBER','ADMIN') NOT NULL DEFAULT 'MEMBER', ADD COLUMN left_at DATETIME(3) NULL");
  await database.execute("UPDATE conversation_members cm JOIN conversations c ON c.id = cm.conversation_id SET cm.member_role = 'ADMIN' WHERE c.created_by = cm.user_id");
  await database.execute('ALTER TABLE conversations ADD COLUMN name VARCHAR(160) NULL AFTER title');
  await database.execute('UPDATE conversations SET name = title WHERE title IS NOT NULL');
  await database.execute("ALTER TABLE messages ADD COLUMN type ENUM('TEXT') NOT NULL DEFAULT 'TEXT', ADD COLUMN content TEXT NULL AFTER body, ADD COLUMN updated_at DATETIME(3) NULL AFTER created_at");
  await database.execute('UPDATE messages SET content = body, updated_at = created_at');
  await database.execute('ALTER TABLE messages MODIFY content TEXT NOT NULL, MODIFY updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)');
  await database.execute('CREATE INDEX idx_messages_sender_created ON messages (sender_id, created_at)');
}
