export interface BackendHealth {
  status: 'ok';
  service: string;
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '';

export async function getHealth(): Promise<BackendHealth> {
  const response = await fetch(`${apiBaseUrl}/api/health`);
  if (!response.ok) throw new Error(`Health request failed with HTTP ${response.status}`);
  return response.json() as Promise<BackendHealth>;
}
