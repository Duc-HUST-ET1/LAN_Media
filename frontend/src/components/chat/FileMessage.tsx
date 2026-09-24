import type { ChatFile } from '../../api/ChatApi';
import type { TransferProgress } from '../../api/FileApi';

export interface DownloadState extends TransferProgress { status: 'downloading' | 'complete' | 'failed'; error?: string; }
function formatSize(size: number): string {
  if (size < 1024) return `${size} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = size / 1024; let index = 0;
  while (value >= 1024 && index < units.length - 1) { value /= 1024; index++; }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[index]}`;
}

export function FileMessage({ file, state, onDownload }: { file: ChatFile; state?: DownloadState; onDownload: () => void }) {
  return <div className="chat-file-card">
    <div className="chat-file-icon" aria-hidden="true">↧</div>
    <div className="chat-file-details"><strong title={file.name}>{file.name}</strong><small>{formatSize(file.size)} · {file.mimeType}</small>
      {state?.status === 'downloading' && <><progress max={100} value={state.percent ?? 0} /><small>{state.percent === undefined ? `${formatSize(state.loaded)} downloaded` : `${state.percent}%`} {state.total ? `· ${formatSize(state.loaded)} / ${formatSize(state.total)}` : ''}</small></>}
      {state?.status === 'complete' && <small>Download complete</small>}
      {state?.status === 'failed' && <small className="chat-file-error">{state.error ?? 'Download failed.'}</small>}
    </div>
    <button className="chat-file-download" type="button" onClick={onDownload} disabled={state?.status === 'downloading'}>{state?.status === 'downloading' ? 'Downloading…' : 'Download'}</button>
  </div>;
}

export function formatFileSize(size: number): string { return formatSize(size); }
