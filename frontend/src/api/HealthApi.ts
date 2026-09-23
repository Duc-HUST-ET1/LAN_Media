export interface BackendHealth {
  status: 'ok' | 'degraded';
  service: string;
  database: 'connected' | 'disconnected';
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '';

export async function getHealth(): Promise<BackendHealth> {
  const response = await fetch(`${apiBaseUrl}/api/health`);
  const health = await response.json() as BackendHealth;
  if (response.status >= 500 && !health.database) throw new Error(`Health request failed with HTTP ${response.status}`);
  return health;
}
