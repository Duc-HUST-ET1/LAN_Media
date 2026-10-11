import type { RowDataPacket } from 'mysql2/promise';
import type { Database } from '../core/database/Database.js';

export interface DeviceInput { id: string; userId: string; name: string; deviceType: string; browserInfo: string | null }
interface DeviceRow extends RowDataPacket {
  id: string; name: string; device_type: string; browser_info: string | null; created_at: Date;
  last_seen_at: Date | null; last_active_at: Date | null; session_id: string | null; session_created_at: Date | null;
}

export class DeviceRepository {
  constructor(private readonly database: Database) {}
  async touchDevice(input: DeviceInput): Promise<string> {
    const existing=await this.database.query<{user_id:string}&RowDataPacket>('SELECT user_id FROM devices WHERE id=?',[input.id]);
    if(existing.length&&existing[0].user_id!==input.userId)input={...input,id:randomUUID()};
    await this.database.execute(`INSERT INTO devices (id,user_id,name,device_type,browser_info,last_seen_at,last_active_at)
      VALUES (?,?,?,?,?,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3)) ON DUPLICATE KEY UPDATE
      name=IF(user_id=VALUES(user_id),VALUES(name),name), device_type=IF(user_id=VALUES(user_id),VALUES(device_type),device_type),
      browser_info=IF(user_id=VALUES(user_id),VALUES(browser_info),browser_info), last_seen_at=IF(user_id=VALUES(user_id),UTC_TIMESTAMP(3),last_seen_at),
      last_active_at=IF(user_id=VALUES(user_id),UTC_TIMESTAMP(3),last_active_at)`,
    [input.id,input.userId,input.name,input.deviceType,input.browserInfo]);
    return input.id;
  }
  async list(userId: string): Promise<object[]> {
    return this.database.query<DeviceRow>(`SELECT d.id,d.name,d.device_type,d.browser_info,d.created_at,d.last_seen_at,d.last_active_at,
      s.id AS session_id,s.created_at AS session_created_at FROM devices d LEFT JOIN sessions s ON s.device_id=d.id AND s.user_id=d.user_id
      AND s.revoked_at IS NULL AND s.expires_at>UTC_TIMESTAMP(3) WHERE d.user_id=? ORDER BY COALESCE(d.last_active_at,d.created_at) DESC`,[userId])
      .then(rows=>rows.map(row=>({id:row.id,name:row.name,type:row.device_type,browserInfo:row.browser_info,createdAt:row.created_at,
        lastSeenAt:row.last_seen_at,lastActiveAt:row.last_active_at,sessionId:row.session_id,sessionCreatedAt:row.session_created_at})));
  }
  async rename(id: string,userId: string,name: string): Promise<boolean> {
    const result=await this.database.execute('UPDATE devices SET name=?,updated_at=UTC_TIMESTAMP(3) WHERE id=? AND user_id=?',[name,id,userId]);
    if(result.affectedRows>0)return true;
    return (await this.database.query<{id:string}&RowDataPacket>('SELECT id FROM devices WHERE id=? AND user_id=?',[id,userId])).length>0;
  }
}
import { randomUUID } from 'node:crypto';
