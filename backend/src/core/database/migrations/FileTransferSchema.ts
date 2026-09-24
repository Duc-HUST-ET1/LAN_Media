import type { Database } from '../Database.js';

// Additive migration: retain all existing users, conversations, messages and files.
export async function up(database: Database): Promise<void> {
  await database.execute("ALTER TABLE messages MODIFY type ENUM('TEXT','FILE') NOT NULL DEFAULT 'TEXT'");
  await database.execute('ALTER TABLE files ADD COLUMN conversation_id CHAR(36) NULL AFTER owner_id, ADD COLUMN message_id CHAR(36) NULL AFTER conversation_id');
  await database.execute('CREATE INDEX idx_files_conversation_created ON files (conversation_id, created_at)');
  await database.execute('CREATE UNIQUE INDEX uq_files_message ON files (message_id)');
  await database.execute('ALTER TABLE files ADD CONSTRAINT fk_files_conversation FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE, ADD CONSTRAINT fk_files_message FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE SET NULL');
}
