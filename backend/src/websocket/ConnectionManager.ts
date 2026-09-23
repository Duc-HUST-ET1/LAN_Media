import WebSocket from 'ws';
import type { User } from '../models/User.js';

interface ClientConnection { socket: WebSocket; sessionId: string; user: User; }
export class ConnectionManager {
  private readonly byUser = new Map<string, Set<ClientConnection>>();
  add(connection: ClientConnection): boolean {
    const connections = this.byUser.get(connection.user.id) ?? new Set<ClientConnection>();
    const becameOnline = connections.size === 0;
    connections.add(connection);
    this.byUser.set(connection.user.id, connections);
    return becameOnline;
  }
  remove(connection: ClientConnection): boolean {
    const connections = this.byUser.get(connection.user.id);
    if (!connections) return false;
    connections.delete(connection);
    if (connections.size) return false;
    this.byUser.delete(connection.user.id);
    return true;
  }
  isOnline(userId: string): boolean { return (this.byUser.get(userId)?.size ?? 0) > 0; }
  onlineUserIds(): string[] { return [...this.byUser.keys()]; }
  sendToUser(userId: string, event: unknown): void {
    const encoded = JSON.stringify(event);
    for (const connection of this.byUser.get(userId) ?? []) if (connection.socket.readyState === WebSocket.OPEN) connection.socket.send(encoded);
  }
  sendToUsers(userIds: string[], event: unknown): void { for (const id of new Set(userIds)) this.sendToUser(id, event); }
  broadcast(event: unknown, exceptUserId?: string): void { for (const id of this.onlineUserIds()) if (id !== exceptUserId) this.sendToUser(id, event); }
}
export const connectionManager = new ConnectionManager();
