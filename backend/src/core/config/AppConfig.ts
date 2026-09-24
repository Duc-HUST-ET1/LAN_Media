const port = Number(process.env.PORT ?? 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

export const appConfig = {
  host: process.env.HOST ?? '0.0.0.0',
  port,
  environment: process.env.NODE_ENV ?? 'development',
  frontendOrigins: (process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173').split(',').map((origin) => origin.trim()).filter(Boolean),
  sessionTtlHours: Number(process.env.SESSION_TTL_HOURS ?? 168),
  maxMessageLength: Number(process.env.MAX_MESSAGE_LENGTH ?? 4000),
  uploadDir: process.env.UPLOAD_DIR ?? './uploads',
  maxFileSize: Number(process.env.MAX_FILE_SIZE ?? 104857600),
  allowedFileTypes: (process.env.ALLOWED_FILE_TYPES ?? '*').split(',').map(value => value.trim().toLowerCase()).filter(Boolean),
};

if (!Number.isFinite(appConfig.sessionTtlHours) || appConfig.sessionTtlHours < 1) {
  throw new Error('SESSION_TTL_HOURS must be a positive number.');
}
if (!Number.isInteger(appConfig.maxMessageLength) || appConfig.maxMessageLength < 1 || appConfig.maxMessageLength > 16000) {
  throw new Error('MAX_MESSAGE_LENGTH must be an integer between 1 and 16000.');
}
if (!Number.isSafeInteger(appConfig.maxFileSize) || appConfig.maxFileSize < 1) throw new Error('MAX_FILE_SIZE must be a positive safe integer in bytes.');
