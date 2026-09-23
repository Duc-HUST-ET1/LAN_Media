export type ConversationType = 'DIRECT' | 'GROUP';
export type MemberRole = 'MEMBER' | 'ADMIN';

export interface ConversationMember { userId: string; username: string; displayName: string; role: MemberRole; }
export interface Conversation { id: string; type: ConversationType; name: string | null; createdBy: string; updatedAt: string; members: ConversationMember[]; }
