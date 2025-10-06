const axios = require('axios');
const jwt = require('jsonwebtoken');
const winston = require('winston');

// Character registry client for registering with the main game system
class CharacterRegistry {
  constructor(config = {}) {
    this.config = {
      registryUrl: config.registryUrl || process.env.REGISTRY_URL || 'http://localhost:3008',
      characterEndpoint: config.characterEndpoint || process.env.CHARACTER_ENDPOINT || 'http://localhost:3000',
      retryAttempts: config.retryAttempts || 5,
      retryDelay: config.retryDelay || 2000,
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
        new winston.transports.File({ filename: './data/registry.log' })
      ]
    });

    this.registrationData = null;
    this.authToken = null;
    this.sessionId = null;
  }

  // Register character with the game system
  async registerCharacter(character) {
    const characterInfo = character.getCharacterInfo();
    
    const registrationRequest = {
      characterId: character.characterId,
      name: characterInfo.name,
      class: characterInfo.class,
      level: characterInfo.level,
      containerEndpoint: this.config.characterEndpoint,
      capabilities: this.getCharacterCapabilities(character),
      version: '1.0.0',
      attributes: characterInfo.attributes,
      health: characterInfo.health,
      mana: characterInfo.mana
    };

    this.logger.info('Attempting character registration', {
      characterId: character.characterId,
      registryUrl: this.config.registryUrl
    });

    try {
      const response = await this.makeRegistrationRequest(registrationRequest);
      
      if (response.data.success) {
        this.registrationData = response.data;
        this.authToken = response.data.characterToken;
        this.sessionId = response.data.sessionId;

        // Update character with session information
        character.joinSession(this.sessionId, response.data.gameState, this.authToken);

        this.logger.info('Character registration successful', {
          characterId: character.characterId,
          sessionId: this.sessionId
        });

        return {
          success: true,
          sessionId: this.sessionId,
          token: this.authToken,
          gameState: response.data.gameState
        };
      } else {
        throw new Error(response.data.error || 'Registration failed');
      }
    } catch (error) {
      this.logger.error('Character registration failed', {
        characterId: character.characterId,
        error: error.message
      });
      
      throw error;
    }
  }

  // Make registration request with retry logic
  async makeRegistrationRequest(registrationData, attempt = 1) {
    try {
      const response = await axios.post(
        `${this.config.registryUrl}/api/registry/character`,
        registrationData,
        {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Character-Container/1.0.0'
          },
          timeout: 10000
        }
      );

      return response;
    } catch (error) {
      if (attempt < this.config.retryAttempts) {
        this.logger.warn('Registration attempt failed, retrying', {
          attempt,
          totalAttempts: this.config.retryAttempts,
          error: error.message
        });

        await this.delay(this.config.retryDelay * attempt);
        return this.makeRegistrationRequest(registrationData, attempt + 1);
      }
      
      throw error;
    }
  }

  // Unregister character
  async unregisterCharacter(character) {
    if (!this.authToken || !this.sessionId) {
      this.logger.warn('Cannot unregister - not registered', {
        characterId: character.characterId
      });
      return { success: false, error: 'Not registered' };
    }

    try {
      const response = await axios.delete(
        `${this.config.registryUrl}/api/registry/character/${character.characterId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.authToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 5000
        }
      );

      character.leaveSession();
      this.registrationData = null;
      this.authToken = null;
      this.sessionId = null;

      this.logger.info('Character unregistered successfully', {
        characterId: character.characterId
      });

      return { success: true };
    } catch (error) {
      this.logger.error('Character unregistration failed', {
        characterId: character.characterId,
        error: error.message
      });
      
      return { success: false, error: error.message };
    }
  }

  // Send heartbeat to maintain registration
  async sendHeartbeat(character) {
    if (!this.authToken) {
      return { success: false, error: 'Not registered' };
    }

    try {
      const characterInfo = character.getCharacterInfo();
      
      const response = await axios.post(
        `${this.config.registryUrl}/api/registry/heartbeat`,
        {
          characterId: character.characterId,
          health: characterInfo.health,
          mana: characterInfo.mana,
          position: characterInfo.position,
          status: characterInfo.combat.inCombat ? 'combat' : 'exploring',
          timestamp: new Date().toISOString()
        },
        {
          headers: {
            'Authorization': `Bearer ${this.authToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 5000
        }
      );

      return { success: true, data: response.data };
    } catch (error) {
      this.logger.error('Heartbeat failed', {
        characterId: character.characterId,
        error: error.message
      });
      
      return { success: false, error: error.message };
    }
  }

  // Get current game state
  async getGameState() {
    if (!this.authToken) {
      return { success: false, error: 'Not registered' };
    }

    try {
      const response = await axios.get(
        `${this.config.registryUrl}/api/game/state`,
        {
          headers: {
            'Authorization': `Bearer ${this.authToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 5000
        }
      );

      return { success: true, gameState: response.data };
    } catch (error) {
      this.logger.error('Failed to get game state', {
        error: error.message
      });
      
      return { success: false, error: error.message };
    }
  }

  // Submit character action to game system
  async submitAction(character, action) {
    if (!this.authToken) {
      return { success: false, error: 'Not registered' };
    }

    try {
      const response = await axios.post(
        `${this.config.registryUrl}/api/game/action`,
        {
          characterId: character.characterId,
          sessionId: this.sessionId,
          action: action,
          timestamp: new Date().toISOString()
        },
        {
          headers: {
            'Authorization': `Bearer ${this.authToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      this.logger.info('Action submitted successfully', {
        characterId: character.characterId,
        actionType: action.type,
        success: response.data.success
      });

      return response.data;
    } catch (error) {
      this.logger.error('Action submission failed', {
        characterId: character.characterId,
        actionType: action.type,
        error: error.message
      });
      
      return { success: false, error: error.message };
    }
  }

  // Get character information from registry
  async getCharacterInfo(characterId) {
    if (!this.authToken) {
      return { success: false, error: 'Not registered' };
    }

    try {
      const response = await axios.get(
        `${this.config.registryUrl}/api/registry/character/${characterId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.authToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 5000
        }
      );

      return { success: true, character: response.data };
    } catch (error) {
      this.logger.error('Failed to get character info', {
        characterId,
        error: error.message
      });
      
      return { success: false, error: error.message };
    }
  }

  // Helper methods
  getCharacterCapabilities(character) {
    const capabilities = ['basic'];
    
    // Add capabilities based on character class and abilities
    const characterSheet = character.getCharacterSheet();
    
    if (characterSheet.spells && characterSheet.spells.length > 0) {
      capabilities.push('spellcasting');
    }
    
    if (characterSheet.class === 'rogue' || characterSheet.class === 'ranger') {
      capabilities.push('stealth', 'trapfinding');
    }
    
    if (characterSheet.class === 'cleric' || characterSheet.class === 'paladin') {
      capabilities.push('healing');
    }
    
    if (characterSheet.class === 'bard') {
      capabilities.push('social', 'inspiration');
    }
    
    capabilities.push('combat', 'exploration');
    
    return capabilities;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Validate JWT token
  validateToken(token) {
    try {
      const decoded = jwt.decode(token);
      return decoded && decoded.exp > Date.now() / 1000;
    } catch (error) {
      return false;
    }
  }

  // Get registration status
  isRegistered() {
    return this.authToken !== null && this.sessionId !== null;
  }

  // Get session information
  getSessionInfo() {
    return {
      sessionId: this.sessionId,
      hasToken: this.authToken !== null,
      registrationData: this.registrationData
    };
  }
}

module.exports = CharacterRegistry;