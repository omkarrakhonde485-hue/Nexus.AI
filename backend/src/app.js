import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import workflowRoutes from './routes/workflows.js';
import taskRoutes from './routes/tasks.js';
import approvalRoutes from './routes/approvals.js';
import aiRoutes from './routes/ai.js';
import googleIntegrationRoutes from './routes/integrationsGoogle.js';
import { notFoundHandler } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// Security Headers
app.use(helmet());

// CORS Configuration
const allowedOrigins = [env.FRONTEND_URL, 'http://localhost:5173', 'http://localhost:3000'];
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

// JSON Body Parser
app.use(express.json());

// Basic Request Logger
app.use((req, res, next) => {
  if (env.NODE_ENV === 'development') {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});

// Routes
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/workflows', workflowRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/integrations/google', googleIntegrationRoutes);
// Alias for legacy /api/auth/google/callback support
app.use('/api/auth/google', googleIntegrationRoutes);

// 404 Handler
app.use(notFoundHandler);

// Global Error Handler
app.use(errorHandler);

export default app;
