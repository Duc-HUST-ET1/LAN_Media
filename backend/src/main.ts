import 'dotenv/config';
import express from 'express';
import { appConfig } from './core/config/AppConfig.js';
import { errorHandler, notFoundHandler } from './core/middleware/ErrorHandler.js';
import { healthRoutes } from './routes/HealthRoutes.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json());
app.use('/api', healthRoutes);
app.use(notFoundHandler);
app.use(errorHandler);

app.listen(appConfig.port, appConfig.host, () => {
  console.log(`LAN-Media Backend\nHost: ${appConfig.host}\nPort: ${appConfig.port}\nStatus: Running`);
});
