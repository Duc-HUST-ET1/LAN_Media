import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChatApi, type ChatMessage, type Conversation } from '../../api/ChatApi';
import { FileApi, type TransferProgress } from '../../api/FileApi';
import { FileMessage, formatFileSize, type DownloadState } from '../../components/chat/FileMessage';
import { realtimeClient, type RealtimeEvent } from '../../api/RealtimeClient';
import './ChatPage.css';
export default function ChatPage({ userId }: { userId: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [contacts, setContacts] = useState<Awaited<ReturnType<typeof ChatApi.contacts>>>([]);
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sharedFiles, setSharedFiles] = useState<Awaited<ReturnType<typeof ChatApi.files>>>([]);
  const [rightTab, setRightTab] = useState<'details' | 'files'>('details');
  const [draft, setDraft] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploadState, setUploadState] = useState<{ conversationId: string; name: string; status: 'uploading' | 'complete' | 'failed'; loaded: number; total?: number; percent?: number; error?: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [downloads, setDownloads] = useState<Record<string, DownloadState>>({});
  const fileInput = useRef<HTMLInputElement>(null);
  const activeIdRef = useRef(activeId);
  activeIdRef.current = activeId;
  const scrollRef = useRef<HTMLDivElement>(null);
  const active = useMemo(() => conversations.find(item => item.id === activeId) ?? null, [conversations, activeId]);
  const activePeer = active?.members.find(member => member.userId !== userId);
  const activeTitle = active?.type === 'GROUP' ? active.name ?? 'Group conversation' : activePeer?.displayName ?? 'Direct conversation';
  const refresh = useCallback(async () => {
    try {
      const [cs, people, onlinePeople] = await Promise.all([ChatApi.conversations(), ChatApi.contacts(), ChatApi.online()]);
      setConversations(cs); setContacts(people); setOnline(new Set(onlinePeople.map(person => person.id)));
      setActiveId(current => current && cs.some(item => item.id === current) ? current : cs[0]?.id ?? null); setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load conversations.'); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    setSelectedFile(null); setUploadState(null); setError(''); setSharedFiles([]);
    if (!activeId) { setMessages([]); return; }
    let current = true;
    ChatApi.messages(activeId).then(items => { if (current) setMessages(items); }).catch(cause => { if (current) setError(cause instanceof Error ? cause.message : 'Could not load messages.'); });
    ChatApi.files(activeId).then(items => { if (current) setSharedFiles(items); }).catch(cause => { if (current) setError(cause instanceof Error ? cause.message : 'Could not load shared files.'); });
    return () => { current = false; };
  }, [activeId]);
  useEffect(() => {
    if (uploadState?.status !== 'complete') return;
    const completed = uploadState;
    const timer = window.setTimeout(() => setUploadState(current => current === completed ? null : current), 4000);
    return () => window.clearTimeout(timer);
  }, [uploadState]);
  useEffect(() => {
    const unsubscribe = realtimeClient.subscribe((event: RealtimeEvent) => {
      if (event.type === 'chat.message') {
        const message = event.payload?.message as ChatMessage | undefined;
        if (message) {
          if (message.conversationId === activeId) {
            setMessages(old => old.some(item => item.id === message.id) ? old : [...old, message]);
            if (message.type === 'FILE') void ChatApi.files(activeId).then(setSharedFiles).catch(() => undefined);
          }
          void refresh();
        }
      }
      if (event.type === 'presence.online' || event.type === 'presence.offline') {
        const id = event.payload?.userId;
        if (typeof id === 'string') setOnline(old => { const next = new Set(old); if (event.type === 'presence.online') next.add(id); else next.delete(id); return next; });
      }
      if (event.type === 'chat.typing.start' || event.type === 'chat.typing.stop') setTyping(event.type === 'chat.typing.start' && event.payload?.conversationId === activeId);
      if (event.type === 'error') setError(event.error?.message ?? 'Realtime request failed.');
    });
    return unsubscribe;
  }, [activeId, refresh]);
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages]);
  async function openDirect(id: string) { setBusy(true); try { const conversation = await ChatApi.direct(id); await refresh(); setActiveId(conversation.id); } catch (e) { setError(e instanceof Error ? e.message : 'Could not open chat.'); } finally { setBusy(false); } }
  async function createGroup() {
    const name = window.prompt('Group name'); if (!name?.trim()) return;
    const names = window.prompt(`Member usernames, separated by commas:\n${contacts.map(person => person.username).join(', ')}`);
    if (names === null) return;
    const requested = new Set(names.split(',').map(value => value.trim().toLowerCase()).filter(Boolean));
    const selected = contacts.filter(person => requested.has(person.username.toLowerCase())).map(person => person.id);
    if (!selected.length) { setError('Select at least one other member to create a group.'); return; }
    setBusy(true); try { const conversation = await ChatApi.group(name, selected); await refresh(); setActiveId(conversation.id); } catch (e) { setError(e instanceof Error ? e.message : 'Could not create group.'); } finally { setBusy(false); }
  }
  async function sendMessage() {
    const content = draft.trim();
    if (!content && !selectedFile) { setError('Write a message or attach a file before sending.'); return; }
    if (!active) { setError('Select a conversation first.'); return; }
    const conversationId = active.id;
    setError(''); setSending(true);
    try {
      if (selectedFile) {
        const file = selectedFile;
        setUploadState({ conversationId, name: file.name, status: 'uploading', loaded: 0, total: file.size, percent: 0 });
        try {
          const message = await FileApi.upload(conversationId, file, (progress: TransferProgress) => setUploadState({ conversationId, name: file.name, status: 'uploading', ...progress }));
          if (activeIdRef.current === conversationId) {
            setMessages(old => old.some(item => item.id === message.id) ? old : [...old, message]);
            setSharedFiles(await ChatApi.files(conversationId));
          }
          setSelectedFile(current => current === file ? null : current);
          setUploadState({ conversationId, name: file.name, status: 'complete', loaded: file.size, total: file.size, percent: 100 });
        } catch (cause) {
          const reason = cause instanceof Error ? cause.message : 'Upload failed.';
          setUploadState({ conversationId, name: file.name, status: 'failed', loaded: 0, total: file.size, error: reason });
          if (activeId === conversationId) setError(reason);
          return;
        }
      }
      if (content) {
        if (!realtimeClient.send({ type: 'chat.send', requestId: crypto.randomUUID(), payload: { conversationId, content } })) {
          if (activeId === conversationId) setError('Realtime connection is offline. Reconnecting…');
          return;
        }
        setDraft(''); realtimeClient.send({ type: 'chat.typing.stop', payload: { conversationId } });
      }
    } finally { setSending(false); }
  }
  async function downloadFile(fileId: string, suggestedName?: string) {
    setDownloads(old => ({ ...old, [fileId]: { status: 'downloading', loaded: 0, percent: 0 } }));
    try {
      const file = messages.find(message => message.file?.id === fileId)?.file;
      await FileApi.download(fileId, suggestedName ?? file?.name ?? 'download', progress => setDownloads(old => ({ ...old, [fileId]: { status: 'downloading', ...progress } })));
      setDownloads(old => ({ ...old, [fileId]: { ...old[fileId], status: 'complete', percent: 100 } }));
    } catch (cause) {
      setDownloads(old => ({ ...old, [fileId]: { ...old[fileId], status: 'failed', error: cause instanceof Error ? cause.message : 'Download failed.' } }));
    }
  }
  async function addPeople() {
    if (!active) return;
    const candidates = contacts.filter(person => !active.members.some(member => member.userId === person.id));
    const names = window.prompt(`Member usernames, separated by commas:\n${candidates.map(person => person.username).join(', ')}`);
    if (names === null) return;
    const requested = new Set(names.split(',').map(value => value.trim().toLowerCase()).filter(Boolean));
    const ids = candidates.filter(person => requested.has(person.username.toLowerCase())).map(person => person.id); if (!ids.length) return;
    try { const updated = await ChatApi.addMembers(active.id, ids); setConversations(old => old.map(item => item.id === updated.id ? updated : item)); } catch (e) { setError(e instanceof Error ? e.message : 'Could not add members.'); }
  }
  async function removePerson(id: string, name: string) {
    if (!active || !window.confirm(`Remove ${name} from this group?`)) return;
    try { await ChatApi.removeMember(active.id, id); await refresh(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not remove member.'); }
  }
  return <div className="chat-page">
    <div className="chat-heading"><div><p className="eyebrow">REALTIME MESSAGING</p><h1>Chat</h1><p className="intro">Private conversations on your local network.</p></div><button className="chat-new-group" disabled={busy || !contacts.length} onClick={() => void createGroup()}>＋ New group</button></div>
    {error && <div className="chat-error" role="alert">{error}</div>}
    <div className="chat-layout"><aside className="chat-list"><div className="chat-section-title">CONVERSATIONS</div>
      {conversations.map(conversation => {
        const peer = conversation.members.find(member => member.userId !== userId);
        const label = conversation.type === 'GROUP' ? conversation.name ?? 'Group' : peer?.displayName ?? 'Direct chat';
        return <button key={conversation.id} onClick={() => setActiveId(conversation.id)} className={`chat-list-item${activeId === conversation.id ? ' is-active' : ''}`}><span className="chat-avatar">{label.slice(0, 1).toUpperCase()}</span><span className="chat-list-copy"><strong>{label}</strong><small>{conversation.type === 'GROUP' ? `${conversation.members.length} members` : peer?.username}</small></span>{conversation.type === 'DIRECT' && <i className={`presence-dot${peer && online.has(peer.userId) ? ' is-online' : ''}`} />}</button>;
      })}
      <div className="chat-section-title chat-contacts-title">PEOPLE</div>
      {contacts.map(person => <button key={person.id} className="chat-list-item contact-item" onClick={() => void openDirect(person.id)} disabled={busy}><span className="chat-avatar chat-avatar--small">{person.displayName.slice(0, 1).toUpperCase()}</span><span className="chat-list-copy"><strong>{person.displayName}</strong><small>@{person.username}</small></span><i className={`presence-dot${online.has(person.id) ? ' is-online' : ''}`} /></button>)}
      {!contacts.length && <p className="chat-empty-hint">No other registered users yet.</p>}
    </aside>
    <section className="chat-panel" aria-label="Conversation">{active ? <>
      <header className="chat-panel-head"><div><strong>{active.type === 'GROUP' ? active.name : active.members.find(member => member.userId !== userId)?.displayName ?? 'Direct conversation'}</strong><small>{active.type === 'GROUP' ? `${active.members.length} members` : 'LAN conversation'}</small></div>{active.type === 'GROUP' && active.members.some(member => member.role === 'ADMIN' && member.userId === userId) && <button className="chat-quiet-button" onClick={() => void addPeople()}>Add people</button>}</header>
      <div className="chat-messages" ref={scrollRef}>{!messages.length && <div className="chat-empty"><span>✳</span><strong>No messages yet</strong><p>Send a message to start the conversation.</p></div>}{messages.map(message => <article key={message.id} className={`chat-message${message.senderId === userId ? ' is-own' : ''}`}><div className="chat-message-meta"><strong>{message.senderName}</strong><time>{new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(message.createdAt))}</time></div>{message.type === 'FILE' && message.file ? <FileMessage file={message.file} state={downloads[message.file.id]} onDownload={() => void downloadFile(message.file!.id)} /> : message.type === 'FILE' ? <p>File attachment is unavailable.</p> : <p>{message.content}</p>}</article>)}{typing && <p className="chat-typing">A member is typing…</p>}</div>
      {uploadState?.conversationId === active.id && <div className={`chat-upload-status is-${uploadState.status}`} role="status"><strong>{uploadState.name}</strong><small>{uploadState.status === 'complete' ? 'File sent' : uploadState.status === 'failed' ? uploadState.error : `${uploadState.percent ?? 0}% · ${formatFileSize(uploadState.loaded)} / ${formatFileSize(uploadState.total ?? 0)}`}</small>{uploadState.status === 'uploading' && <progress max={100} value={uploadState.percent ?? 0} />}{uploadState.status !== 'uploading' && <button type="button" aria-label="Dismiss upload status" onClick={() => setUploadState(null)}>×</button>}</div>}
      <form className="chat-compose" onSubmit={event => { event.preventDefault(); void sendMessage(); }}>{selectedFile && <div className="chat-pending-attachment"><span aria-hidden="true">↧</span><span><strong>{selectedFile.name}</strong><small>{formatFileSize(selectedFile.size)} · Ready to send</small></span><button type="button" aria-label="Remove attachment" onClick={() => setSelectedFile(null)} disabled={sending}>×</button></div>}<div className="chat-compose-main"><input value={draft} onInput={event => { const value = event.currentTarget.value; setDraft(value); setError(''); if (active) realtimeClient.send({ type: value ? 'chat.typing.start' : 'chat.typing.stop', payload: { conversationId: active.id } }); }} maxLength={4000} placeholder="Write a message…" aria-label="Message"/><input ref={fileInput} className="chat-file-picker" type="file" onChange={event => { const file = event.currentTarget.files?.[0]; setSelectedFile(file ?? null); event.currentTarget.value = ''; }} aria-label="Choose a file"/><button type="button" className="chat-attach-button" disabled={sending} onClick={() => fileInput.current?.click()}>Attach</button><button type="submit" disabled={sending || (!draft.trim() && !selectedFile)}>{sending ? 'Sending…' : 'Send'}</button></div></form>
    </> : <div className="chat-empty chat-no-selection"><span>✳</span><strong>Your conversations</strong><p>Select a person or start a group to begin.</p></div>}</section></div>
    <aside className="chat-info" aria-label="Conversation details">
      {active ? <>
        <nav className="chat-info-tabs" aria-label="Conversation panel"><button type="button" className={rightTab === 'details' ? 'is-active' : ''} onClick={() => setRightTab('details')}>Details</button><button type="button" className={rightTab === 'files' ? 'is-active' : ''} onClick={() => setRightTab('files')}>Files <span>{sharedFiles.length}</span></button></nav>{rightTab === 'files' ? <section className="chat-shared-files">{sharedFiles.length ? sharedFiles.map(file => <div className="chat-shared-file" key={file.id}><FileMessage file={file} state={downloads[file.id]} onDownload={() => void downloadFile(file.id, file.name)} /><small>Shared by {file.senderName} · {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(file.createdAt))}</small></div>) : <p className="chat-info-empty">No files shared in this conversation yet.</p>}</section> : <><div className="chat-info-profile"><span className="chat-avatar chat-info-avatar">{activeTitle.slice(0, 1).toUpperCase()}</span><strong>{activeTitle}</strong><small>{active.type === 'GROUP' ? 'Group conversation' : `@${activePeer?.username ?? ''}`}</small>{active.type === 'DIRECT' && <span className={`chat-info-presence${activePeer && online.has(activePeer.userId) ? ' is-online' : ''}`}>{activePeer && online.has(activePeer.userId) ? 'Active now' : 'Offline'}</span>}</div>
        {active.type === 'GROUP' ? <div className="chat-info-section"><div className="chat-info-section-head"><strong>Members</strong><span>{active.members.length}</span></div>{active.members.map(member => <div className="chat-info-member" key={member.userId}><span className="chat-avatar chat-info-member-avatar">{member.displayName.slice(0, 1).toUpperCase()}</span><span><strong>{member.displayName}</strong><small>{member.role === 'ADMIN' ? 'Admin' : 'Member'}</small></span>{member.role === 'MEMBER' && active.members.some(item => item.role === 'ADMIN' && item.userId === userId) && <button aria-label={`Remove ${member.displayName}`} onClick={() => void removePerson(member.userId, member.displayName)}>×</button>}</div>)}</div> : <div className="chat-info-section"><div className="chat-info-section-head"><strong>Contact</strong></div><p>{activePeer?.displayName ?? 'Conversation member'}</p><small>@{activePeer?.username ?? ''}</small></div>}
        {active.type === 'GROUP' && active.members.some(member => member.role === 'ADMIN' && member.userId === userId) && <button className="chat-info-add" onClick={() => void addPeople()}>＋ Add members</button>}
      </>}</> : <div className="chat-info-empty">Choose a conversation to view its details.</div>}
    </aside>
  </div>;
}
