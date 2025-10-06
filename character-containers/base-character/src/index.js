const CharacterBase = require('./character/base');
const CombatAI = require('./ai/combat');
const ExplorationAI = require('./ai/exploration');
const CharacterRegistry = require('./communication/registry');
const EventHandler = require('./communication/events');
const CharacterAPI = require('./communication/api');
const winston = require('winston');
const cron = require('node-cron');
require('dotenv').config();

// Main character container application
class CharacterContainer {
  constructor(config = {}) {
    this.config = {
      characterId: config.characterId || process.env.CHARACTER_ID,
      name: config.name || process.env.CHARACTER_NAME || 'Unknown Character',
      class: config.class || process.env.CHARACTER_CLASS || 'fighter',
      level: parseInt(config.level || process.env.CHARACTER_LEVEL || '1'),
      autoRegister: config.autoRegister !== false,
      enableAI: config.enableAI !== false,
      aiConfig: {
        aggressiveness: parseFloat(config.aggressiveness || process.env.AI_AGGRESSIVENESS || '0.5'),
        caution: parseFloat(config.caution || process.env.AI_CAUTION || '0.5'),
        curiosity: parseFloat(config.curiosity || process.env.AI_CURIOSITY || '0.7'),
        tactical: parseFloat(config.tactical || process.env.AI_TACTICAL || '0.5'),
        ...config.aiConfig
      },
      ...config
    };

    // Initialize logger
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: './data/character-container.log' })
      ]
    });

    // Initialize components
    this.character = null;
    this.combatAI = null;
    this.explorationAI = null;
    this.registry = null;
    this.eventHandler = null;
    this.api = null;

    this.isRunning = false;
    this.heartbeatInterval = null;
    this.saveInterval = null;

    this.logger.info('Character container initialized', {
      characterId: this.config.characterId,
      name: this.config.name,
      class: this.config.class,
      level: this.config.level
    });
  }

  // Initialize all components
  async initialize() {
    try {
      this.logger.info('Initializing character container...');

      // Initialize character
      await this.initializeCharacter();

      // Initialize AI components
      if (this.config.enableAI) {
        await this.initializeAI();
      }

      // Initialize communication components
      await this.initializeCommunication();

      // Initialize API server
      await this.initializeAPI();

      // Setup periodic tasks
      this.setupPeriodicTasks();

      this.logger.info('Character container initialization complete');
      return { success: true };

    } catch (error) {
      this.logger.error('Character container initialization failed', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  // Initialize character
  async initializeCharacter() {
    this.logger.info('Initializing character...');

    this.character = new CharacterBase({
      characterId: this.config.characterId,
      name: this.config.name,
      class: this.config.class,
      level: this.config.level,
      ...this.config
    });

    this.character.aiEnabled = this.config.enableAI;

    this.logger.info('Character initialized', {
      characterId: this.character.characterId,
      name: this.character.state.state.name,
      class: this.character.state.state.class,
      level: this.character.state.state.level
    });
  }

  // Initialize AI components
  async initializeAI() {
    this.logger.info('Initializing AI components...');

    // Initialize combat AI
    this.combatAI = new CombatAI(this.config.aiConfig);

    // Initialize exploration AI
    this.explorationAI = new ExplorationAI(this.config.aiConfig);

    // Override character event handlers to use AI
    const originalOnCombatTurn = this.character.onCombatTurn.bind(this.character);
    this.character.onCombatTurn = async (eventData) => {
      const baseResponse = await originalOnCombatTurn(eventData);
      
      // If AI is enabled and no manual action is specified, use AI decision
      if (this.character.aiEnabled && !baseResponse.action) {
        try {
          const aiAction = await this.combatAI.decideCombatAction(
            this.character,
            eventData.gameState,
            eventData.availableActions
          );
          
          if (aiAction) {
            baseResponse.action = aiAction;
            baseResponse.aiGenerated = true;
          }
        } catch (error) {
          this.logger.error('Combat AI decision failed', {
            characterId: this.character.characterId,
            error: error.message
          });
        }
      }
      
      return baseResponse;
    };

    // Override exploration decision making
    this.character.onExplorationTurn = async (eventData) => {
      if (this.character.aiEnabled) {
        try {
          const aiAction = await this.explorationAI.decideExplorationAction(
            this.character,
            eventData.gameState,
            eventData.availableActions
          );
          
          return {
            acknowledged: true,
            action: aiAction,
            aiGenerated: true
          };
        } catch (error) {
          this.logger.error('Exploration AI decision failed', {
            characterId: this.character.characterId,
            error: error.message
          });
        }
      }
      
      return { acknowledged: true, action: null };
    };

    this.logger.info('AI components initialized');
  }

  // Initialize communication components
  async initializeCommunication() {
    this.logger.info('Initializing communication components...');

    // Initialize registry client
    this.registry = new CharacterRegistry({
      registryUrl: process.env.REGISTRY_URL,
      characterEndpoint: process.env.CHARACTER_ENDPOINT || 'http://localhost:3000'
    });

    // Initialize event handler
    this.eventHandler = new EventHandler({
      gameServerUrl: process.env.GAME_SERVER_URL,
      redisUrl: process.env.REDIS_URL
    });

    this.logger.info('Communication components initialized');
  }

  // Initialize API server
  async initializeAPI() {
    this.logger.info('Initializing API server...');

    this.api = new CharacterAPI(this.character, this.eventHandler, this.registry);
    await this.api.start();

    this.logger.info('API server initialized and started');
  }

  // Setup periodic tasks
  setupPeriodicTasks() {
    this.logger.info('Setting up periodic tasks...');

    // Auto-save character state every 5 minutes
    this.saveInterval = cron.schedule('*/5 * * * *', () => {
      try {
        this.character.save();
        this.logger.debug('Character state auto-saved');
      } catch (error) {
        this.logger.error('Auto-save failed', { error: error.message });
      }
    });

    // Send heartbeat every minute if registered
    this.heartbeatInterval = cron.schedule('* * * * *', async () => {
      if (this.registry.isRegistered()) {
        try {
          await this.registry.sendHeartbeat(this.character);
          this.logger.debug('Heartbeat sent');
        } catch (error) {
          this.logger.error('Heartbeat failed', { error: error.message });
        }
      }
    });

    this.logger.info('Periodic tasks set up');
  }

  // Start the character container
  async start() {
    try {
      if (this.isRunning) {
        this.logger.warn('Character container is already running');
        return { success: true, message: 'Already running' };
      }

      this.logger.info('Starting character container...');

      await this.initialize();

      // Auto-register if enabled
      if (this.config.autoRegister) {
        await this.registerWithGame();
      }

      this.isRunning = true;

      this.logger.info('Character container started successfully', {
        characterId: this.character.characterId,
        apiPort: this.api.getServerInfo().port,
        aiEnabled: this.character.aiEnabled,
        registered: this.registry.isRegistered()
      });

      return { success: true };

    } catch (error) {
      this.logger.error('Failed to start character container', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  // Register with game system
  async registerWithGame() {
    try {
      this.logger.info('Registering with game system...');

      const registrationResult = await this.registry.registerCharacter(this.character);
      
      if (registrationResult.success) {
        // Initialize event system with authentication token
        await this.eventHandler.initialize(this.character, registrationResult.token);
        
        this.logger.info('Successfully registered with game system', {
          characterId: this.character.characterId,
          sessionId: registrationResult.sessionId
        });
        
        return registrationResult;
      } else {
        throw new Error(registrationResult.error || 'Registration failed');
      }

    } catch (error) {
      this.logger.error('Failed to register with game system', {
        characterId: this.character.characterId,
        error: error.message
      });
      throw error;
    }
  }

  // Stop the character container
  async stop() {
    try {
      this.logger.info('Stopping character container...');

      this.isRunning = false;

      // Clear periodic tasks
      if (this.saveInterval) {
        this.saveInterval.destroy();
        this.saveInterval = null;
      }

      if (this.heartbeatInterval) {
        this.heartbeatInterval.destroy();
        this.heartbeatInterval = null;
      }

      // Save character state
      if (this.character) {
        this.character.save();
      }

      // Unregister from game system
      if (this.registry && this.registry.isRegistered()) {
        await this.registry.unregisterCharacter(this.character);
      }

      // Disconnect event handler
      if (this.eventHandler) {
        await this.eventHandler.disconnect();
      }

      // Stop API server
      if (this.api) {
        await this.api.stop();
      }

      this.logger.info('Character container stopped successfully');

    } catch (error) {
      this.logger.error('Error during character container shutdown', {
        error: error.message
      });
    }
  }

  // Get container status
  getStatus() {
    return {
      isRunning: this.isRunning,
      characterId: this.character?.characterId,
      character: this.character ? this.character.getCharacterInfo() : null,
      api: this.api ? this.api.getServerInfo() : null,
      connection: this.eventHandler ? this.eventHandler.getConnectionStatus() : null,
      registration: this.registry ? this.registry.getSessionInfo() : null,
      aiEnabled: this.character?.aiEnabled || false,
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };
  }

  // Handle process signals
  setupSignalHandlers() {
    process.on('SIGINT', async () => {
      this.logger.info('Received SIGINT, shutting down gracefully...');
      await this.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      this.logger.info('Received SIGTERM, shutting down gracefully...');
      await this.stop();
      process.exit(0);
    });

    process.on('uncaughtException', (error) => {
      this.logger.error('Uncaught exception', {
        error: error.message,
        stack: error.stack
      });
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('Unhandled rejection', {
        reason: reason,
        promise: promise
      });
    });
  }
}

// Main entry point
async function main() {
  const container = new CharacterContainer();
  container.setupSignalHandlers();

  try {
    await container.start();
    
    // Keep the process running
    process.stdin.resume();
    
  } catch (error) {
    console.error('Failed to start character container:', error.message);
    process.exit(1);
  }
}

// Run if this is the main module
if (require.main === module) {
  main();
}

module.exports = CharacterContainer;