import { database } from '../core/database/Database.js';

export interface HealthStatus {
  status: 'ok' | 'degraded';
  service: 'LAN-Media Backend';
  database: 'connected' | 'disconnected';
}

export class HealthService {
  async getStatus(): Promise<HealthStatus> {
    try {
      await database.ping();
      return { status: 'ok', service: 'LAN-Media Backend', database: 'connected' };
    } catch {
      return { status: 'degraded', service: 'LAN-Media Backend', database: 'disconnected' };
    }
  }
}
