import express from 'express';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';

import { pool, connectDB } from './config/db.js';

// Routes
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import doctorRoutes from './routes/doctorRoutes.js';
import hospitalRoutes from './routes/hospitalRoutes.js';
import diseaseRoutes from './routes/diseaseRoutes.js';
import hospitalIntelligenceRoutes from './routes/hospitalIntelligenceRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import mobileRoutes from './routes/mobileRoutes.js';
import authVerify, { doctorVerify, userVerify } from './middlewares/authVerify.js';

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Security: Disable X-Powered-By header
app.disable('x-powered-by');

// Security: Set secure HTTP headers with Helmet
app.use(
  helmet({
    contentSecurityPolicy: false, // Set to false to avoid breaking external CDNs, maps (Leaflet), and inline assets
    crossOriginEmbedderPolicy: false,
  })
);

// Security: Rate limiting for Authentication endpoints (prevent brute-force & credential stuffing)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 requests per 15 minutes on auth routes
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many authentication attempts. Please try again after 15 minutes.',
  },
});

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500, // 500 requests per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
});

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Security: CORS Configuration with allowed origins
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, postman, or same-origin)
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }
      return callback(new Error('Blocked by CORS policy: Origin not allowed'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Health Check Endpoints (Used by CI pipelines, Docker, Kubernetes, and uptime monitoring)
const handleHealthCheck = async (_req, res) => {
  let dbStatus = 'disconnected';
  let dbError = null;

  try {
    const testQuery = await pool.query('SELECT 1 AS health');
    if (testQuery.rows?.[0]?.health === 1) {
      dbStatus = 'connected';
    }
  } catch (err) {
    dbError = err.message;
  }

  const isHealthy = dbStatus === 'connected' || !process.env.DB_URL;
  const statusCode = isHealthy ? 200 : 503;

  return res.status(statusCode).json({
    status: isHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    database: dbStatus,
    ...(dbError && { error: dbError }),
  });
};

app.get('/health', handleHealthCheck);
app.get('/api/health', handleHealthCheck);

// API Status indicator
app.get('/api', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'Mediraksha API is running',
    version: '2.0.0',
  });
});

// Mount Routes with appropriate security guards and rate limiters
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/user', apiLimiter, authVerify, userVerify, userRoutes);
app.use('/api/doctor', apiLimiter, authVerify, doctorVerify, doctorRoutes);
app.use('/api/hospital', apiLimiter, hospitalRoutes);
app.use('/api/disease', apiLimiter, diseaseRoutes);
app.use('/api/hospitals', apiLimiter, hospitalIntelligenceRoutes);
app.use('/api/reviews', apiLimiter, reviewRoutes);
app.use('/api', apiLimiter, mobileRoutes);

// Static frontend serving
const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');
const altFrontendDistPath = path.resolve(__dirname, '../frontend/dist');
const resolvedDistPath = fs.existsSync(frontendDistPath)
  ? frontendDistPath
  : altFrontendDistPath;

if (fs.existsSync(resolvedDistPath)) {
  app.use(express.static(resolvedDistPath));
}

// Single Page Application (SPA) fallback
app.get('*', (req, res, next) => {
  if (req.originalUrl.startsWith('/api') || req.originalUrl.startsWith('/health')) {
    return res.status(404).json({ success: false, message: 'Resource not found' });
  }

  const indexFile = path.join(resolvedDistPath, 'index.html');
  if (fs.existsSync(indexFile)) {
    return res.sendFile(indexFile);
  }

  return res.status(200).send('Mediraksha API Server is live.');
});

// Centralized error handling middleware
app.use((err, _req, res, _next) => {
  console.error('Unhandled server error:', err);
  if (res.headersSent) {
    return;
  }

  const statusCode = err.status || 500;
  return res.status(statusCode).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// Start server after connecting to database
connectDB()
  .then(() => {
    const PORT = process.env.PORT || 8000;
    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
      console.log(`Health check ready at http://localhost:${PORT}/health`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to the database:', err);
  });

export default app;