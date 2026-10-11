import { networkInterfaces } from 'node:os';
import { appConfig } from '../core/config/AppConfig.js';
import { database } from '../core/database/Database.js';
import { connectionManager } from '../websocket/ConnectionManager.js';
const startedAt=Date.now();
export class NetworkStatusService {
  async getStatus() {
    let db:'connected'|'disconnected'='connected'; try { await database.ping(); } catch { db='disconnected'; }
    const addresses=Object.values(networkInterfaces()).flatMap(list=>(list??[]).filter(item=>!item.internal&&item.family==='IPv4').map(item=>item.address));
    return {server:'available' as const,api:'available' as const,database:db,websocket:'available' as const,port:appConfig.port,
      addresses:[...new Set(addresses)],uptimeSeconds:Math.floor((Date.now()-startedAt)/1000),timestamp:new Date().toISOString(),onlineUsers:connectionManager.onlineUserIds().length};
  }
}
