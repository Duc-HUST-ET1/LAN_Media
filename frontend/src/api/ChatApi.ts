import type { AuthUser } from './AuthApi';
export interface ChatMember { userId: string; username: string; displayName: string; role: 'MEMBER' | 'ADMIN'; }
export interface Conversation { id: string; type: 'DIRECT' | 'GROUP'; name: string | null; createdBy: string; updatedAt: string; members: ChatMember[]; }
export interface ChatMessage { id: string; conversationId: string; senderId: string; senderName: string; type: 'TEXT'; content: string; createdAt: string; }
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const body = response.status === 204 ? undefined : await response.json() as { error?: { message?: string } } & T;
  if (!response.ok) throw new Error(body?.error?.message ?? 'Request failed.');
  return body as T;
}
export const ChatApi = {
  async conversations() { return (await request<{ conversations: Conversation[] }>('/conversations')).conversations; },
  async contacts() { return (await request<{ users: AuthUser[] }>('/users')).users; },
  async online() { return (await request<{ users: AuthUser[] }>('/users/online')).users; },
  async direct(userId: string) { return (await request<{ conversation: Conversation }>('/conversations/direct', { method: 'POST', body: JSON.stringify({ userId }) })).conversation; },
  async group(name: string, memberIds: string[]) { return (await request<{ conversation: Conversation }>('/conversations/group', { method: 'POST', body: JSON.stringify({ name, memberIds }) })).conversation; },
  async messages(conversationId: string) { return (await request<{ messages: ChatMessage[] }>(`/conversations/${encodeURIComponent(conversationId)}/messages?limit=50`)).messages; },
  async addMembers(id: string, memberIds: string[]) { return (await request<{ conversation: Conversation }>(`/conversations/${encodeURIComponent(id)}/members`, { method: 'POST', body: JSON.stringify({ memberIds }) })).conversation; },
  removeMember(id: string, userId: string) { return request<void>(`/conversations/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}`, { method: 'DELETE' }); },
};
