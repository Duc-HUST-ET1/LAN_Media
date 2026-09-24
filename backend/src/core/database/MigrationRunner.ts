import type { Database } from './Database.js';
import { up as initialSchema } from './migrations/InitialSchema.js';
import { up as chatSchema } from './migrations/ChatSchema.js';
import { up as fileTransferSchema } from './migrations/FileTransferSchema.js';

const migrations = [
  { version: '001_initial_schema', up: initialSchema },
  { version: '002_chat_schema', up: chatSchema },
  { version: '003_file_transfer_schema', up: fileTransferSchema },
];

export async function runMigrations(database: Database): Promise<void> {
  await database.execute(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(120) NOT NULL PRIMARY KEY,
    applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  const applied = await database.query<{ version: string } & import('mysql2/promise').RowDataPacket>(
    'SELECT version FROM schema_migrations',
  );
  const appliedVersions = new Set(applied.map((row) => row.version));

  for (const migration of migrations) {
    if (appliedVersions.has(migration.version)) continue;
    await migration.up(database);
    await database.execute('INSERT INTO schema_migrations (version) VALUES (?)', [migration.version]);
    console.log(`Database migration applied: ${migration.version}`);
  }
}
