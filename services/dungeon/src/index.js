const express = require('express');
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
const PORT = process.env.PORT || 3002;

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

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        // Check database connection
        await pool.query('SELECT 1');
        
        // Check Redis connection
        await redisClient.ping();
        
        res.json({ 
            status: 'healthy', 
            service: 'dungeon-service',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Health check failed:', error);
        res.status(503).json({ 
            status: 'unhealthy', 
            service: 'dungeon-service',
            error: error.message 
        });
    }
});

// Get all dungeons
app.get('/api/dungeons', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT d.*, u.username as creator_name
            FROM dungeons d
            LEFT JOIN users u ON d.created_by = u.id
            ORDER BY d.created_at DESC
        `);
        
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        logger.error('Error fetching dungeons:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch dungeons'
        });
    }
});

// Get dungeon by ID
app.get('/api/dungeons/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`
            SELECT d.*, u.username as creator_name
            FROM dungeons d
            LEFT JOIN users u ON d.created_by = u.id
            WHERE d.id = $1
        `, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Dungeon not found'
            });
        }
        
        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        logger.error('Error fetching dungeon:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch dungeon'
        });
    }
});

// Create new dungeon
app.post('/api/dungeons', async (req, res) => {
    try {
        const { name, description, min_level, max_level, max_players, created_by } = req.body;
        
        if (!name || !created_by) {
            return res.status(400).json({
                success: false,
                error: 'Name and created_by are required'
            });
        }
        
        const result = await pool.query(`
            INSERT INTO dungeons (name, description, min_level, max_level, max_players, created_by)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [name, description, min_level || 1, max_level || 20, max_players || 4, created_by]);
        
        res.status(201).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        logger.error('Error creating dungeon:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create dungeon'
        });
    }
});

// Get dungeon rooms
app.get('/api/dungeons/:id/rooms', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`
            SELECT * FROM dungeon_rooms
            WHERE dungeon_id = $1
            ORDER BY room_number
        `, [id]);
        
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        logger.error('Error fetching dungeon rooms:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch dungeon rooms'
        });
    }
});

// Add room to dungeon
app.post('/api/dungeons/:id/rooms', async (req, res) => {
    try {
        const { id } = req.params;
        const { room_number, name, description, room_type, connections, properties } = req.body;
        
        if (!room_number || !name) {
            return res.status(400).json({
                success: false,
                error: 'Room number and name are required'
            });
        }
        
        const result = await pool.query(`
            INSERT INTO dungeon_rooms (dungeon_id, room_number, name, description, room_type, connections, properties)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `, [id, room_number, name, description, room_type || 'normal', connections || {}, properties || {}]);
        
        res.status(201).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        logger.error('Error adding room to dungeon:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add room to dungeon'
        });
    }
});

// Start server
app.listen(PORT, () => {
    logger.info(`Dungeon Service running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');
    await pool.end();
    await redisClient.quit();
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully');
    await pool.end();
    await redisClient.quit();
    process.exit(0);
});