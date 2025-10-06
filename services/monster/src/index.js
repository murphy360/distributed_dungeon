const express = require('express');
const { Pool } = require('pg');
const redis = require('redis');
const jwt = require('jsonwebtoken');
const winston = require('winston');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');

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

// Security middleware
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

// Middleware
app.use(express.json());

// Serve static files from web directory
const webDir = path.join(__dirname, 'web');
app.use(express.static(webDir));

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

// Serve main web interface
app.get('/', (req, res) => {
    const indexPath = path.join(webDir, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('Monster management interface not found');
    }
});

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

// Dashboard API endpoints for web interface
app.get('/api/dashboard/overview', async (req, res) => {
    try {
        // Get basic stats
        const monsterCount = await pool.query('SELECT COUNT(*) as count FROM monsters');
        const crDistribution = await pool.query(`
            SELECT challenge_rating, COUNT(*) as count 
            FROM monsters 
            GROUP BY challenge_rating 
            ORDER BY challenge_rating
        `);
        const typeDistribution = await pool.query(`
            SELECT type, COUNT(*) as count 
            FROM monsters 
            GROUP BY type 
            ORDER BY count DESC
        `);
        
        // Get recent activity from Redis (if available)
        let recentActivity = [];
        try {
            const activity = await redisClient.lRange('monster:recent_activity', 0, 9);
            recentActivity = activity.map(item => JSON.parse(item));
        } catch (redisError) {
            logger.warn('Could not fetch recent activity from Redis:', redisError);
        }
        
        const overview = {
            status: 'active',
            totalMonsters: parseInt(monsterCount.rows[0].count),
            crDistribution: crDistribution.rows,
            typeDistribution: typeDistribution.rows,
            activeEncounters: 0, // TODO: Track active encounters
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            recentActivity: recentActivity,
            timestamp: new Date().toISOString()
        };
        
        res.json({ success: true, data: overview });
    } catch (error) {
        logger.error('Error fetching dashboard overview:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch overview data'
        });
    }
});

// Get monster statistics for charts
app.get('/api/dashboard/stats', async (req, res) => {
    try {
        const stats = {
            crDistribution: await pool.query(`
                SELECT challenge_rating, COUNT(*) as count 
                FROM monsters 
                GROUP BY challenge_rating 
                ORDER BY challenge_rating
            `),
            sizeDistribution: await pool.query(`
                SELECT size, COUNT(*) as count 
                FROM monsters 
                GROUP BY size 
                ORDER BY count DESC
            `),
            typeDistribution: await pool.query(`
                SELECT type, COUNT(*) as count 
                FROM monsters 
                GROUP BY type 
                ORDER BY count DESC
            `),
            alignmentDistribution: await pool.query(`
                SELECT alignment, COUNT(*) as count 
                FROM monsters 
                GROUP BY alignment 
                ORDER BY count DESC
            `)
        };
        
        res.json({ 
            success: true, 
            data: {
                crDistribution: stats.crDistribution.rows,
                sizeDistribution: stats.sizeDistribution.rows,
                typeDistribution: stats.typeDistribution.rows,
                alignmentDistribution: stats.alignmentDistribution.rows
            }
        });
    } catch (error) {
        logger.error('Error fetching monster statistics:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch monster statistics'
        });
    }
});

// Get encounter suggestions
app.get('/api/encounters/suggestions', async (req, res) => {
    try {
        const { partyLevel = 5, partySize = 4, difficulty = 'medium', environment } = req.query;
        
        // Calculate XP budget
        const thresholdsPerLevel = {
            1: { easy: 25, medium: 50, hard: 75, deadly: 100 },
            2: { easy: 50, medium: 100, hard: 150, deadly: 200 },
            3: { easy: 75, medium: 150, hard: 225, deadly: 400 },
            4: { easy: 125, medium: 250, hard: 375, deadly: 500 },
            5: { easy: 250, medium: 500, hard: 750, deadly: 1100 },
            6: { easy: 300, medium: 600, hard: 900, deadly: 1400 },
            7: { easy: 350, medium: 750, hard: 1100, deadly: 1700 },
            8: { easy: 450, medium: 900, hard: 1400, deadly: 2100 },
            9: { easy: 550, medium: 1100, hard: 1600, deadly: 2400 },
            10: { easy: 600, medium: 1200, hard: 1900, deadly: 2800 }
        };
        
        const levelThresholds = thresholdsPerLevel[parseInt(partyLevel)] || thresholdsPerLevel[5];
        const xpBudget = levelThresholds[difficulty] * parseInt(partySize);
        
        // Get appropriate monsters (CR should be roughly party level ± 3)
        const minCR = Math.max(0, parseInt(partyLevel) - 3);
        const maxCR = parseInt(partyLevel) + 3;
        
        let query = `
            SELECT * FROM monsters 
            WHERE challenge_rating >= $1 AND challenge_rating <= $2
        `;
        const params = [minCR, maxCR];
        
        if (environment) {
            query += ` AND ($${params.length + 1} = ANY(environments) OR environments IS NULL)`;
            params.push(environment);
        }
        
        query += ' ORDER BY RANDOM() LIMIT 20';
        
        const result = await pool.query(query, params);
        
        res.json({
            success: true,
            data: {
                xpBudget,
                difficulty,
                monsters: result.rows,
                suggestions: generateEncounterSuggestions(result.rows, xpBudget)
            }
        });
    } catch (error) {
        logger.error('Error fetching encounter suggestions:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch encounter suggestions'
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

// Helper function to generate encounter suggestions
function generateEncounterSuggestions(monsters, xpBudget) {
    const suggestions = [];
    const crToXP = {
        0: 10, 0.125: 25, 0.25: 50, 0.5: 100,
        1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800,
        6: 2300, 7: 2900, 8: 3900, 9: 5000, 10: 5900,
        11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000,
        16: 15000, 17: 18000, 18: 20000, 19: 22000, 20: 25000
    };
    
    // Single monster encounters
    monsters.forEach(monster => {
        const monsterXP = crToXP[monster.challenge_rating] || 0;
        if (monsterXP <= xpBudget * 1.2 && monsterXP >= xpBudget * 0.5) {
            suggestions.push({
                type: 'single',
                monsters: [monster],
                totalXP: monsterXP,
                adjustedXP: monsterXP,
                description: `Single ${monster.name}`
            });
        }
    });
    
    // Multiple monster encounters (basic implementation)
    for (let i = 0; i < monsters.length && suggestions.length < 10; i++) {
        for (let j = i + 1; j < monsters.length && suggestions.length < 10; j++) {
            const monster1XP = crToXP[monsters[i].challenge_rating] || 0;
            const monster2XP = crToXP[monsters[j].challenge_rating] || 0;
            const totalXP = monster1XP + monster2XP;
            const adjustedXP = totalXP * 1.5; // 2 monsters multiplier
            
            if (adjustedXP <= xpBudget * 1.2 && adjustedXP >= xpBudget * 0.7) {
                suggestions.push({
                    type: 'pair',
                    monsters: [monsters[i], monsters[j]],
                    totalXP,
                    adjustedXP,
                    description: `${monsters[i].name} and ${monsters[j].name}`
                });
            }
        }
    }
    
    return suggestions.slice(0, 5); // Return top 5 suggestions
}

// Start server
app.listen(PORT, () => {
    logger.info(`Monster Service running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    
    // Add some sample activity data after startup
    setTimeout(async () => {
        try {
            const sampleActivity = [
                { type: 'encounter', message: 'Goblin encounter generated for level 3 party', timestamp: new Date(Date.now() - 300000).toISOString() },
                { type: 'creation', message: 'New custom monster "Shadow Drake" created', timestamp: new Date(Date.now() - 240000).toISOString() },
                { type: 'encounter', message: 'Deadly encounter calculated: Ancient Red Dragon', timestamp: new Date(Date.now() - 180000).toISOString() },
                { type: 'search', message: 'Monster search: CR 5-8 undead creatures', timestamp: new Date(Date.now() - 120000).toISOString() },
                { type: 'encounter', message: 'Medium encounter: 2 Owlbears vs party of 4', timestamp: new Date(Date.now() - 60000).toISOString() }
            ];
            
            for (const activity of sampleActivity) {
                await redisClient.lPush('monster:recent_activity', JSON.stringify(activity));
            }
            await redisClient.lTrim('monster:recent_activity', 0, 19); // Keep only 20 items
        } catch (error) {
            logger.warn('Could not initialize sample activity data:', error);
        }
    }, 2000);
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