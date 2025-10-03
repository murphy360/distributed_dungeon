const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');
const redis = require('redis');
const jwt = require('jsonwebtoken');
const winston = require('winston');

// Configure logging
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console()
    ]
});

const app = express();
const server = createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ["http://localhost:3000"],
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3006;

// Middleware
app.use(express.json());

// Database connection
const pool = new Pool({
    host: process.env.DB_HOST || 'dungeon_postgres',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'dungeon_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'dungeonmaster123',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Redis connection
const redisClient = redis.createClient({
    url: `redis://:${process.env.REDIS_PASSWORD || 'redispass123'}@${process.env.REDIS_HOST || 'dungeon_redis'}:${process.env.REDIS_PORT || 6379}`
});

redisClient.on('error', (err) => {
    logger.error('Redis Client Error', err);
});

// Connect to Redis
redisClient.connect().catch(console.error);

// Store active sessions and users
const activeSessions = new Map();
const activeUsers = new Map();

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        // Check database connection
        await pool.query('SELECT 1');
        
        // Check Redis connection
        await redisClient.ping();
        
        res.json({ 
            status: 'healthy', 
            service: 'communication-service',
            activeSessions: activeSessions.size,
            activeUsers: activeUsers.size,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Health check failed:', error);
        res.status(503).json({ 
            status: 'unhealthy', 
            service: 'communication-service',
            error: error.message 
        });
    }
});

// WebSocket authentication middleware
io.use(async (socket, next) => {
    try {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication token required'));
        }

        // For now, we'll skip JWT verification and just extract user info
        // In production, verify the JWT token here
        const userId = socket.handshake.auth.userId;
        const username = socket.handshake.auth.username;
        
        if (!userId || !username) {
            return next(new Error('User ID and username required'));
        }

        socket.userId = userId;
        socket.username = username;
        next();
    } catch (error) {
        logger.error('Socket authentication error:', error);
        next(new Error('Authentication failed'));
    }
});

// Handle WebSocket connections
io.on('connection', (socket) => {
    logger.info(`User connected: ${socket.username} (${socket.userId})`);
    
    // Store user connection
    activeUsers.set(socket.userId, {
        socketId: socket.id,
        username: socket.username,
        connectedAt: new Date()
    });

    // Join session room
    socket.on('join-session', async (sessionId) => {
        try {
            // Verify user is part of this session
            const playerCheck = await pool.query(`
                SELECT p.*, s.status as session_status, u.username
                FROM players p
                JOIN sessions s ON p.session_id = s.id
                JOIN users u ON p.user_id = u.id
                WHERE p.session_id = $1 AND p.user_id = $2
            `, [sessionId, socket.userId]);

            if (playerCheck.rows.length === 0) {
                socket.emit('error', { message: 'Not authorized to join this session' });
                return;
            }

            const player = playerCheck.rows[0];
            
            // Join the session room
            socket.join(`session-${sessionId}`);
            socket.currentSession = sessionId;
            
            // Add to active sessions
            if (!activeSessions.has(sessionId)) {
                activeSessions.set(sessionId, new Set());
            }
            activeSessions.get(sessionId).add(socket.userId);

            // Notify others in the session
            socket.to(`session-${sessionId}`).emit('user-joined', {
                userId: socket.userId,
                username: socket.username,
                player: player
            });

            // Send current session state to the joining user
            const sessionUsers = Array.from(activeSessions.get(sessionId)).map(userId => {
                const user = activeUsers.get(userId);
                return user ? { userId, username: user.username } : null;
            }).filter(Boolean);

            socket.emit('session-joined', {
                sessionId,
                users: sessionUsers,
                player: player
            });

            logger.info(`User ${socket.username} joined session ${sessionId}`);
        } catch (error) {
            logger.error('Error joining session:', error);
            socket.emit('error', { message: 'Failed to join session' });
        }
    });

    // Leave session room
    socket.on('leave-session', (sessionId) => {
        socket.leave(`session-${sessionId}`);
        
        if (activeSessions.has(sessionId)) {
            activeSessions.get(sessionId).delete(socket.userId);
            if (activeSessions.get(sessionId).size === 0) {
                activeSessions.delete(sessionId);
            }
        }

        socket.to(`session-${sessionId}`).emit('user-left', {
            userId: socket.userId,
            username: socket.username
        });

        socket.currentSession = null;
        logger.info(`User ${socket.username} left session ${sessionId}`);
    });

    // Handle chat messages
    socket.on('chat-message', async (data) => {
        try {
            const { sessionId, message, messageType = 'chat' } = data;
            
            if (!sessionId || !message) {
                socket.emit('error', { message: 'Session ID and message are required' });
                return;
            }

            // Store message in database
            const result = await pool.query(`
                INSERT INTO game_events (session_id, event_type, data, created_by)
                VALUES ($1, 'chat_message', $2, $3)
                RETURNING *
            `, [sessionId, {
                message,
                messageType,
                username: socket.username,
                timestamp: new Date().toISOString()
            }, socket.userId]);

            const chatData = {
                id: result.rows[0].id,
                sessionId,
                message,
                messageType,
                userId: socket.userId,
                username: socket.username,
                timestamp: result.rows[0].created_at
            };

            // Broadcast to all users in the session
            io.to(`session-${sessionId}`).emit('chat-message', chatData);
            
            logger.info(`Chat message from ${socket.username} in session ${sessionId}`);
        } catch (error) {
            logger.error('Error handling chat message:', error);
            socket.emit('error', { message: 'Failed to send message' });
        }
    });

    // Handle dice rolls
    socket.on('dice-roll', async (data) => {
        try {
            const { sessionId, dice, reason, isPrivate = false } = data;
            
            if (!sessionId || !dice) {
                socket.emit('error', { message: 'Session ID and dice are required' });
                return;
            }

            // Roll the dice (simple implementation)
            const rollResult = rollDice(dice);
            
            if (!rollResult) {
                socket.emit('error', { message: 'Invalid dice format' });
                return;
            }

            // Store roll in database
            const result = await pool.query(`
                INSERT INTO game_events (session_id, event_type, data, created_by)
                VALUES ($1, 'dice_roll', $2, $3)
                RETURNING *
            `, [sessionId, {
                dice,
                result: rollResult.total,
                rolls: rollResult.rolls,
                modifier: rollResult.modifier,
                reason,
                isPrivate,
                username: socket.username,
                timestamp: new Date().toISOString()
            }, socket.userId]);

            const rollData = {
                id: result.rows[0].id,
                sessionId,
                dice,
                result: rollResult.total,
                rolls: rollResult.rolls,
                modifier: rollResult.modifier,
                reason,
                userId: socket.userId,
                username: socket.username,
                timestamp: result.rows[0].created_at,
                isPrivate
            };

            // Broadcast to appropriate audience
            if (isPrivate) {
                // Send only to DM and the roller
                socket.emit('dice-roll', rollData);
                // TODO: Send to DM socket when we implement DM detection
            } else {
                io.to(`session-${sessionId}`).emit('dice-roll', rollData);
            }
            
            logger.info(`Dice roll (${dice}) from ${socket.username} in session ${sessionId}: ${rollResult.total}`);
        } catch (error) {
            logger.error('Error handling dice roll:', error);
            socket.emit('error', { message: 'Failed to roll dice' });
        }
    });

    // Handle player actions
    socket.on('player-action', async (data) => {
        try {
            const { sessionId, action, targetId, details } = data;
            
            if (!sessionId || !action) {
                socket.emit('error', { message: 'Session ID and action are required' });
                return;
            }

            // Store action in database
            const result = await pool.query(`
                INSERT INTO game_events (session_id, event_type, data, created_by)
                VALUES ($1, 'player_action', $2, $3)
                RETURNING *
            `, [sessionId, {
                action,
                targetId,
                details,
                username: socket.username,
                timestamp: new Date().toISOString()
            }, socket.userId]);

            const actionData = {
                id: result.rows[0].id,
                sessionId,
                action,
                targetId,
                details,
                userId: socket.userId,
                username: socket.username,
                timestamp: result.rows[0].created_at
            };

            // Broadcast to all users in the session
            io.to(`session-${sessionId}`).emit('player-action', actionData);
            
            logger.info(`Player action (${action}) from ${socket.username} in session ${sessionId}`);
        } catch (error) {
            logger.error('Error handling player action:', error);
            socket.emit('error', { message: 'Failed to process action' });
        }
    });

    // Handle session state updates
    socket.on('session-update', async (data) => {
        try {
            const { sessionId, updateType, updateData } = data;
            
            if (!sessionId || !updateType) {
                socket.emit('error', { message: 'Session ID and update type are required' });
                return;
            }

            // Store update in database
            const result = await pool.query(`
                INSERT INTO game_events (session_id, event_type, data, created_by)
                VALUES ($1, 'session_update', $2, $3)
                RETURNING *
            `, [sessionId, {
                updateType,
                updateData,
                username: socket.username,
                timestamp: new Date().toISOString()
            }, socket.userId]);

            const updateEventData = {
                id: result.rows[0].id,
                sessionId,
                updateType,
                updateData,
                userId: socket.userId,
                username: socket.username,
                timestamp: result.rows[0].created_at
            };

            // Broadcast to all users in the session
            io.to(`session-${sessionId}`).emit('session-update', updateEventData);
            
            logger.info(`Session update (${updateType}) from ${socket.username} in session ${sessionId}`);
        } catch (error) {
            logger.error('Error handling session update:', error);
            socket.emit('error', { message: 'Failed to update session' });
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        logger.info(`User disconnected: ${socket.username} (${socket.userId})`);
        
        // Remove from active users
        activeUsers.delete(socket.userId);
        
        // Remove from active sessions and notify others
        if (socket.currentSession) {
            const sessionId = socket.currentSession;
            
            if (activeSessions.has(sessionId)) {
                activeSessions.get(sessionId).delete(socket.userId);
                if (activeSessions.get(sessionId).size === 0) {
                    activeSessions.delete(sessionId);
                }
            }

            socket.to(`session-${sessionId}`).emit('user-left', {
                userId: socket.userId,
                username: socket.username
            });
        }
    });
});

// Utility function to roll dice
const rollDice = (diceString) => {
    const match = diceString.match(/(\d+)d(\d+)(?:\+(\d+))?/);
    if (!match) return null;
    
    const [, numDice, dieSize, modifier] = match;
    let total = 0;
    const rolls = [];
    
    for (let i = 0; i < parseInt(numDice); i++) {
        const roll = Math.floor(Math.random() * parseInt(dieSize)) + 1;
        rolls.push(roll);
        total += roll;
    }
    
    if (modifier) {
        total += parseInt(modifier);
    }
    
    return { total, rolls, modifier: modifier ? parseInt(modifier) : 0 };
};

// REST API endpoints for session history
app.get('/api/sessions/:sessionId/events', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { limit = 50, offset = 0 } = req.query;
        
        const result = await pool.query(`
            SELECT ge.*, u.username
            FROM game_events ge
            LEFT JOIN users u ON ge.created_by = u.id
            WHERE ge.session_id = $1
            ORDER BY ge.created_at DESC
            LIMIT $2 OFFSET $3
        `, [sessionId, limit, offset]);
        
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        logger.error('Error fetching session events:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch session events'
        });
    }
});

// Get active sessions
app.get('/api/sessions/active', (req, res) => {
    const sessions = Array.from(activeSessions.entries()).map(([sessionId, users]) => ({
        sessionId,
        userCount: users.size,
        users: Array.from(users).map(userId => {
            const user = activeUsers.get(userId);
            return user ? { userId, username: user.username } : null;
        }).filter(Boolean)
    }));
    
    res.json({
        success: true,
        data: sessions
    });
});

// Start server
server.listen(PORT, () => {
    logger.info(`Communication Service running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`WebSocket server enabled with CORS origins: ${process.env.ALLOWED_ORIGINS || 'http://localhost:3000'}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => {
        pool.end();
        redisClient.quit();
        process.exit(0);
    });
});

process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully');
    server.close(() => {
        pool.end();
        redisClient.quit();
        process.exit(0);
    });
});