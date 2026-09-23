import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ChatApi, type ChatMessage, type Conversation } from '../../api/ChatApi';
import { realtimeClient, type RealtimeEvent } from '../../api/RealtimeClient';
import './ChatPage.css';
export default function ChatPage({ userId }: { userId: string }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [contacts, setContacts] = useState<Awaited<ReturnType<typeof ChatApi.contacts>>>([]);
  const [online, setOnline] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const active = useMemo(() => conversations.find(item => item.id === activeId) ?? null, [conversations, activeId]);
  const refresh = useCallback(async () => {
    try {
      const [cs, people, onlinePeople] = await Promise.all([ChatApi.conversations(), ChatApi.contacts(), ChatApi.online()]);
      setConversations(cs); setContacts(people); setOnline(new Set(onlinePeople.map(person => person.id)));
      setActiveId(current => current && cs.some(item => item.id === current) ? current : cs[0]?.id ?? null); setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load conversations.'); }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    let current = true;
    ChatApi.messages(activeId).then(items => { if (current) setMessages(items); }).catch(cause => { if (current) setError(cause instanceof Error ? cause.message : 'Could not load messages.'); });
    return () => { current = false; };
  }, [activeId]);
  useEffect(() => {
    const unsubscribe = realtimeClient.subscribe((event: RealtimeEvent) => {
      if (event.type === 'chat.message') {
        const message = event.payload?.message as ChatMessage | undefined;
        if (message) { if (message.conversationId === activeId) setMessages(old => old.some(item => item.id === message.id) ? old : [...old, message]); void refresh(); }
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
  function send(event: FormEvent) {
    event.preventDefault(); if (!draft.trim() || !active) return;
    if (!realtimeClient.send({ type: 'chat.send', requestId: crypto.randomUUID(), payload: { conversationId: active.id, content: draft } })) { setError('Realtime connection is offline. Reconnecting…'); return; }
    setDraft(''); realtimeClient.send({ type: 'chat.typing.stop', payload: { conversationId: active.id } });
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
      <div className="chat-messages" ref={scrollRef}>{!messages.length && <div className="chat-empty"><span>✳</span><strong>No messages yet</strong><p>Send a message to start the conversation.</p></div>}{messages.map(message => <article key={message.id} className="chat-message"><div className="chat-message-meta"><strong>{message.senderName}</strong><time>{new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(message.createdAt))}</time></div><p>{message.content}</p></article>)}{typing && <p className="chat-typing">A member is typing…</p>}</div>
      {active.type === 'GROUP' && <div className="chat-members">{active.members.map(member => <span key={member.userId}>{member.displayName}{member.role === 'ADMIN' ? ' · admin' : ''}{member.role === 'MEMBER' && active.members.some(item => item.role === 'ADMIN' && item.userId === userId) && <button aria-label={`Remove ${member.displayName}`} onClick={() => void removePerson(member.userId, member.displayName)}>×</button>}</span>)}</div>}
      <form className="chat-compose" onSubmit={send}><input value={draft} onChange={event => { setDraft(event.target.value); if (active) realtimeClient.send({ type: event.target.value ? 'chat.typing.start' : 'chat.typing.stop', payload: { conversationId: active.id } }); }} maxLength={4000} placeholder="Write a message…" aria-label="Message"/><button type="submit" disabled={!draft.trim()}>Send</button></form>
    </> : <div className="chat-empty chat-no-selection"><span>✳</span><strong>Your conversations</strong><p>Select a person or start a group to begin.</p></div>}</section></div>
  </div>;
}
