export interface HealthStatus {
  status: 'ok';
  service: 'LAN-Media Backend';
}

export class HealthService {
  getStatus(): HealthStatus {
    return { status: 'ok', service: 'LAN-Media Backend' };
  }
}
