import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChatApi, type ChatMessage, type Conversation } from '../../api/ChatApi';
import { FileApi, type TransferProgress } from '../../api/FileApi';
import { FileMessage, formatFileSize, type DownloadState } from '../../components/chat/FileMessage';
import { realtimeClient, type RealtimeEvent } from '../../api/RealtimeClient';
import './ChatPage.css';
import type { CallController } from '../../hooks/useCall';
const avatarPalette = ['blue', 'violet', 'amber', 'rose', 'teal'] as const;
function paletteColor(value: string) {
  let hash = 0;
  for (const character of value) hash = (hash * 31 + character.charCodeAt(0)) | 0;
  return avatarPalette[Math.abs(hash) % avatarPalette.length];
}
export default function ChatPage({ userId, call }: { userId: string; call: CallController }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [contacts, setContacts] = useState<Awaited<ReturnType<typeof ChatApi.contacts>>>([]);
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
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
  const visibleConversations = useMemo(() => conversations.filter(item => {
    const peer = item.members.find(member => member.userId !== userId);
    const label = item.type === 'GROUP' ? item.name ?? 'Nhóm' : peer?.displayName ?? 'Trò chuyện';
    const searchText = query.trim().toLocaleLowerCase();
    return label.toLocaleLowerCase().includes(searchText) || (peer?.username.toLocaleLowerCase().includes(searchText) ?? false);
  }), [conversations, query, userId]);
  const matchingContacts = useMemo(() => {
    const searchText = query.trim().toLocaleLowerCase();
    if (!searchText) return [];
    const existingDirectMembers = new Set(conversations
      .filter(conversation => conversation.type === 'DIRECT')
      .flatMap(conversation => conversation.members.map(member => member.userId)));
    return contacts.filter(person => !existingDirectMembers.has(person.id)
      && (person.displayName.toLocaleLowerCase().includes(searchText) || person.username.toLocaleLowerCase().includes(searchText)));
  }, [contacts, conversations, query]);
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
        const message = await ChatApi.sendMessage(conversationId, content);
        if (activeIdRef.current === conversationId) setMessages(old => old.some(item => item.id === message.id) ? old : [...old, message]);
        setDraft('');
        realtimeClient.send({ type: 'chat.typing.stop', payload: { conversationId } });
      }
    } catch (cause) {
      if (activeIdRef.current === conversationId) setError(cause instanceof Error ? cause.message : 'Could not send message.');
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
    <div className="chat-layout">
      <aside className="conversation-panel chat-list">
        <header className="panel-heading">
          <div><p className="eyebrow">LAN WORKSPACE</p><h1>Tin nhắn</h1></div>
          <button className="square-button primary" title="Tạo nhóm mới" onClick={() => void createGroup()} disabled={busy || !contacts.length}>＋</button>
        </header>
        <label className="search-box"><span aria-hidden="true">⌕</span><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm người hoặc nhóm"/><span className="shortcut">⌘ K</span></label>
        <div className="filter-row"><span className="filter active">Tất cả <span>{conversations.length}</span></span><span className="filter">Nhóm</span></div>
        {error && <div className="chat-error" role="alert">{error}</div>}
        <div className="conversation-list">
          {visibleConversations.map(conversation => {
            const peer = conversation.members.find(member => member.userId !== userId);
            const label = conversation.type === 'GROUP' ? conversation.name ?? 'Nhóm' : peer?.displayName ?? 'Trò chuyện';
            const lastUpdated = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date(conversation.updatedAt));
            return <button key={conversation.id} onClick={() => setActiveId(conversation.id)} className={`conversation${activeId === conversation.id ? ' active' : ''}`}>
              <span className={`avatar avatar-${paletteColor(conversation.id)}`}>{label.slice(0, 2).toUpperCase()}{conversation.type === 'DIRECT' && peer && online.has(peer.userId) && <span className="presence-dot"/>}</span>
              <span className="conversation-copy"><span className="conversation-top"><strong>{label}</strong><time>{lastUpdated}</time></span><span className="conversation-preview">{conversation.type === 'GROUP' ? `${conversation.members.length} thành viên` : `@${peer?.username ?? ''}`}</span></span>
            </button>;
          })}
          {matchingContacts.map(person => <button key={person.id} className="conversation" onClick={() => void openDirect(person.id)} disabled={busy}>
            <span className={`avatar avatar-${paletteColor(person.id)}`}>{person.displayName.slice(0, 1).toUpperCase()}{online.has(person.id) && <span className="presence-dot"/>}</span>
            <span className="conversation-copy"><span className="conversation-top"><strong>{person.displayName}</strong></span><span className="conversation-preview">@{person.username}</span></span>
          </button>)}
          {!visibleConversations.length && !matchingContacts.length && <p className="empty-state">{query.trim() ? 'Không tìm thấy người hoặc cuộc trò chuyện.' : 'Chưa có cuộc trò chuyện. Tìm người để bắt đầu nhắn tin.'}</p>}
        </div>
        <div className="network-card"><span className="network-pulse"><span/></span><div><strong>LAN đã kết nối</strong><small>{online.size} thành viên đang trực tuyến</small></div></div>
      </aside>

      <section className="chat-panel" aria-label="Conversation">{active ? <>
        <header className="chat-header"><div className="profile"><span className={`avatar avatar-${paletteColor(active.id)}`}>{activeTitle.slice(0, 1).toUpperCase()}<span className={activePeer && online.has(activePeer.userId) ? 'presence-dot' : 'presence-dot offline'}/></span><div><strong>{activeTitle}</strong><span>{active.type === 'GROUP' ? `${active.members.length} thành viên` : activePeer && online.has(activePeer.userId) ? 'Đang hoạt động trong LAN' : 'Ngoại tuyến'}</span></div></div>
          <div className="header-actions">{active.type === 'DIRECT' && <><button className="icon-button" title="Gọi thoại" disabled={!activePeer || !online.has(activePeer.userId) || !!call.call} onClick={() => activePeer && void call.start(activePeer.userId, activeTitle, 'voice')}>☎</button><button className="icon-button" title="Gọi video" disabled={!activePeer || !online.has(activePeer.userId) || !!call.call} onClick={() => activePeer && void call.start(activePeer.userId, activeTitle, 'video')}>▣</button></>}{active.type === 'GROUP' && active.members.some(member => member.role === 'ADMIN' && member.userId === userId) && <button className="icon-button" title="Thêm thành viên" onClick={() => void addPeople()}>＋</button>}</div>
        </header>
        <div className="messages" ref={scrollRef}>
          <div className="security-note"><span className="lock-dot">✓</span>Tin nhắn được truyền an toàn trong mạng nội bộ</div>
          <div className="day-divider"><span>Cuộc trò chuyện</span></div>
          {!messages.length && <div className="chat-empty"><strong>Chưa có tin nhắn</strong><p>Gửi tin nhắn để bắt đầu trò chuyện.</p></div>}
          {messages.map(message => <div key={message.id} className={`message-row ${message.senderId === userId ? 'outgoing' : 'incoming'}`}>
            {message.senderId !== userId && <span className={`avatar small avatar-${paletteColor(message.senderId)}`}>{message.senderName.slice(0, 1).toUpperCase()}</span>}
            <div><div className="message-meta"><strong>{message.senderName}</strong><time>{new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date(message.createdAt))}</time></div>{message.type === 'FILE' && message.file ? <FileMessage file={message.file} state={downloads[message.file.id]} onDownload={() => void downloadFile(message.file!.id)} /> : <div className="bubble">{message.type === 'FILE' ? 'Tệp đính kèm không còn khả dụng.' : message.content}</div>}</div>
          </div>)}
          {typing && <p className="chat-typing">Đang nhập…</p>}
        </div>
        {uploadState?.conversationId === active.id && <div className={`chat-upload-status is-${uploadState.status}`} role="status"><strong>{uploadState.name}</strong><small>{uploadState.status === 'complete' ? 'Đã gửi tệp' : uploadState.status === 'failed' ? uploadState.error : `${uploadState.percent ?? 0}% · ${formatFileSize(uploadState.loaded)} / ${formatFileSize(uploadState.total ?? 0)}`}</small>{uploadState.status === 'uploading' && <progress max={100} value={uploadState.percent ?? 0} />}{uploadState.status !== 'uploading' && <button type="button" aria-label="Đóng trạng thái tải lên" onClick={() => setUploadState(null)}>×</button>}</div>}
        <form className="composer" onSubmit={event => { event.preventDefault(); void sendMessage(); }}>
          {selectedFile && <div className="chat-pending-attachment"><strong>{selectedFile.name}</strong><small>{formatFileSize(selectedFile.size)} · Sẵn sàng gửi</small><button type="button" aria-label="Bỏ tệp đính kèm" onClick={() => setSelectedFile(null)} disabled={sending}>×</button></div>}
          <button type="button" className="compose-button" title="Đính kèm tệp" onClick={() => fileInput.current?.click()} disabled={sending}>＋</button>
          <input value={draft} onInput={event => { const value = event.currentTarget.value; setDraft(value); setError(''); if (active) realtimeClient.send({ type: value ? 'chat.typing.start' : 'chat.typing.stop', payload: { conversationId: active.id } }); }} maxLength={4000} placeholder={`Nhắn tin cho ${activeTitle}`} aria-label="Tin nhắn"/>
          <input ref={fileInput} className="chat-file-picker" type="file" onChange={event => { const file = event.currentTarget.files?.[0]; setSelectedFile(file ?? null); event.currentTarget.value = ''; }} aria-label="Chọn tệp"/>
          <button type="submit" className="send-button" title="Gửi tin nhắn" disabled={sending || (!draft.trim() && !selectedFile)}>{sending ? '…' : '➤'}</button>
        </form>
      </> : <div className="chat-empty chat-no-selection"><strong>Cuộc trò chuyện của bạn</strong><p>Chọn một thành viên hoặc tạo nhóm mới.</p></div>}</section>

      <aside className="chat-info detail-panel" aria-label="Conversation details">{active ? <>
        <div className="detail-top"><span className={`avatar avatar-${paletteColor(active.id)} profile-avatar`}>{activeTitle.slice(0, 1).toUpperCase()}<span className={activePeer && online.has(activePeer.userId) ? 'presence-dot' : 'presence-dot offline'}/></span><h2>{activeTitle}</h2><p>{active.type === 'GROUP' ? `${active.members.length} thành viên` : `@${activePeer?.username ?? ''}`} · {activePeer && online.has(activePeer.userId) ? 'Đang hoạt động' : 'Ngoại tuyến'}</p></div>
        <nav className="chat-info-tabs"><button type="button" className={rightTab === 'details' ? 'is-active' : ''} onClick={() => setRightTab('details')}>Chi tiết</button><button type="button" className={rightTab === 'files' ? 'is-active' : ''} onClick={() => setRightTab('files')}>Tệp <span>{sharedFiles.length}</span></button></nav>
        {rightTab === 'files' ? <section className="shared-files">{sharedFiles.length ? sharedFiles.map(file => <button key={file.id} onClick={() => void downloadFile(file.id, file.name)}><span className="file-icon">{file.name.split('.').pop()?.slice(0, 2).toUpperCase()}</span><span><strong>{file.name}</strong><small>{file.senderName} · {formatFileSize(file.size)}</small></span><span aria-hidden="true">↓</span></button>) : <p className="chat-info-empty">Chưa có tệp được chia sẻ.</p>}</section> : active.type === 'GROUP' ? <div className="detail-section"><div className="section-title"><strong>Thành viên</strong><span>{active.members.length}</span></div>{active.members.map(member => <div className="chat-info-member" key={member.userId}><span className="chat-avatar chat-info-member-avatar">{member.displayName.slice(0, 1).toUpperCase()}</span><span><strong>{member.displayName}</strong><small>{member.role === 'ADMIN' ? 'Quản trị viên' : 'Thành viên'}</small></span>{member.role === 'MEMBER' && active.members.some(item => item.role === 'ADMIN' && item.userId === userId) && <button aria-label={`Xóa ${member.displayName}`} onClick={() => void removePerson(member.userId, member.displayName)}>×</button>}</div>)}{active.members.some(member => member.role === 'ADMIN' && member.userId === userId) && <button className="chat-info-add" onClick={() => void addPeople()}>＋ Thêm thành viên</button>}</div> : <div className="detail-section"><div className="section-title"><strong>Liên hệ</strong></div><p>{activePeer?.displayName}</p><small>@{activePeer?.username}</small></div>}
      </> : <p className="chat-info-empty">Chọn cuộc trò chuyện để xem chi tiết.</p>}</aside>
    </div>
  </div>;
}
