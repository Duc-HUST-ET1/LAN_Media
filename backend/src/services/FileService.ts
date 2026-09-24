import Busboy from 'busboy';
import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, rm, stat } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import type { Request } from 'express';
import { pipeline } from 'node:stream/promises';
import { ApiError } from '../core/errors/ApiError.js';
import { appConfig } from '../core/config/AppConfig.js';
import type { Message } from '../models/Message.js';
import { FileRepository, type SharedFile } from '../repositories/FileRepository.js';
import { MessageRepository } from '../repositories/MessageRepository.js';
import type { ChatService } from './ChatService.js';

export class FileService {
  private readonly directory = resolve(process.cwd(), appConfig.uploadDir);
  constructor(private readonly files: FileRepository, private readonly messages: MessageRepository, private readonly chat: ChatService,
    private readonly maxSize: number, private readonly allowedTypes: string[]) {}

  async upload(request: Request, userId: string, conversationId: string): Promise<Message> {
    await this.chat.assertMember(userId, conversationId);
    await mkdir(this.directory, { recursive: true });
    const key = randomUUID();
    const fullPath = resolve(this.directory, key);
    let originalName = '';
    let mimeType = 'application/octet-stream';
    let size = 0;
    let gotFile = false;
    let uploadTask: Promise<void> = Promise.resolve();
    let tooLarge = false;
    const parse = new Promise<void>((resolveParse, rejectParse) => {
      let parser: ReturnType<typeof Busboy>;
      try { parser = Busboy({ headers: request.headers, limits: { files: 1, fileSize: this.maxSize, fields: 2, fieldSize: 256 } }); }
      catch { rejectParse(new ApiError(400, 'Expected a valid multipart file upload.')); return; }
      parser.on('file', (_field, stream, info) => {
        if (gotFile || _field !== 'file') { stream.resume(); rejectParse(new ApiError(400, 'Upload must include one file field.')); return; }
        gotFile = true;
        const rawName = info.filename.normalize('NFC');
        if (!rawName || rawName.length > 255 || rawName.includes('/') || rawName.includes('\\') || rawName.split(/[\\/]/).includes('..') || basename(rawName) !== rawName || /[\u0000-\u001f\u007f]/.test(rawName)) {
          stream.resume(); rejectParse(new ApiError(400, 'Invalid filename.')); return;
        }
        const extension = extname(rawName).toLowerCase();
        const declaredType = (info.mimeType || 'application/octet-stream').toLowerCase();
        if (this.allowedTypes.length && !this.allowedTypes.includes('*') && !this.allowedTypes.some(type => type === declaredType || type === extension)) {
          stream.resume(); rejectParse(new ApiError(415, 'This file type is not allowed.')); return;
        }
        originalName = rawName;
        mimeType = declaredType.slice(0, 127);
        stream.on('data', (chunk: Buffer) => { size += chunk.length; });
        stream.on('limit', () => { tooLarge = true; });
        uploadTask = pipeline(stream, createWriteStream(fullPath, { flags: 'wx' }));
        uploadTask.catch(rejectParse);
      });
      parser.on('filesLimit', () => rejectParse(new ApiError(400, 'Only one file may be uploaded at a time.')));
      parser.on('error', () => rejectParse(new ApiError(400, 'Malformed multipart upload.')));
      parser.on('close', async () => {
        try {
          await uploadTask;
          if (!gotFile) throw new ApiError(400, 'A file is required.');
          if (tooLarge) throw new ApiError(413, `File exceeds the ${this.maxSize} byte limit.`);
          resolveParse();
        } catch (error) { rejectParse(error); }
      });
      request.pipe(parser);
    });
    let fileId: string | undefined;
    try {
      await parse;
      fileId = await this.files.create({ ownerId: userId, conversationId, originalName, storageKey: key, mimeType, size });
      return await this.messages.createFile(conversationId, userId, fileId);
    } catch (error) {
      await rm(fullPath, { force: true }).catch(() => undefined);
      if (fileId) await this.files.removeAfterFailedUpload(fileId).catch(() => undefined);
      throw error;
    }
  }

  async openDownload(fileId: string, userId: string): Promise<{ path: string; name: string; mimeType: string; size: number }> {
    const file = await this.files.find(fileId);
    if (!file || !file.conversationId) throw new ApiError(404, 'File not found.');
    await this.chat.assertMember(userId, file.conversationId);
    const path = resolve(this.directory, file.storageKey);
    if (path !== resolve(this.directory, basename(file.storageKey))) throw new ApiError(404, 'File not found.');
    try {
      const details = await stat(path);
      if (!details.isFile()) throw new Error('Not a regular file');
      return { path, name: file.originalName, mimeType: file.mimeType, size: file.size };
    } catch { throw new ApiError(404, 'Stored file is unavailable.'); }
  }

  async listConversationFiles(conversationId: string, userId: string): Promise<SharedFile[]> {
    await this.chat.assertMember(userId, conversationId);
    return this.files.listForConversation(conversationId);
  }
}
