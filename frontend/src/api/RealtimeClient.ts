export interface RealtimeEvent { type: string; requestId?: string; payload?: Record<string, unknown>; error?: { code: string; message: string }; }
type Listener = (event: RealtimeEvent) => void;
type StatusListener = (status: 'connected' | 'connecting' | 'disconnected') => void;
class RealtimeClient {
  private socket: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private statusListeners = new Set<StatusListener>();
  private timer: number | undefined;
  private active = false;
  private attempt = 0;
  connect(): () => void {
    this.active = true;
    this.open();
    return () => { this.active = false; window.clearTimeout(this.timer); this.socket?.close(1000, 'Signed out'); this.socket = null; this.setStatus('disconnected'); };
  }
  subscribe(listener: Listener): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  onStatus(listener: StatusListener): () => void { this.statusListeners.add(listener); return () => this.statusListeners.delete(listener); }
  send(event: object): boolean {
    if (this.socket?.readyState !== WebSocket.OPEN) {
      console.warn('[realtime] send skipped; connection state:', this.socket?.readyState ?? 'not-created');
      return false;
    }
    this.socket.send(JSON.stringify(event)); return true;
  }
  private open(): void {
    if (!this.active) return;
    this.setStatus('connecting');
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${location.host}/ws`;
    console.info('[realtime] connecting:', url);
    const socket = new WebSocket(url);
    this.socket = socket;
    socket.onopen = () => { this.attempt = 0; console.info('[realtime] connected'); this.setStatus('connected'); };
    socket.onmessage = (message) => {
      try { const event = JSON.parse(String(message.data)) as RealtimeEvent; for (const listener of this.listeners) listener(event); } catch { /* Ignore malformed server frames. */ }
    };
    socket.onclose = (event) => {
      console.warn('[realtime] closed:', { code: event.code, reason: event.reason || '(no reason)' });
      if (this.socket === socket) this.socket = null;
      if (!this.active) return;
      if (event.code === 4401) { this.setStatus('disconnected'); return; }
      this.setStatus('disconnected');
      const delay = Math.min(30000, 500 * 2 ** Math.min(this.attempt++, 6));
      this.timer = window.setTimeout(() => this.open(), delay);
    };
    socket.onerror = () => { console.error('[realtime] WebSocket transport error'); socket.close(); };
  }
  private setStatus(status: 'connected' | 'connecting' | 'disconnected'): void { for (const listener of this.statusListeners) listener(status); }
}
export const realtimeClient = new RealtimeClient();
