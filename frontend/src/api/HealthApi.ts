export interface BackendHealth {
  status: 'ok' | 'degraded';
  service: string;
  database: 'connected' | 'disconnected';
}

import { apiUrl } from './ServerConfig';

export async function getHealth(): Promise<BackendHealth> {
  const response = await fetch(apiUrl('/api/health'),{signal:AbortSignal.timeout(5000)});
  const health = await response.json() as BackendHealth;
  if (response.status >= 500 && !health.database) throw new Error(`Health request failed with HTTP ${response.status}`);
  return health;
}
