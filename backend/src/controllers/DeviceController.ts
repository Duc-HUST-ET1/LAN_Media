import type { Request, Response } from 'express';
import { ApiError } from '../core/errors/ApiError.js';
import { database } from '../core/database/Database.js';
import { DeviceRepository } from '../repositories/DeviceRepository.js';
import { SessionRepository } from '../repositories/SessionRepository.js';
import { connectionManager } from '../websocket/ConnectionManager.js';
import type { User } from '../models/User.js';

const devices = new DeviceRepository(database);
const sessions = new SessionRepository(database);
function user(response:Response):User{return response.locals.authenticatedUser as User;}
function deviceId(request:Request):string{const id=request.params.deviceId;if(typeof id!=='string'||!/^[0-9a-f-]{36}$/i.test(id))throw new ApiError(400,'Invalid device ID.');return id;}
export async function listDevices(_request: Request,response: Response): Promise<void> {
  const rows=await devices.list(user(response).id);
  const active=connectionManager.activeSessionIds();
  response.json({devices:rows.map((row:any)=>({...row,online:row.sessionId ? active.has(row.sessionId) : false,sessionStatus:row.sessionId?'active':'offline'}))});
}
export async function renameDevice(request: Request,response: Response): Promise<void> {
  const id=deviceId(request);const name=(request.body as {name?:unknown})?.name;
  if(typeof name!=='string'||!name.trim()||name.trim().length>120) throw new ApiError(400,'Device name must be between 1 and 120 characters.');
  const changed=await devices.rename(id,user(response).id,name.trim());
  if(!changed) throw new ApiError(404,'Device not found.'); response.json({ok:true});
}
export async function revokeDeviceSession(request: Request,response: Response): Promise<void> {
  const id=deviceId(request),userId=user(response).id;
  const owned=await database.query<{id:string}&import('mysql2/promise').RowDataPacket>('SELECT id FROM devices WHERE id=? AND user_id=?',[id,userId]);
  if(!owned.length) throw new ApiError(404,'Device not found.');
  const rows=await database.query<{id:string}&import('mysql2/promise').RowDataPacket>(`SELECT id FROM sessions WHERE device_id=? AND user_id=? AND revoked_at IS NULL AND expires_at>UTC_TIMESTAMP(3)`,[id,userId]);
  for(const row of rows) { await sessions.revokeSessionById(row.id,userId); connectionManager.closeSession(row.id); }
  response.json({revoked:rows.length});
}
