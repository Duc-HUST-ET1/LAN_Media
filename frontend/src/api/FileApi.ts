import type { ChatMessage } from './ChatApi';

export interface TransferProgress { loaded: number; total?: number; percent?: number; }
interface SaveFileHandle { createWritable(): Promise<{ write(data: Uint8Array): Promise<void>; close(): Promise<void>; abort(): Promise<void>; }>; }
type SavePickerWindow = Window & { showSaveFilePicker?: (options: { suggestedName: string }) => Promise<SaveFileHandle> };
export const FileApi = {
  upload(conversationId: string, file: File, onProgress: (progress: TransferProgress) => void): Promise<ChatMessage> {
    return new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open('POST', '/api/files/upload');
      request.withCredentials = true;
      request.setRequestHeader('X-Conversation-Id', conversationId);
      request.upload.onprogress = event => onProgress({ loaded: event.loaded, total: event.lengthComputable ? event.total : undefined, percent: event.lengthComputable ? Math.round(event.loaded / event.total * 100) : undefined });
      request.onerror = () => reject(new Error('Upload failed. Check your connection and try again.'));
      request.onabort = () => reject(new Error('Upload was cancelled.'));
      request.onload = () => {
        let body: { message?: ChatMessage; error?: { message?: string } } = {};
        try { body = JSON.parse(request.responseText) as typeof body; } catch { /* handled below */ }
        if (request.status < 200 || request.status >= 300 || !body.message) reject(new Error(body.error?.message ?? 'Upload failed.'));
        else resolve(body.message);
      };
      const form = new FormData();
      form.append('file', file, file.name);
      request.send(form);
    });
  },

  async download(fileId: string, suggestedName: string, onProgress: (progress: TransferProgress) => void): Promise<void> {
    const savePicker = (window as SavePickerWindow).showSaveFilePicker;
    const handle = savePicker ? await savePicker.call(window, { suggestedName }) : undefined;
    const response = await fetch(`/api/files/${encodeURIComponent(fileId)}/download`, { credentials: 'include' });
    if (!response.ok) {
      let message = 'Download failed.';
      try { message = (await response.json() as { error?: { message?: string } }).error?.message ?? message; } catch { /* keep fallback */ }
      throw new Error(message);
    }
    if (!response.body) throw new Error('Streaming downloads are not supported by this browser.');
    const total = Number(response.headers.get('content-length')) || undefined;
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;
    const disposition = response.headers.get('content-disposition') ?? '';
    const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
    const fallback = disposition.match(/filename="?([^";]+)"?/i)?.[1];
    const name = encoded ? decodeURIComponent(encoded) : fallback ?? 'download';
    const writable = await handle?.createWritable();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (writable) await writable.write(value); else chunks.push(value);
        loaded += value.byteLength;
        onProgress({ loaded, total, percent: total ? Math.min(100, Math.round(loaded / total * 100)) : undefined });
      }
      await writable?.close();
    } catch (error) {
      await writable?.abort().catch(() => undefined);
      throw error;
    }
    if (writable) return;
    const blob = new Blob(chunks, { type: response.headers.get('content-type') ?? 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
};
