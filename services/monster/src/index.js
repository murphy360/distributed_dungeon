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
const PORT = process.env.PORT || 3003;

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
            service: 'monster-service',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Health check failed:', error);
        res.status(503).json({ 
            status: 'unhealthy', 
            service: 'monster-service',
            error: error.message 
        });
    }
});

// Get all monsters
app.get('/api/monsters', async (req, res) => {
    try {
        const { cr, type, size, alignment } = req.query;
        let query = 'SELECT * FROM monsters WHERE 1=1';
        const params = [];
        let paramCount = 0;

        if (cr) {
            paramCount++;
            query += ` AND challenge_rating = $${paramCount}`;
            params.push(parseFloat(cr));
        }

        if (type) {
            paramCount++;
            query += ` AND type ILIKE $${paramCount}`;
            params.push(`%${type}%`);
        }

        if (size) {
            paramCount++;
            query += ` AND size ILIKE $${paramCount}`;
            params.push(`%${size}%`);
        }

        if (alignment) {
            paramCount++;
            query += ` AND alignment ILIKE $${paramCount}`;
            params.push(`%${alignment}%`);
        }

        query += ' ORDER BY name';

        const result = await pool.query(query, params);
        
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        logger.error('Error fetching monsters:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch monsters'
        });
    }
});

// Get monster by ID
app.get('/api/monsters/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await pool.query('SELECT * FROM monsters WHERE id = $1', [id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Monster not found'
            });
        }
        
        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        logger.error('Error fetching monster:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch monster'
        });
    }
});

// Create new monster
app.post('/api/monsters', async (req, res) => {
    try {
        const {
            name, size, type, alignment, armor_class, hit_points, speed,
            strength, dexterity, constitution, intelligence, wisdom, charisma,
            skills, damage_resistances, damage_immunities, condition_immunities,
            senses, languages, challenge_rating, special_abilities, actions,
            legendary_actions, reactions, lair_actions
        } = req.body;
        
        if (!name || !type) {
            return res.status(400).json({
                success: false,
                error: 'Name and type are required'
            });
        }
        
        const result = await pool.query(`
            INSERT INTO monsters (
                name, size, type, alignment, armor_class, hit_points, speed,
                strength, dexterity, constitution, intelligence, wisdom, charisma,
                skills, damage_resistances, damage_immunities, condition_immunities,
                senses, languages, challenge_rating, special_abilities, actions,
                legendary_actions, reactions, lair_actions
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
            RETURNING *
        `, [
            name, size || 'Medium', type, alignment || 'Neutral',
            armor_class || 10, hit_points || 1, speed || {'walk': '30 ft'},
            strength || 10, dexterity || 10, constitution || 10,
            intelligence || 10, wisdom || 10, charisma || 10,
            skills || {}, damage_resistances || [], damage_immunities || [],
            condition_immunities || [], senses || [], languages || [],
            challenge_rating || 0, special_abilities || [], actions || [],
            legendary_actions || [], reactions || [], lair_actions || []
        ]);
        
        res.status(201).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        logger.error('Error creating monster:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create monster'
        });
    }
});

// Get monsters by challenge rating range
app.get('/api/monsters/cr/:min/:max', async (req, res) => {
    try {
        const { min, max } = req.params;
        const result = await pool.query(`
            SELECT * FROM monsters 
            WHERE challenge_rating >= $1 AND challenge_rating <= $2
            ORDER BY challenge_rating, name
        `, [parseFloat(min), parseFloat(max)]);
        
        res.json({
            success: true,
            data: result.rows
        });
    } catch (error) {
        logger.error('Error fetching monsters by CR range:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch monsters by challenge rating range'
        });
    }
});

// Get random monster by challenge rating
app.get('/api/monsters/random/:cr', async (req, res) => {
    try {
        const { cr } = req.params;
        const result = await pool.query(`
            SELECT * FROM monsters 
            WHERE challenge_rating = $1
            ORDER BY RANDOM()
            LIMIT 1
        `, [parseFloat(cr)]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: `No monsters found with challenge rating ${cr}`
            });
        }
        
        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        logger.error('Error fetching random monster:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch random monster'
        });
    }
});

// Calculate encounter difficulty
app.post('/api/encounters/calculate', async (req, res) => {
    try {
        const { partyLevel, partySize, monsterIds } = req.body;
        
        if (!partyLevel || !partySize || !monsterIds || !Array.isArray(monsterIds)) {
            return res.status(400).json({
                success: false,
                error: 'Party level, party size, and monster IDs are required'
            });
        }
        
        // Get monster challenge ratings
        const monsters = await pool.query(`
            SELECT id, name, challenge_rating FROM monsters 
            WHERE id = ANY($1)
        `, [monsterIds]);
        
        // Calculate total XP
        let totalXP = 0;
        const crToXP = {
            0: 10, 0.125: 25, 0.25: 50, 0.5: 100,
            1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800,
            6: 2300, 7: 2900, 8: 3900, 9: 5000, 10: 5900,
            11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000,
            16: 15000, 17: 18000, 18: 20000, 19: 22000, 20: 25000,
            21: 33000, 22: 41000, 23: 50000, 24: 62000, 25: 75000,
            26: 90000, 27: 105000, 28: 120000, 29: 135000, 30: 155000
        };
        
        monsters.rows.forEach(monster => {
            totalXP += crToXP[monster.challenge_rating] || 0;
        });
        
        // Apply multiplier based on number of monsters
        const monsterCount = monsters.rows.length;
        let multiplier = 1;
        if (monsterCount >= 15) multiplier = 4;
        else if (monsterCount >= 11) multiplier = 3;
        else if (monsterCount >= 7) multiplier = 2.5;
        else if (monsterCount >= 3) multiplier = 2;
        else if (monsterCount === 2) multiplier = 1.5;
        
        const adjustedXP = Math.floor(totalXP * multiplier);
        
        // Determine difficulty thresholds for party
        const thresholdsPerLevel = {
            1: { easy: 25, medium: 50, hard: 75, deadly: 100 },
            2: { easy: 50, medium: 100, hard: 150, deadly: 200 },
            3: { easy: 75, medium: 150, hard: 225, deadly: 400 },
            4: { easy: 125, medium: 250, hard: 375, deadly: 500 },
            5: { easy: 250, medium: 500, hard: 750, deadly: 1100 },
            // Add more levels as needed
        };
        
        const levelThresholds = thresholdsPerLevel[partyLevel] || thresholdsPerLevel[5];
        const partyThresholds = {
            easy: levelThresholds.easy * partySize,
            medium: levelThresholds.medium * partySize,
            hard: levelThresholds.hard * partySize,
            deadly: levelThresholds.deadly * partySize
        };
        
        let difficulty = 'trivial';
        if (adjustedXP >= partyThresholds.deadly) difficulty = 'deadly';
        else if (adjustedXP >= partyThresholds.hard) difficulty = 'hard';
        else if (adjustedXP >= partyThresholds.medium) difficulty = 'medium';
        else if (adjustedXP >= partyThresholds.easy) difficulty = 'easy';
        
        res.json({
            success: true,
            data: {
                monsters: monsters.rows,
                totalXP,
                adjustedXP,
                difficulty,
                thresholds: partyThresholds
            }
        });
    } catch (error) {
        logger.error('Error calculating encounter:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to calculate encounter difficulty'
        });
    }
});

// Start server
app.listen(PORT, () => {
    logger.info(`Monster Service running on port ${PORT}`);
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