const io = require('socket.io-client');
const redis = require('redis');
const winston = require('winston');

// Event handling system for real-time game communication
class EventHandler {
  constructor(config = {}) {
    this.config = {
      gameServerUrl: config.gameServerUrl || process.env.GAME_SERVER_URL || 'http://localhost:3001',
      redisUrl: config.redisUrl || process.env.REDIS_URL || 'redis://:redispass123@localhost:6379',
      eventChannels: config.eventChannels || ['combat', 'exploration', 'social', 'system'],
      reconnectAttempts: config.reconnectAttempts || 10,
      reconnectDelay: config.reconnectDelay || 2000,
      ...config
    };

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: './data/events.log' })
      ]
    });

    this.character = null;
    this.socket = null;
    this.redisClient = null;
    this.isConnected = false;
    this.eventHandlers = new Map();
    this.reconnectCount = 0;
  }

  // Initialize event system
  async initialize(character, authToken) {
    this.character = character;
    this.authToken = authToken;

    try {
      // Initialize Redis connection for pub/sub
      await this.initializeRedis();
      
      // Initialize WebSocket connection
      await this.initializeWebSocket();

      // Subscribe to event channels
      this.subscribeToEventChannels();

      this.logger.info('Event system initialized', {
        characterId: character.characterId,
        connected: this.isConnected
      });

      return { success: true };
    } catch (error) {
      this.logger.error('Failed to initialize event system', {
        characterId: character.characterId,
        error: error.message
      });
      
      return { success: false, error: error.message };
    }
  }

  // Initialize Redis connection
  async initializeRedis() {
    try {
      this.redisClient = redis.createClient({
        url: this.config.redisUrl
      });

      this.redisClient.on('error', (error) => {
        this.logger.error('Redis client error', { error: error.message });
      });

      this.redisClient.on('connect', () => {
        this.logger.info('Redis client connected');
      });

      this.redisClient.on('disconnect', () => {
        this.logger.warn('Redis client disconnected');
      });

      await this.redisClient.connect();
    } catch (error) {
      this.logger.error('Failed to initialize Redis', { error: error.message });
      throw error;
    }
  }

  // Initialize WebSocket connection
  async initializeWebSocket() {
    return new Promise((resolve, reject) => {
      try {
        this.socket = io(this.config.gameServerUrl, {
          auth: {
            token: this.authToken,
            characterId: this.character.characterId
          },
          reconnection: true,
          reconnectionAttempts: this.config.reconnectAttempts,
          reconnectionDelay: this.config.reconnectDelay
        });

        this.socket.on('connect', () => {
          this.isConnected = true;
          this.reconnectCount = 0;
          this.logger.info('WebSocket connected', {
            characterId: this.character.characterId
          });
          resolve();
        });

        this.socket.on('disconnect', (reason) => {
          this.isConnected = false;
          this.logger.warn('WebSocket disconnected', {
            characterId: this.character.characterId,
            reason
          });
        });

        this.socket.on('connect_error', (error) => {
          this.logger.error('WebSocket connection error', {
            characterId: this.character.characterId,
            error: error.message
          });
          
          if (this.reconnectCount >= this.config.reconnectAttempts) {
            reject(new Error('WebSocket connection failed'));
          }
          this.reconnectCount++;
        });

        // Handle incoming game events
        this.socket.on('game_event', async (eventData) => {
          await this.handleGameEvent(eventData);
        });

        // Handle combat events
        this.socket.on('combat_event', async (eventData) => {
          await this.handleCombatEvent(eventData);
        });

        // Handle exploration events
        this.socket.on('exploration_event', async (eventData) => {
          await this.handleExplorationEvent(eventData);
        });

        // Handle social events
        this.socket.on('social_event', async (eventData) => {
          await this.handleSocialEvent(eventData);
        });

        // Handle system events
        this.socket.on('system_event', async (eventData) => {
          await this.handleSystemEvent(eventData);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  // Subscribe to Redis event channels
  subscribeToEventChannels() {
    this.config.eventChannels.forEach(channel => {
      const channelName = `game:${channel}`;
      
      this.redisClient.subscribe(channelName, (message) => {
        try {
          const eventData = JSON.parse(message);
          this.handleRedisEvent(channel, eventData);
        } catch (error) {
          this.logger.error('Failed to parse Redis event', {
            channel: channelName,
            error: error.message
          });
        }
      });

      this.logger.info('Subscribed to event channel', {
        characterId: this.character.characterId,
        channel: channelName
      });
    });
  }

  // Handle game events from WebSocket
  async handleGameEvent(eventData) {
    this.logger.info('Game event received', {
      characterId: this.character.characterId,
      eventType: eventData.type,
      timestamp: eventData.timestamp
    });

    try {
      // Pass event to character for processing
      const response = await this.character.onGameEvent(eventData.type, eventData);
      
      // Send acknowledgment if required
      if (eventData.requiresAck) {
        this.socket.emit('event_ack', {
          eventId: eventData.id,
          characterId: this.character.characterId,
          response: response,
          timestamp: new Date().toISOString()
        });
      }

      // Handle automatic responses based on event type
      await this.processEventResponse(eventData, response);

    } catch (error) {
      this.logger.error('Failed to handle game event', {
        characterId: this.character.characterId,
        eventType: eventData.type,
        error: error.message
      });
    }
  }

  // Handle combat-specific events
  async handleCombatEvent(eventData) {
    this.logger.info('Combat event received', {
      characterId: this.character.characterId,
      eventType: eventData.type
    });

    try {
      let response = null;

      switch (eventData.type) {
        case 'combat_start':
          response = await this.character.onCombatStart(eventData);
          break;
        case 'combat_turn':
          response = await this.character.onCombatTurn(eventData);
          // If character has AI enabled, automatically decide action
          if (response && response.action && this.character.aiEnabled) {
            await this.submitAutoAction(response.action);
          }
          break;
        case 'combat_end':
          response = await this.character.onCombatEnd(eventData);
          break;
        case 'damage_taken':
          this.character.takeDamage(eventData.amount, eventData.damageType, eventData.source);
          break;
        case 'healing_received':
          this.character.heal(eventData.amount, eventData.source);
          break;
      }

      // Send response if needed
      if (response && eventData.requiresResponse) {
        this.socket.emit('combat_response', {
          eventId: eventData.id,
          characterId: this.character.characterId,
          response: response,
          timestamp: new Date().toISOString()
        });
      }

    } catch (error) {
      this.logger.error('Failed to handle combat event', {
        characterId: this.character.characterId,
        eventType: eventData.type,
        error: error.message
      });
    }
  }

  // Handle exploration events
  async handleExplorationEvent(eventData) {
    this.logger.info('Exploration event received', {
      characterId: this.character.characterId,
      eventType: eventData.type
    });

    try {
      const response = await this.character.onGameEvent(`exploration.${eventData.type}`, eventData);

      if (response && eventData.requiresResponse) {
        this.socket.emit('exploration_response', {
          eventId: eventData.id,
          characterId: this.character.characterId,
          response: response,
          timestamp: new Date().toISOString()
        });
      }

    } catch (error) {
      this.logger.error('Failed to handle exploration event', {
        characterId: this.character.characterId,
        eventType: eventData.type,
        error: error.message
      });
    }
  }

  // Handle social events
  async handleSocialEvent(eventData) {
    this.logger.info('Social event received', {
      characterId: this.character.characterId,
      eventType: eventData.type
    });

    try {
      const response = await this.character.onGameEvent(`social.${eventData.type}`, eventData);

      if (response && eventData.requiresResponse) {
        this.socket.emit('social_response', {
          eventId: eventData.id,
          characterId: this.character.characterId,
          response: response,
          timestamp: new Date().toISOString()
        });
      }

    } catch (error) {
      this.logger.error('Failed to handle social event', {
        characterId: this.character.characterId,
        eventType: eventData.type,
        error: error.message
      });
    }
  }

  // Handle system events
  async handleSystemEvent(eventData) {
    this.logger.info('System event received', {
      characterId: this.character.characterId,
      eventType: eventData.type
    });

    try {
      switch (eventData.type) {
        case 'game_state_update':
          await this.character.onGameStateUpdate(eventData);
          break;
        case 'session_end':
          await this.handleSessionEnd(eventData);
          break;
        case 'character_update':
          await this.handleCharacterUpdate(eventData);
          break;
        case 'system_message':
          this.logger.info('System message', {
            characterId: this.character.characterId,
            message: eventData.message
          });
          break;
      }

    } catch (error) {
      this.logger.error('Failed to handle system event', {
        characterId: this.character.characterId,
        eventType: eventData.type,
        error: error.message
      });
    }
  }

  // Handle Redis pub/sub events
  async handleRedisEvent(channel, eventData) {
    this.logger.info('Redis event received', {
      characterId: this.character.characterId,
      channel,
      eventType: eventData.type
    });

    // Process Redis events similar to WebSocket events
    await this.handleGameEvent(eventData);
  }

  // Send event to game system
  async sendEvent(eventType, eventData) {
    if (!this.isConnected) {
      this.logger.warn('Cannot send event - not connected', {
        characterId: this.character.characterId,
        eventType
      });
      return { success: false, error: 'Not connected' };
    }

    try {
      const event = {
        type: eventType,
        characterId: this.character.characterId,
        data: eventData,
        timestamp: new Date().toISOString()
      };

      this.socket.emit('character_event', event);

      this.logger.info('Event sent', {
        characterId: this.character.characterId,
        eventType
      });

      return { success: true };
    } catch (error) {
      this.logger.error('Failed to send event', {
        characterId: this.character.characterId,
        eventType,
        error: error.message
      });
      
      return { success: false, error: error.message };
    }
  }

  // Publish event to Redis
  async publishEvent(channel, eventData) {
    try {
      const channelName = `game:${channel}`;
      await this.redisClient.publish(channelName, JSON.stringify(eventData));
      
      this.logger.info('Event published to Redis', {
        characterId: this.character.characterId,
        channel: channelName
      });
      
      return { success: true };
    } catch (error) {
      this.logger.error('Failed to publish event to Redis', {
        characterId: this.character.characterId,
        channel,
        error: error.message
      });
      
      return { success: false, error: error.message };
    }
  }

  // Submit automatic action (for AI characters)
  async submitAutoAction(action) {
    this.logger.info('Submitting automatic action', {
      characterId: this.character.characterId,
      actionType: action.type
    });

    return this.sendEvent('character_action', action);
  }

  // Process event response and take appropriate actions
  async processEventResponse(eventData, response) {
    // This method can be customized to handle specific response patterns
    if (response && response.action) {
      await this.sendEvent('character_action', response.action);
    }
  }

  // Handle session end
  async handleSessionEnd(eventData) {
    this.logger.info('Session ending', {
      characterId: this.character.characterId,
      reason: eventData.reason
    });

    this.character.leaveSession();
    await this.disconnect();
  }

  // Handle character updates
  async handleCharacterUpdate(eventData) {
    // Update character state based on server updates
    if (eventData.health !== undefined) {
      this.character.state.updateState({
        health: eventData.health
      });
    }

    if (eventData.position !== undefined) {
      this.character.state.updateState({
        position: eventData.position
      });
    }
  }

  // Register custom event handler
  registerEventHandler(eventType, handler) {
    this.eventHandlers.set(eventType, handler);
    this.logger.info('Custom event handler registered', {
      characterId: this.character.characterId,
      eventType
    });
  }

  // Unregister event handler
  unregisterEventHandler(eventType) {
    this.eventHandlers.delete(eventType);
    this.logger.info('Event handler unregistered', {
      characterId: this.character.characterId,
      eventType
    });
  }

  // Disconnect from event system
  async disconnect() {
    try {
      if (this.socket) {
        this.socket.disconnect();
        this.socket = null;
      }

      if (this.redisClient) {
        await this.redisClient.quit();
        this.redisClient = null;
      }

      this.isConnected = false;

      this.logger.info('Event system disconnected', {
        characterId: this.character?.characterId
      });

    } catch (error) {
      this.logger.error('Error during disconnect', {
        characterId: this.character?.characterId,
        error: error.message
      });
    }
  }

  // Get connection status
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      hasSocket: this.socket !== null,
      hasRedis: this.redisClient !== null,
      reconnectCount: this.reconnectCount
    };
  }
}

module.exports = EventHandler;