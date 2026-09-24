export interface FileMetadata { id: string; name: string; size: number; mimeType: string; downloadUrl: string; }
export interface Message { id: string; conversationId: string; senderId: string; senderName: string; type: 'TEXT' | 'FILE'; content: string; file?: FileMetadata; createdAt: string; }
