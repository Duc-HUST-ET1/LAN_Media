import { useEffect, useState } from 'react';
import { realtimeClient } from '../api/RealtimeClient';
export function useWebSocket(enabled: boolean) {
  const [status, setStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');
  useEffect(() => {
    if (!enabled) { setStatus('disconnected'); return; }
    const unsubscribe = realtimeClient.onStatus(setStatus);
    const disconnect = realtimeClient.connect();
    return () => { unsubscribe(); disconnect(); };
  }, [enabled]);
  return { status };
}
