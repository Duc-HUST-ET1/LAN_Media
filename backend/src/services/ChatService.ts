import { ApiError } from '../core/errors/ApiError.js';
import type { Conversation } from '../models/Conversation.js';
import type { Message } from '../models/Message.js';
import { ConversationRepository } from '../repositories/ConversationRepository.js';
import { MessageRepository } from '../repositories/MessageRepository.js';
import { UserRepository } from '../repositories/UserRepository.js';

export class ChatService {
  constructor(private readonly conversations: ConversationRepository, private readonly messages: MessageRepository, private readonly users: UserRepository, private readonly maxLength = 4000) {}
  async listConversations(userId: string): Promise<Conversation[]> { return this.conversations.listForUser(userId); }
  async contacts(userId: string) { return this.users.listPublicExcept(userId); }
  async onlineUsers(userIds: string[]) { return this.users.listPublic().then(users => users.filter(user => userIds.includes(user.id))); }
  async direct(userId: string, otherId: string): Promise<Conversation> {
    if (!otherId || otherId === userId) throw new ApiError(400, 'Choose another user to start a conversation.');
    const other = await this.users.findById(otherId);
    if (!other) throw new ApiError(404, 'User not found.');
    return this.conversations.createOrFindDirect(userId, otherId);
  }
  async group(userId: string, name: string, memberIds: string[]): Promise<Conversation> {
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 160) throw new ApiError(400, 'Group name must be between 1 and 160 characters.');
    if (memberIds.length < 1) throw new ApiError(400, 'Select at least one other member.');
    if (memberIds.includes(userId)) throw new ApiError(400, 'The creator is added automatically.');
    for (const id of new Set(memberIds)) if (!await this.users.findById(id)) throw new ApiError(400, 'One or more users do not exist.');
    return this.conversations.createGroup(userId, trimmed, memberIds);
  }
  async history(userId: string, conversationId: string, limit: number, before?: string): Promise<Message[]> {
    await this.assertMember(userId, conversationId);
    return this.messages.list(conversationId, Math.max(1, Math.min(limit, 100)), before);
  }
  async send(userId: string, conversationId: string, content: string): Promise<Message> {
    await this.assertMember(userId, conversationId);
    const text = content.trim();
    if (!text || text.length > this.maxLength) throw new ApiError(400, `Message must contain 1 to ${this.maxLength} characters.`);
    return this.messages.create(conversationId, userId, text);
  }
  async addMembers(actorId: string, conversationId: string, memberIds: string[]): Promise<Conversation> {
    await this.requireAdmin(actorId, conversationId);
    if (!memberIds.length) throw new ApiError(400, 'Select at least one member.');
    for (const id of memberIds) if (!await this.users.findById(id)) throw new ApiError(400, 'One or more users do not exist.');
    await this.conversations.addMembers(conversationId, memberIds);
    return this.conversations.listForUser(actorId).then(items => items.find(c => c.id === conversationId)!);
  }
  async removeMember(actorId: string, conversationId: string, targetId: string): Promise<void> {
    await this.requireAdmin(actorId, conversationId);
    const role = await this.conversations.getRole(conversationId, targetId);
    if (!role) throw new ApiError(404, 'Active member not found.');
    if (role === 'ADMIN' && await this.conversations.activeAdminCount(conversationId) <= 1) throw new ApiError(400, 'A group must keep at least one active admin.');
    await this.conversations.removeMember(conversationId, targetId);
  }
  async assertMember(userId: string, conversationId: string): Promise<void> {
    if (!await this.conversations.isMember(conversationId, userId)) throw new ApiError(403, 'Conversation access denied.');
  }
  private async requireAdmin(actorId: string, conversationId: string): Promise<void> {
    const type = await this.conversations.getType(conversationId);
    if (!type) throw new ApiError(404, 'Conversation not found.');
    if (type !== 'GROUP') throw new ApiError(400, 'Member management is only available for group conversations.');
    const role = await this.conversations.getRole(conversationId, actorId);
    if (!role) throw new ApiError(404, 'Conversation not found.');
    if (role !== 'ADMIN') throw new ApiError(403, 'Group admin permission required.');
  }
}
