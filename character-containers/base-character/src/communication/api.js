const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, param, validationResult } = require('express-validator');
const winston = require('winston');

// REST API for character container
class CharacterAPI {
  constructor(character, eventHandler, registry) {
    this.character = character;
    this.eventHandler = eventHandler;
    this.registry = registry;
    
    this.app = express();
    this.port = process.env.PORT || 3000;

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: './data/api.log' })
      ]
    });

    this.setupMiddleware();
    this.setupRoutes();
  }

  // Setup Express middleware
  setupMiddleware() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https:", "data:"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          fontSrc: ["'self'", "https:", "data:"],
          connectSrc: ["'self'"],
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
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
      credentials: true
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP'
    });
    this.app.use(limiter);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req, res, next) => {
      this.logger.info('API request', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });
  }

  // Setup API routes
  setupRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      const characterInfo = this.character.getCharacterInfo();
      const connectionStatus = this.eventHandler.getConnectionStatus();
      const registrationStatus = this.registry.getSessionInfo();

      res.json({
        status: 'healthy',
        character: {
          id: this.character.characterId,
          name: characterInfo.name,
          class: characterInfo.class,
          level: characterInfo.level,
          health: characterInfo.health,
          isAlive: this.character.state.isAlive(),
          canAct: this.character.state.canAct()
        },
        connection: connectionStatus,
        registration: {
          isRegistered: registrationStatus.hasToken,
          sessionId: registrationStatus.sessionId
        },
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    });

    // Get character information
    this.app.get('/api/character', (req, res) => {
      try {
        const characterSheet = this.character.getCharacterSheet();
        res.json({
          success: true,
          character: characterSheet
        });
      } catch (error) {
        this.logger.error('Failed to get character info', { error: error.message });
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Update character information
    this.app.put('/api/character',
      [
        body('name').optional().isLength({ min: 1, max: 50 }),
        body('level').optional().isInt({ min: 1, max: 20 }),
        body('health.current').optional().isInt({ min: 0 }),
        body('mana.current').optional().isInt({ min: 0 })
      ],
      (req, res) => {
        try {
          const errors = validationResult(req);
          if (!errors.isEmpty()) {
            return res.status(400).json({
              success: false,
              errors: errors.array()
            });
          }

          this.character.state.updateState(req.body);
          
          res.json({
            success: true,
            character: this.character.getCharacterInfo()
          });
        } catch (error) {
          this.logger.error('Failed to update character', { error: error.message });
          res.status(500).json({
            success: false,
            error: error.message
          });
        }
      }
    );

    // Process character action
    this.app.post('/api/character/action',
      [
        body('type').isString().notEmpty(),
        body('data').optional().isObject()
      ],
      async (req, res) => {
        try {
          const errors = validationResult(req);
          if (!errors.isEmpty()) {
            return res.status(400).json({
              success: false,
              errors: errors.array()
            });
          }

          const { type, data } = req.body;
          const result = await this.character.processAction(type, data);

          // If action was successful, submit to game system
          if (result.success && this.registry.isRegistered()) {
            const submissionResult = await this.registry.submitAction(this.character, result);
            result.submitted = submissionResult.success;
            result.submissionError = submissionResult.error;
          }

          res.json(result);
        } catch (error) {
          this.logger.error('Failed to process action', { 
            actionType: req.body.type,
            error: error.message 
          });
          res.status(500).json({
            success: false,
            error: error.message
          });
        }
      }
    );

    // Handle game events (called by game system)
    this.app.post('/event',
      [
        body('type').isString().notEmpty(),
        body('data').optional().isObject()
      ],
      async (req, res) => {
        try {
          const errors = validationResult(req);
          if (!errors.isEmpty()) {
            return res.status(400).json({
              success: false,
              errors: errors.array()
            });
          }

          const { type, data } = req.body;
          const result = await this.character.onGameEvent(type, data);

          res.json({
            success: true,
            response: result
          });
        } catch (error) {
          this.logger.error('Failed to handle event', { 
            eventType: req.body.type,
            error: error.message 
          });
          res.status(500).json({
            success: false,
            error: error.message
          });
        }
      }
    );

    // Get character inventory
    this.app.get('/inventory', (req, res) => {
      try {
        const characterSheet = this.character.getCharacterSheet();
        res.json({
          success: true,
          inventory: characterSheet.inventory
        });
      } catch (error) {
        this.logger.error('Failed to get inventory', { error: error.message });
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Use item from inventory
    this.app.post('/inventory/use/:itemId',
      [
        param('itemId').isUUID(),
        body('target').optional().isString()
      ],
      async (req, res) => {
        try {
          const errors = validationResult(req);
          if (!errors.isEmpty()) {
            return res.status(400).json({
              success: false,
              errors: errors.array()
            });
          }

          const { itemId } = req.params;
          const { target } = req.body;

          const result = await this.character.processAction('inventory.use_item', {
            itemId,
            target
          });

          res.json(result);
        } catch (error) {
          this.logger.error('Failed to use item', { 
            itemId: req.params.itemId,
            error: error.message 
          });
          res.status(500).json({
            success: false,
            error: error.message
          });
        }
      }
    );

    // Get character abilities and spells
    this.app.get('/abilities', (req, res) => {
      try {
        const characterSheet = this.character.getCharacterSheet();
        res.json({
          success: true,
          abilities: characterSheet.abilities,
          spells: characterSheet.spells
        });
      } catch (error) {
        this.logger.error('Failed to get abilities', { error: error.message });
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Cast spell
    this.app.post('/spell/cast',
      [
        body('spellName').isString().notEmpty(),
        body('target').optional().isString(),
        body('spellLevel').optional().isInt({ min: 1, max: 9 })
      ],
      async (req, res) => {
        try {
          const errors = validationResult(req);
          if (!errors.isEmpty()) {
            return res.status(400).json({
              success: false,
              errors: errors.array()
            });
          }

          const { spellName, target, spellLevel } = req.body;

          const result = await this.character.processAction('combat.cast_spell', {
            spellName,
            target,
            spellLevel
          });

          res.json(result);
        } catch (error) {
          this.logger.error('Failed to cast spell', { 
            spellName: req.body.spellName,
            error: error.message 
          });
          res.status(500).json({
            success: false,
            error: error.message
          });
        }
      }
    );

    // Get AI configuration
    this.app.get('/api/ai/status', (req, res) => {
      try {
        const characterSheet = this.character.getCharacterSheet();
        res.json({
          success: true,
          enabled: this.character.aiEnabled || false,
          aiSettings: characterSheet.aiSettings
        });
      } catch (error) {
        this.logger.error('Failed to get AI settings', { error: error.message });
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Update AI configuration
    this.app.put('/api/ai',
      [
        body('aggressiveness').optional().isFloat({ min: 0, max: 1 }),
        body('caution').optional().isFloat({ min: 0, max: 1 }),
        body('exploration').optional().isFloat({ min: 0, max: 1 }),
        body('social').optional().isFloat({ min: 0, max: 1 }),
        body('automation.combat').optional().isBoolean(),
        body('automation.exploration').optional().isBoolean(),
        body('automation.social').optional().isBoolean()
      ],
      (req, res) => {
        try {
          const errors = validationResult(req);
          if (!errors.isEmpty()) {
            return res.status(400).json({
              success: false,
              errors: errors.array()
            });
          }

          const currentState = this.character.state.getState();
          const newAiSettings = { ...currentState.aiSettings, ...req.body };

          this.character.state.updateState({
            aiSettings: newAiSettings
          });

          res.json({
            success: true,
            aiSettings: newAiSettings
          });
        } catch (error) {
          this.logger.error('Failed to update AI settings', { error: error.message });
          res.status(500).json({
            success: false,
            error: error.message
          });
        }
      }
    );

    // Registration endpoints
    this.app.post('/register', async (req, res) => {
      try {
        if (this.registry.isRegistered()) {
          return res.status(400).json({
            success: false,
            error: 'Character already registered'
          });
        }

        const result = await this.registry.registerCharacter(this.character);
        res.json(result);
      } catch (error) {
        this.logger.error('Registration failed', { error: error.message });
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    this.app.post('/unregister', async (req, res) => {
      try {
        const result = await this.registry.unregisterCharacter(this.character);
        res.json(result);
      } catch (error) {
        this.logger.error('Unregistration failed', { error: error.message });
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Save character state
    this.app.post('/api/character/save', (req, res) => {
      try {
        this.character.save();
        res.json({
          success: true,
          message: 'Character state saved',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        this.logger.error('Failed to save character', { error: error.message });
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    // Debug endpoint (only in development)
    if (process.env.NODE_ENV === 'development') {
      this.app.get('/debug', (req, res) => {
        res.json({
          character: this.character.getCharacterSheet(),
          connection: this.eventHandler.getConnectionStatus(),
          registration: this.registry.getSessionInfo(),
          memory: process.memoryUsage(),
          uptime: process.uptime()
        });
      });
    }

    // Error handling middleware
    this.app.use((error, req, res, next) => {
      this.logger.error('Unhandled API error', {
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method
      });

      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    });

    // Web interface routes
    this.setupWebInterface();

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: 'Endpoint not found'
      });
    });
  }

  // Setup web interface for character sheet
  setupWebInterface() {
    const webDir = path.join(__dirname, '..', 'web');
    
    // Serve the main character sheet interface
    this.app.get('/', (req, res) => {
      try {
        const indexPath = path.join(webDir, 'index.html');
        if (fs.existsSync(indexPath)) {
          let html = fs.readFileSync(indexPath, 'utf8');
          
          // Replace template variables
          const characterInfo = this.character.getCharacterInfo();
          html = html.replace(/{{CHARACTER_NAME}}/g, characterInfo.name || 'Unknown Character');
          
          res.setHeader('Content-Type', 'text/html');
          res.send(html);
        } else {
          res.status(404).send('Character sheet interface not found');
        }
      } catch (error) {
        this.logger.error('Error serving character sheet', { error: error.message });
        res.status(500).send('Error loading character sheet');
      }
    });

    // Serve the logs interface
    this.app.get('/logs', (req, res) => {
      try {
        const logsPath = path.join(webDir, 'logs.html');
        if (fs.existsSync(logsPath)) {
          let html = fs.readFileSync(logsPath, 'utf8');
          
          // Replace template variables
          const characterInfo = this.character.getCharacterInfo();
          html = html.replace(/{{CHARACTER_NAME}}/g, characterInfo.name || 'Unknown Character');
          
          res.setHeader('Content-Type', 'text/html');
          res.send(html);
        } else {
          res.status(404).send('Logs interface not found');
        }
      } catch (error) {
        this.logger.error('Error serving logs interface', { error: error.message });
        res.status(500).send('Error loading logs interface');
      }
    });

    // API endpoint to get actual log data
    this.app.get('/api/logs', (req, res) => {
      try {
        const logsDir = './data';
        const logFiles = ['character-container.log', 'api.log', 'events.log'];
        const allLogs = [];
        
        logFiles.forEach(filename => {
          const logPath = path.join(logsDir, filename);
          if (fs.existsSync(logPath)) {
            try {
              const logContent = fs.readFileSync(logPath, 'utf8');
              const lines = logContent.split('\n').filter(line => line.trim());
              
              lines.forEach(line => {
                try {
                  const logEntry = JSON.parse(line);
                  allLogs.push({
                    ...logEntry,
                    source: filename
                  });
                } catch (parseError) {
                  // If line is not JSON, treat as plain text
                  allLogs.push({
                    timestamp: new Date().toISOString(),
                    level: 'info',
                    message: line,
                    source: filename
                  });
                }
              });
            } catch (fileError) {
              this.logger.error(`Error reading log file ${filename}`, { error: fileError.message });
            }
          }
        });
        
        // Sort by timestamp, most recent first
        allLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // Return last 500 entries
        res.json({
          success: true,
          logs: allLogs.slice(0, 500),
          totalCount: allLogs.length
        });
      } catch (error) {
        this.logger.error('Error fetching logs', { error: error.message });
        res.status(500).json({
          success: false,
          error: error.message
        });
      }
    });

    this.logger.info('Web interface routes configured');
  }

  // Start the API server
  async start() {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, () => {
          this.logger.info('Character API server started', {
            characterId: this.character.characterId,
            port: this.port,
            environment: process.env.NODE_ENV || 'development'
          });
          resolve();
        });

        this.server.on('error', (error) => {
          this.logger.error('API server error', { error: error.message });
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  // Stop the API server
  async stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.logger.info('Character API server stopped', {
            characterId: this.character.characterId
          });
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  // Get server information
  getServerInfo() {
    return {
      port: this.port,
      isRunning: this.server && this.server.listening,
      characterId: this.character.characterId
    };
  }
}

module.exports = CharacterAPI;