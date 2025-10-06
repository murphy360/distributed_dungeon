const winston = require('winston');

// Character state management and persistence
class CharacterState {
  constructor(characterId, config = {}) {
    this.characterId = characterId;
    this.config = config;
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: `./data/${characterId}-character.log` })
      ]
    });

    // Initialize character state
    this.state = {
      characterId: characterId,
      name: config.name || 'Unknown Character',
      class: config.class || 'fighter',
      level: config.level || 1,
      
      // Core attributes
      attributes: {
        strength: config.strength || 10,
        dexterity: config.dexterity || 10,
        constitution: config.constitution || 10,
        intelligence: config.intelligence || 10,
        wisdom: config.wisdom || 10,
        charisma: config.charisma || 10
      },
      
      // Character status
      health: {
        current: config.maxHealth || 20,
        maximum: config.maxHealth || 20,
        temporary: 0
      },
      
      mana: {
        current: config.maxMana || 0,
        maximum: config.maxMana || 0
      },
      
      // Combat state
      combat: {
        initiative: 0,
        inCombat: false,
        turnActive: false,
        armorClass: config.armorClass || 10,
        attackBonus: config.attackBonus || 0
      },
      
      // Position and movement
      position: {
        x: 0,
        y: 0,
        z: 0,
        facing: 'north'
      },
      
      // Inventory and equipment
      inventory: {
        gold: config.startingGold || 100,
        items: [],
        equipment: {
          weapon: null,
          armor: null,
          shield: null,
          accessories: []
        }
      },
      
      // Abilities and spells
      abilities: config.abilities || [],
      spells: config.spells || [],
      
      // Session information
      session: {
        sessionId: null,
        gameState: null,
        lastUpdate: new Date().toISOString(),
        connected: false
      },
      
      // AI behavior settings
      aiSettings: {
        aggressiveness: config.aggressiveness || 0.5,
        caution: config.caution || 0.5,
        exploration: config.exploration || 0.5,
        social: config.social || 0.5,
        automation: {
          combat: config.autoCombat || false,
          exploration: config.autoExploration || false,
          social: config.autoSocial || false
        }
      }
    };
  }

  // Get current character state
  getState() {
    return { ...this.state };
  }

  // Update character state
  updateState(updates) {
    this.state = { ...this.state, ...updates };
    this.state.session.lastUpdate = new Date().toISOString();
    this.saveState();
    this.logger.info('Character state updated', { characterId: this.characterId, updates });
  }

  // Health management
  takeDamage(amount) {
    const oldHealth = this.state.health.current;
    this.state.health.current = Math.max(0, this.state.health.current - amount);
    this.saveState();
    
    this.logger.info('Character took damage', {
      characterId: this.characterId,
      damage: amount,
      oldHealth,
      newHealth: this.state.health.current
    });
    
    return this.state.health.current;
  }

  heal(amount) {
    const oldHealth = this.state.health.current;
    this.state.health.current = Math.min(
      this.state.health.maximum,
      this.state.health.current + amount
    );
    this.saveState();
    
    this.logger.info('Character healed', {
      characterId: this.characterId,
      healing: amount,
      oldHealth,
      newHealth: this.state.health.current
    });
    
    return this.state.health.current;
  }

  // Mana management
  useMana(amount) {
    if (this.state.mana.current >= amount) {
      this.state.mana.current -= amount;
      this.saveState();
      return true;
    }
    return false;
  }

  restoreMana(amount) {
    this.state.mana.current = Math.min(
      this.state.mana.maximum,
      this.state.mana.current + amount
    );
    this.saveState();
  }

  // Position and movement
  move(direction, distance = 1) {
    const oldPosition = { ...this.state.position };
    
    switch (direction.toLowerCase()) {
      case 'north':
        this.state.position.y += distance;
        break;
      case 'south':
        this.state.position.y -= distance;
        break;
      case 'east':
        this.state.position.x += distance;
        break;
      case 'west':
        this.state.position.x -= distance;
        break;
      case 'up':
        this.state.position.z += distance;
        break;
      case 'down':
        this.state.position.z -= distance;
        break;
    }
    
    this.state.position.facing = direction.toLowerCase();
    this.saveState();
    
    this.logger.info('Character moved', {
      characterId: this.characterId,
      direction,
      distance,
      oldPosition,
      newPosition: this.state.position
    });
  }

  // Combat state management
  enterCombat(initiative) {
    this.state.combat.inCombat = true;
    this.state.combat.initiative = initiative;
    this.state.combat.turnActive = false;
    this.saveState();
    
    this.logger.info('Character entered combat', {
      characterId: this.characterId,
      initiative
    });
  }

  exitCombat() {
    this.state.combat.inCombat = false;
    this.state.combat.turnActive = false;
    this.state.combat.initiative = 0;
    this.saveState();
    
    this.logger.info('Character exited combat', {
      characterId: this.characterId
    });
  }

  startTurn() {
    this.state.combat.turnActive = true;
    this.saveState();
  }

  endTurn() {
    this.state.combat.turnActive = false;
    this.saveState();
  }

  // Inventory management
  addItem(item) {
    this.state.inventory.items.push({
      ...item,
      id: require('uuid').v4(),
      dateAcquired: new Date().toISOString()
    });
    this.saveState();
    
    this.logger.info('Item added to inventory', {
      characterId: this.characterId,
      item
    });
  }

  removeItem(itemId) {
    const index = this.state.inventory.items.findIndex(item => item.id === itemId);
    if (index !== -1) {
      const removedItem = this.state.inventory.items.splice(index, 1)[0];
      this.saveState();
      
      this.logger.info('Item removed from inventory', {
        characterId: this.characterId,
        item: removedItem
      });
      
      return removedItem;
    }
    return null;
  }

  // Equipment management
  equipItem(item, slot) {
    if (this.state.inventory.equipment[slot] !== undefined) {
      this.state.inventory.equipment[slot] = item;
      this.saveState();
      
      this.logger.info('Item equipped', {
        characterId: this.characterId,
        item,
        slot
      });
      
      return true;
    }
    return false;
  }

  // Session management
  joinSession(sessionId, gameState) {
    this.state.session.sessionId = sessionId;
    this.state.session.gameState = gameState;
    this.state.session.connected = true;
    this.saveState();
    
    this.logger.info('Character joined session', {
      characterId: this.characterId,
      sessionId
    });
  }

  leaveSession() {
    this.state.session.sessionId = null;
    this.state.session.gameState = null;
    this.state.session.connected = false;
    this.saveState();
    
    this.logger.info('Character left session', {
      characterId: this.characterId
    });
  }

  // State persistence
  saveState() {
    try {
      const fs = require('fs');
      const path = require('path');
      
      const dataDir = './data';
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      const stateFile = path.join(dataDir, `${this.characterId}-state.json`);
      fs.writeFileSync(stateFile, JSON.stringify(this.state, null, 2));
      
      // Also create a backup
      const backupFile = path.join(dataDir, `${this.characterId}-state-backup.json`);
      if (fs.existsSync(stateFile)) {
        fs.copyFileSync(stateFile, backupFile);
      }
    } catch (error) {
      this.logger.error('Failed to save character state', {
        characterId: this.characterId,
        error: error.message
      });
    }
  }

  // Load state from disk
  loadState() {
    try {
      const fs = require('fs');
      const path = require('path');
      
      const stateFile = path.join('./data', `${this.characterId}-state.json`);
      if (fs.existsSync(stateFile)) {
        const savedState = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
        this.state = { ...this.state, ...savedState };
        
        this.logger.info('Character state loaded from disk', {
          characterId: this.characterId
        });
        
        return true;
      }
    } catch (error) {
      this.logger.error('Failed to load character state', {
        characterId: this.characterId,
        error: error.message
      });
    }
    return false;
  }

  // Calculate derived stats
  getArmorClass() {
    let ac = 10; // Base AC
    ac += Math.floor((this.state.attributes.dexterity - 10) / 2); // Dex modifier
    
    // Add armor bonuses
    if (this.state.inventory.equipment.armor) {
      ac += this.state.inventory.equipment.armor.acBonus || 0;
    }
    
    if (this.state.inventory.equipment.shield) {
      ac += this.state.inventory.equipment.shield.acBonus || 0;
    }
    
    return ac;
  }

  getAttackBonus() {
    let bonus = 0;
    
    // Add proficiency bonus based on level
    const proficiencyBonus = Math.ceil(this.state.level / 4) + 1;
    bonus += proficiencyBonus;
    
    // Add ability modifier (usually Strength for melee, Dexterity for ranged)
    bonus += Math.floor((this.state.attributes.strength - 10) / 2);
    
    // Add weapon bonuses
    if (this.state.inventory.equipment.weapon) {
      bonus += this.state.inventory.equipment.weapon.attackBonus || 0;
    }
    
    return bonus;
  }

  // Check if character is alive
  isAlive() {
    return this.state.health.current > 0;
  }

  // Check if character can act
  canAct() {
    return this.isAlive() && this.state.session.connected;
  }
}

module.exports = CharacterState;