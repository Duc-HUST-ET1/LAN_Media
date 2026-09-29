import { useEffect, useState } from 'react';
import { realtimeClient } from '../api/RealtimeClient';
export function useWebSocket(userId: string | null) {
  const [status, setStatus] = useState<'connected' | 'connecting' | 'disconnected'>('disconnected');
  useEffect(() => {
    if (!userId) { setStatus('disconnected'); return; }
    const unsubscribe = realtimeClient.onStatus(setStatus);
    const disconnect = realtimeClient.connect();
    return () => { unsubscribe(); disconnect(); };
  }, [userId]);
  return { status };
}
