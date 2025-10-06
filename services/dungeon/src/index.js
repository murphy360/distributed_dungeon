const express = require('express');
const { Pool } = require('pg');
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
const PORT = process.env.PORT || 3002;

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

// Redis removed - using file-based state management

// Serve main web interface
app.get('/', (req, res) => {
    const indexPath = path.join(webDir, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('Dungeon map interface not found');
    }
});

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        // Check database connection
        await pool.query('SELECT 1');
        
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

// Dashboard API endpoints for web interface
app.get('/api/dashboard/overview', async (req, res) => {
    try {
        // Get basic stats
        const dungeonCount = await pool.query('SELECT COUNT(*) as count FROM dungeons');
        const roomCount = await pool.query('SELECT COUNT(*) as count FROM dungeon_rooms');
        
        // Get recent activity (using in-memory storage instead of Redis)
        let recentActivity = [
            { action: 'Dungeon service started', timestamp: new Date().toISOString() }
        ];
        
        const overview = {
            status: 'active',
            totalDungeons: parseInt(dungeonCount.rows[0].count),
            totalRooms: parseInt(roomCount.rows[0].count),
            activeExplorations: 0, // TODO: Track active sessions
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

// Get sample dungeon map data for visualization
app.get('/api/dungeons/:id/map', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get dungeon info and rooms
        const dungeonResult = await pool.query('SELECT * FROM dungeons WHERE id = $1', [id]);
        if (dungeonResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Dungeon not found' });
        }
        
        const roomsResult = await pool.query(`
            SELECT room_number, name, description, room_type, connections, properties,
                   COALESCE(properties->>'x', '0')::int as x,
                   COALESCE(properties->>'y', '0')::int as y
            FROM dungeon_rooms 
            WHERE dungeon_id = $1 
            ORDER BY room_number
        `, [id]);
        
        // If no rooms exist, create sample data
        let rooms = roomsResult.rows;
        if (rooms.length === 0) {
            // Generate sample dungeon layout
            rooms = generateSampleDungeon();
        }
        
        res.json({
            success: true,
            data: {
                dungeon: dungeonResult.rows[0],
                rooms: rooms,
                grid: {
                    width: 20,
                    height: 15,
                    cellSize: 30
                }
            }
        });
    } catch (error) {
        logger.error('Error fetching dungeon map:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch dungeon map'
        });
    }
});

// Get real-time dungeon state
app.get('/api/dungeons/:id/state', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Get current state (using in-memory storage instead of Redis)
        let currentState = {
            activeCharacters: [],
            monsters: [],
            environmentalEffects: [],
            timeOfDay: 'day',
            weather: 'clear',
            lastUpdate: new Date().toISOString()
        };
        
        res.json({ success: true, data: currentState });
    } catch (error) {
        logger.error('Error fetching dungeon state:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch dungeon state'
        });
    }
});

// Character registration endpoint
app.post('/api/registry/character', async (req, res) => {
    try {
        const { characterId, name, class: characterClass, level, containerEndpoint } = req.body;
        
        if (!characterId || !name || !containerEndpoint) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: characterId, name, containerEndpoint'
            });
        }
        
        logger.info('Character registration request', {
            characterId,
            name,
            characterClass,
            level,
            containerEndpoint
        });
        
        // Generate a session token (simplified)
        const sessionToken = jwt.sign(
            { characterId, name, timestamp: Date.now() },
            process.env.JWT_SECRET || 'fallback-secret',
            { expiresIn: '24h' }
        );
        
        res.json({
            success: true,
            sessionId: generateSessionId(),
            token: sessionToken,
            message: 'Character registered successfully',
            gameState: {
                status: 'connected',
                dungeon: 'Main Dungeon',
                currentRoom: 'entrance'
            }
        });
        
    } catch (error) {
        logger.error('Error registering character:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to register character'
        });
    }
});

// Helper function to generate session IDs
function generateSessionId() {
    return 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// Helper function to generate sample dungeon data
function generateSampleDungeon() {
    return [
        {
            room_number: 1,
            name: "Entrance Hall",
            description: "A grand entrance with stone pillars and flickering torches",
            room_type: "entrance",
            x: 5, y: 7,
            connections: { north: 2, east: 3 },
            properties: { lighting: "dim", temperature: "cool" }
        },
        {
            room_number: 2,
            name: "Guard Room",
            description: "Former barracks with overturned furniture",
            room_type: "combat",
            x: 5, y: 5,
            connections: { south: 1, east: 4 },
            properties: { lighting: "dark", temperature: "cold", hasEnemies: true }
        },
        {
            room_number: 3,
            name: "Storage Chamber",
            description: "Dusty room filled with old crates and barrels",
            room_type: "treasure",
            x: 8, y: 7,
            connections: { west: 1, north: 4 },
            properties: { lighting: "very dim", hasLoot: true }
        },
        {
            room_number: 4,
            name: "Central Chamber",
            description: "A large circular room with a mysterious altar",
            room_type: "boss",
            x: 8, y: 5,
            connections: { west: 2, south: 3, north: 5 },
            properties: { lighting: "magical", temperature: "warm", isBossRoom: true }
        },
        {
            room_number: 5,
            name: "Treasure Vault",
            description: "The final chamber containing ancient treasures",
            room_type: "treasure",
            x: 8, y: 3,
            connections: { south: 4 },
            properties: { lighting: "bright", hasLoot: true, isEndRoom: true }
        }
    ];
}

// Start server
app.listen(PORT, () => {
    logger.info(`Dungeon Service running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');
    await pool.end();
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully');
    await pool.end();
    process.exit(0);
});