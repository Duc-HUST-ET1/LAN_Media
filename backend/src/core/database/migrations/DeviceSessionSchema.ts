import type { Database } from '../Database.js';

export async function up(database: Database): Promise<void> {
  async function addColumn(table:string,column:string,definition:string):Promise<void>{
    const rows=await database.query<{name:string}&import('mysql2/promise').RowDataPacket>(
      'SELECT COLUMN_NAME AS name FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?',[table,column]);
    if(!rows.length)await database.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
  await addColumn('devices','browser_info','VARCHAR(120) NULL');
  await addColumn('devices','last_active_at','DATETIME(3) NULL');
  await addColumn('devices','updated_at','DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)');
  await addColumn('sessions','device_id','CHAR(36) NULL');
  const indexes=await database.query<{name:string}&import('mysql2/promise').RowDataPacket>(
    `SELECT INDEX_NAME AS name FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='sessions' AND INDEX_NAME='idx_sessions_device_active'`);
  if(!indexes.length)await database.execute('ALTER TABLE sessions ADD KEY idx_sessions_device_active (device_id,revoked_at,expires_at)');
  const constraints=await database.query<{name:string}&import('mysql2/promise').RowDataPacket>(
    `SELECT CONSTRAINT_NAME AS name FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=DATABASE() AND TABLE_NAME='sessions' AND CONSTRAINT_NAME='fk_sessions_device'`,
  );
  if(!constraints.length) await database.execute(`ALTER TABLE sessions ADD CONSTRAINT fk_sessions_device
    FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE SET NULL`);
}
