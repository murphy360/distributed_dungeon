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
const PORT = process.env.PORT || 3004;

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
            service: 'player-service',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Health check failed:', error);
        res.status(503).json({ 
            status: 'unhealthy', 
            service: 'player-service',
            error: error.message 
        });
    }
});

// Get all players for a session
app.get('/api/sessions/:sessionId/players', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const result = await pool.query(`
            SELECT p.*, u.username, u.email,
                   c.name as character_name, c.class, c.level, c.race,
                   c.hit_points, c.armor_class, c.abilities, c.skills,
                   c.equipment, c.spells, c.background
            FROM players p
            JOIN users u ON p.user_id = u.id
            LEFT JOIN characters c ON p.character_id = c.id
            WHERE p.session_id = $1
            ORDER BY p.joined_at
        `, [sessionId]);
        
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        logger.error('Error fetching session players:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch session players'
        });
    }
});

// Get player by ID
app.get('/api/players/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`
            SELECT p.*, u.username, u.email,
                   c.name as character_name, c.class, c.level, c.race,
                   c.hit_points, c.armor_class, c.abilities, c.skills,
                   c.equipment, c.spells, c.background
            FROM players p
            JOIN users u ON p.user_id = u.id
            LEFT JOIN characters c ON p.character_id = c.id
            WHERE p.id = $1
        `, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Player not found'
            });
        }
        
        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        logger.error('Error fetching player:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch player'
        });
    }
});

// Add player to session
app.post('/api/sessions/:sessionId/players', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { user_id, character_id } = req.body;
        
        if (!user_id) {
            return res.status(400).json({
                success: false,
                error: 'User ID is required'
            });
        }
        
        // Check if player is already in session
        const existingPlayer = await pool.query(`
            SELECT id FROM players WHERE session_id = $1 AND user_id = $2
        `, [sessionId, user_id]);
        
        if (existingPlayer.rows.length > 0) {
            return res.status(409).json({
                success: false,
                error: 'Player is already in this session'
            });
        }
        
        const result = await pool.query(`
            INSERT INTO players (session_id, user_id, character_id, status)
            VALUES ($1, $2, $3, 'active')
            RETURNING *
        `, [sessionId, user_id, character_id]);
        
        res.status(201).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        logger.error('Error adding player to session:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to add player to session'
        });
    }
});

// Update player status
app.patch('/api/players/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status, current_room, current_hit_points } = req.body;
        
        const updateFields = [];
        const values = [];
        let paramCount = 0;
        
        if (status) {
            paramCount++;
            updateFields.push(`status = $${paramCount}`);
            values.push(status);
        }
        
        if (current_room !== undefined) {
            paramCount++;
            updateFields.push(`current_room = $${paramCount}`);
            values.push(current_room);
        }
        
        if (current_hit_points !== undefined) {
            paramCount++;
            updateFields.push(`current_hit_points = $${paramCount}`);
            values.push(current_hit_points);
        }
        
        if (updateFields.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No valid fields to update'
            });
        }
        
        paramCount++;
        values.push(id);
        
        const query = `
            UPDATE players 
            SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE id = $${paramCount}
            RETURNING *
        `;
        
        const result = await pool.query(query, values);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Player not found'
            });
        }
        
        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        logger.error('Error updating player:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update player'
        });
    }
});

// Get all characters for a user
app.get('/api/users/:userId/characters', async (req, res) => {
    try {
        const { userId } = req.params;
        const result = await pool.query(`
            SELECT * FROM characters 
            WHERE user_id = $1
            ORDER BY created_at DESC
        `, [userId]);
        
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        logger.error('Error fetching user characters:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch user characters'
        });
    }
});

// Create new character
app.post('/api/characters', async (req, res) => {
    try {
        const {
            user_id, name, class: characterClass, level, race, background,
            hit_points, armor_class, abilities, skills, equipment, spells
        } = req.body;
        
        if (!user_id || !name || !characterClass || !race) {
            return res.status(400).json({
                success: false,
                error: 'User ID, name, class, and race are required'
            });
        }
        
        const result = await pool.query(`
            INSERT INTO characters (
                user_id, name, class, level, race, background,
                hit_points, armor_class, abilities, skills, equipment, spells
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING *
        `, [
            user_id, name, characterClass, level || 1, race, background || '',
            hit_points || 8, armor_class || 10, abilities || {}, skills || {},
            equipment || [], spells || []
        ]);
        
        res.status(201).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        logger.error('Error creating character:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create character'
        });
    }
});

// Update character
app.patch('/api/characters/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name, class: characterClass, level, race, background,
            hit_points, armor_class, abilities, skills, equipment, spells
        } = req.body;
        
        const updateFields = [];
        const values = [];
        let paramCount = 0;
        
        const fieldsToUpdate = {
            name, class: characterClass, level, race, background,
            hit_points, armor_class, abilities, skills, equipment, spells
        };
        
        Object.entries(fieldsToUpdate).forEach(([key, value]) => {
            if (value !== undefined) {
                paramCount++;
                updateFields.push(`${key} = $${paramCount}`);
                values.push(value);
            }
        });
        
        if (updateFields.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No valid fields to update'
            });
        }
        
        paramCount++;
        values.push(id);
        
        const query = `
            UPDATE characters 
            SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
            WHERE id = $${paramCount}
            RETURNING *
        `;
        
        const result = await pool.query(query, values);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Character not found'
            });
        }
        
        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        logger.error('Error updating character:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update character'
        });
    }
});

// Remove player from session
app.delete('/api/players/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query(`
            DELETE FROM players WHERE id = $1 RETURNING *
        `, [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Player not found'
            });
        }
        
        res.json({
            success: true,
            message: 'Player removed from session',
            data: result.rows[0]
        });
    } catch (error) {
        logger.error('Error removing player from session:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to remove player from session'
        });
    }
});

// Start server
app.listen(PORT, () => {
    logger.info(`Player Service running on port ${PORT}`);
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