import 'dotenv/config';
import express from 'express';
import { createServer } from 'node:http';
import { appConfig } from './core/config/AppConfig.js';
import { database } from './core/database/Database.js';
import { runMigrations } from './core/database/MigrationRunner.js';
import { corsMiddleware } from './core/middleware/Cors.js';
import { errorHandler, notFoundHandler } from './core/middleware/ErrorHandler.js';
import { authRoutes } from './routes/AuthRoutes.js';
import { healthRoutes } from './routes/HealthRoutes.js';
import { chatRoutes } from './routes/ChatRoutes.js';
import { userRoutes } from './routes/UserRoutes.js';
import { fileRoutes } from './routes/FileRoutes.js';
import { attachWebSocketServer } from './websocket/WebSocketServer.js';

const app = express();
app.disable('x-powered-by');
app.use(corsMiddleware);
app.use(express.json({ limit: '32kb' }));
app.use('/api', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api', chatRoutes);
app.use('/api', fileRoutes);
app.use('/api/users', userRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

async function start(): Promise<void> {
  const server = createServer(app);
  attachWebSocketServer(server);
  try {
    await runMigrations(database);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database initialization failed.';
    console.error(`Database unavailable; API will start in degraded mode: ${message}`);
  }

  server.listen(appConfig.port, appConfig.host, () => {
  console.log(`LAN-Media Backend\nHost: ${appConfig.host}\nPort: ${appConfig.port}\nStatus: Running`);
  });
}

void start();
