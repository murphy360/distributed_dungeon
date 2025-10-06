const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:", "data:"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https:", "data:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'self'"],
      baseUri: ["'self'"],
      upgradeInsecureRequests: []
    }
  }
}));
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Serve static files from web directory
const webDir = path.join(__dirname, 'web');
app.use(express.static(webDir));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP'
});
app.use(limiter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'dungeon-master',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Dashboard web interface route
app.get('/', (req, res) => {
  const indexPath = path.join(webDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Dashboard interface not found');
  }
});

// API Routes
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/dm', require('./routes/dungeon-master'));
app.use('/api/events', require('./routes/events'));

// Dashboard API endpoints
app.get('/api/dashboard/overview', (req, res) => {
  // Collect system overview data
  const overview = {
    status: 'running',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    activeSessions: 2, // TODO: Get from database
    totalCharacters: 1, // TODO: Get from database
    connectionsCount: io.engine.clientsCount,
    timestamp: new Date().toISOString()
  };
  
  res.json({ success: true, data: overview });
});

app.get('/api/dashboard/characters', (req, res) => {
  // TODO: Get registered characters from database
  const characters = [
    {
      id: 'fighter-001',
      name: 'grax-fighter',
      class: 'fighter',
      level: 3,
      status: 'online',
      endpoint: 'http://localhost:3010',
      lastSeen: new Date().toISOString(),
      health: { current: 20, maximum: 20 }
    }
  ];
  
  res.json({ success: true, data: characters });
});

app.get('/api/dashboard/logs', (req, res) => {
  // TODO: Get recent system logs
  const logs = [
    { timestamp: new Date().toISOString(), level: 'info', message: 'Dungeon Master Service started', source: 'system' },
    { timestamp: new Date(Date.now() - 60000).toISOString(), level: 'warn', message: 'Character registration attempt failed', source: 'registry' },
    { timestamp: new Date(Date.now() - 120000).toISOString(), level: 'info', message: 'WebSocket client connected', source: 'websocket' }
  ];
  
  res.json({ success: true, data: logs });
});

// WebSocket connection handling
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  socket.on('join_session', (data) => {
    const { sessionId, playerId, token } = data;
    // TODO: Validate JWT token
    socket.join(`session_${sessionId}`);
    logger.info(`Player ${playerId} joined session ${sessionId}`);
  });

  socket.on('dm_action', (data) => {
    const { sessionId, action, payload } = data;
    // Broadcast DM actions to all players in session
    io.to(`session_${sessionId}`).emit('game_event', {
      type: 'dm_action',
      action,
      payload,
      timestamp: new Date().toISOString()
    });
  });

  socket.on('disconnect', () => {
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    error: {
      message: err.message || 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: 'Endpoint not found'
    }
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  logger.info(`Dungeon Master Service running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

module.exports = { app, server, io };