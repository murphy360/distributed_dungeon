const CharacterState = require('./state');
const winston = require('winston');

// Base character class with core functionality
class CharacterBase {
  constructor(config = {}) {
    this.config = config;
    this.characterId = config.characterId || require('uuid').v4();
    
    // Initialize logger
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: `./data/${this.characterId}-character-base.log` })
      ]
    });

    // Initialize character state
    this.state = new CharacterState(this.characterId, config);
    
    // Load existing state if available
    this.state.loadState();
    
    this.logger.info('Character initialized', {
      characterId: this.characterId,
      name: this.state.state.name,
      class: this.state.state.class,
      level: this.state.state.level
    });
  }

  // Get character information
  getCharacterInfo() {
    const state = this.state.getState();
    return {
      characterId: this.characterId,
      name: state.name,
      class: state.class,
      level: state.level,
      health: state.health,
      mana: state.mana,
      attributes: state.attributes,
      position: state.position,
      combat: state.combat,
      session: state.session
    };
  }

  // Get detailed character sheet
  getCharacterSheet() {
    const state = this.state.getState();
    return {
      ...state,
      derivedStats: {
        armorClass: this.state.getArmorClass(),
        attackBonus: this.state.getAttackBonus(),
        isAlive: this.state.isAlive(),
        canAct: this.state.canAct()
      }
    };
  }

  // Action processing methods (to be overridden by specific character classes)
  
  async processAction(actionType, actionData) {
    this.logger.info('Processing action', {
      characterId: this.characterId,
      actionType,
      actionData
    });

    try {
      switch (actionType) {
        case 'combat.attack':
          return await this.processCombatAttack(actionData);
        case 'combat.defend':
          return await this.processCombatDefend(actionData);
        case 'combat.cast_spell':
          return await this.processCastSpell(actionData);
        case 'exploration.move':
          return await this.processMove(actionData);
        case 'exploration.search':
          return await this.processSearch(actionData);
        case 'social.speak':
          return await this.processSpeak(actionData);
        case 'inventory.use_item':
          return await this.processUseItem(actionData);
        default:
          return await this.processCustomAction(actionType, actionData);
      }
    } catch (error) {
      this.logger.error('Action processing failed', {
        characterId: this.characterId,
        actionType,
        error: error.message
      });
      
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Combat actions
  async processCombatAttack(actionData) {
    if (!this.state.state.combat.inCombat || !this.state.state.combat.turnActive) {
      throw new Error('Cannot attack - not in combat or not character turn');
    }

    const { target, weapon, attackType = 'melee' } = actionData;
    const attackBonus = this.state.getAttackBonus();
    
    // Roll d20 for attack
    const attackRoll = Math.floor(Math.random() * 20) + 1;
    const totalAttack = attackRoll + attackBonus;
    
    this.logger.info('Attack attempted', {
      characterId: this.characterId,
      target,
      attackRoll,
      attackBonus,
      totalAttack
    });

    return {
      success: true,
      action: 'attack',
      target,
      attackRoll,
      attackBonus,
      totalAttack,
      weapon: weapon || this.state.state.inventory.equipment.weapon,
      timestamp: new Date().toISOString()
    };
  }

  async processCombatDefend(actionData) {
    if (!this.state.state.combat.inCombat) {
      throw new Error('Cannot defend - not in combat');
    }

    // Defensive stance - increase AC for the turn
    const defenseBonus = 2;
    
    this.logger.info('Defensive stance activated', {
      characterId: this.characterId,
      defenseBonus
    });

    return {
      success: true,
      action: 'defend',
      defenseBonus,
      timestamp: new Date().toISOString()
    };
  }

  async processCastSpell(actionData) {
    const { spellName, target, spellLevel = 1 } = actionData;
    
    // Check if character has the spell
    const hasSpell = this.state.state.spells.some(spell => 
      spell.name.toLowerCase() === spellName.toLowerCase()
    );
    
    if (!hasSpell) {
      throw new Error(`Character does not know spell: ${spellName}`);
    }

    // Check mana cost
    const manaCost = spellLevel * 2; // Simple mana calculation
    if (!this.state.useMana(manaCost)) {
      throw new Error('Insufficient mana to cast spell');
    }

    this.logger.info('Spell cast', {
      characterId: this.characterId,
      spellName,
      target,
      spellLevel,
      manaCost
    });

    return {
      success: true,
      action: 'cast_spell',
      spellName,
      target,
      spellLevel,
      manaCost,
      timestamp: new Date().toISOString()
    };
  }

  // Exploration actions
  async processMove(actionData) {
    const { direction, distance = 1, cautious = false } = actionData;
    
    // Check if movement is allowed
    if (this.state.state.combat.inCombat && this.state.state.combat.turnActive) {
      // In combat, movement might be limited
      if (distance > 6) { // 30 feet in D&D terms
        throw new Error('Cannot move more than 30 feet in combat');
      }
    }

    this.state.move(direction, distance);

    this.logger.info('Character moved', {
      characterId: this.characterId,
      direction,
      distance,
      cautious,
      newPosition: this.state.state.position
    });

    return {
      success: true,
      action: 'move',
      direction,
      distance,
      cautious,
      newPosition: this.state.state.position,
      timestamp: new Date().toISOString()
    };
  }

  async processSearch(actionData) {
    const { area = 'immediate', searchType = 'general' } = actionData;
    
    // Roll perception check
    const perceptionBonus = Math.floor((this.state.state.attributes.wisdom - 10) / 2);
    const perceptionRoll = Math.floor(Math.random() * 20) + 1 + perceptionBonus;

    this.logger.info('Search attempted', {
      characterId: this.characterId,
      area,
      searchType,
      perceptionRoll
    });

    return {
      success: true,
      action: 'search',
      area,
      searchType,
      perceptionRoll,
      timestamp: new Date().toISOString()
    };
  }

  // Social actions
  async processSpeak(actionData) {
    const { message, target = 'party', tone = 'normal' } = actionData;
    
    this.logger.info('Character spoke', {
      characterId: this.characterId,
      target,
      tone,
      messageLength: message.length
    });

    return {
      success: true,
      action: 'speak',
      message,
      target,
      tone,
      speaker: {
        characterId: this.characterId,
        name: this.state.state.name
      },
      timestamp: new Date().toISOString()
    };
  }

  // Inventory actions
  async processUseItem(actionData) {
    const { itemId, target } = actionData;
    
    const item = this.state.state.inventory.items.find(item => item.id === itemId);
    if (!item) {
      throw new Error('Item not found in inventory');
    }

    // Process item usage based on item type
    let result = {};
    
    switch (item.type) {
      case 'potion':
        result = await this.usePotion(item, target);
        break;
      case 'scroll':
        result = await this.useScroll(item, target);
        break;
      case 'tool':
        result = await this.useTool(item, target);
        break;
      default:
        throw new Error(`Cannot use item of type: ${item.type}`);
    }

    this.logger.info('Item used', {
      characterId: this.characterId,
      item: item.name,
      target,
      result
    });

    return {
      success: true,
      action: 'use_item',
      item,
      target,
      result,
      timestamp: new Date().toISOString()
    };
  }

  // Item usage helpers
  async usePotion(potion, target) {
    switch (potion.subtype) {
      case 'healing':
        const healAmount = potion.healAmount || 10;
        this.state.heal(healAmount);
        // Remove potion from inventory after use
        this.state.removeItem(potion.id);
        return { type: 'healing', amount: healAmount };
      
      case 'mana':
        const manaAmount = potion.manaAmount || 10;
        this.state.restoreMana(manaAmount);
        this.state.removeItem(potion.id);
        return { type: 'mana', amount: manaAmount };
      
      default:
        throw new Error(`Unknown potion subtype: ${potion.subtype}`);
    }
  }

  async useScroll(scroll, target) {
    // Scrolls cast spells
    if (scroll.spell) {
      const result = await this.processCastSpell({
        spellName: scroll.spell,
        target,
        spellLevel: scroll.spellLevel || 1
      });
      
      // Remove scroll after use
      this.state.removeItem(scroll.id);
      return result;
    }
    
    throw new Error('Scroll has no spell defined');
  }

  async useTool(tool, target) {
    // Tools provide various utility functions
    return {
      type: 'tool_use',
      tool: tool.name,
      target,
      description: `Used ${tool.name} on ${target}`
    };
  }

  // Custom action processing (to be overridden by specific character implementations)
  async processCustomAction(actionType, actionData) {
    this.logger.warn('Unhandled custom action', {
      characterId: this.characterId,
      actionType,
      actionData
    });

    return {
      success: false,
      error: `Unhandled action type: ${actionType}`,
      timestamp: new Date().toISOString()
    };
  }

  // Event handling methods (to be called by the communication layer)
  
  async onGameEvent(eventType, eventData) {
    this.logger.info('Game event received', {
      characterId: this.characterId,
      eventType,
      eventData
    });

    try {
      switch (eventType) {
        case 'combat.start':
          return await this.onCombatStart(eventData);
        case 'combat.turn':
          return await this.onCombatTurn(eventData);
        case 'combat.end':
          return await this.onCombatEnd(eventData);
        case 'exploration.discovery':
          return await this.onDiscovery(eventData);
        case 'social.interaction':
          return await this.onSocialInteraction(eventData);
        case 'game.state_update':
          return await this.onGameStateUpdate(eventData);
        default:
          return await this.onCustomEvent(eventType, eventData);
      }
    } catch (error) {
      this.logger.error('Event handling failed', {
        characterId: this.characterId,
        eventType,
        error: error.message
      });
    }
  }

  // Event handlers (to be overridden by AI implementations)
  async onCombatStart(eventData) {
    const { initiative } = eventData;
    this.state.enterCombat(initiative);
    
    return {
      acknowledged: true,
      ready: true
    };
  }

  async onCombatTurn(eventData) {
    this.state.startTurn();
    
    // Base implementation - subclasses should override for AI behavior
    return {
      acknowledged: true,
      action: null // No automatic action
    };
  }

  async onCombatEnd(eventData) {
    this.state.exitCombat();
    
    return {
      acknowledged: true
    };
  }

  async onDiscovery(eventData) {
    return {
      acknowledged: true,
      interested: true
    };
  }

  async onSocialInteraction(eventData) {
    return {
      acknowledged: true,
      response: null // No automatic response
    };
  }

  async onGameStateUpdate(eventData) {
    this.state.updateState({
      session: {
        ...this.state.state.session,
        gameState: eventData.gameState
      }
    });
    
    return {
      acknowledged: true
    };
  }

  async onCustomEvent(eventType, eventData) {
    this.logger.warn('Unhandled custom event', {
      characterId: this.characterId,
      eventType,
      eventData
    });
    
    return {
      acknowledged: false,
      error: `Unhandled event type: ${eventType}`
    };
  }

  // Health and status methods
  takeDamage(amount, damageType = 'physical', source = 'unknown') {
    const newHealth = this.state.takeDamage(amount);
    
    this.logger.info('Character took damage', {
      characterId: this.characterId,
      amount,
      damageType,
      source,
      newHealth,
      isAlive: this.state.isAlive()
    });

    return {
      newHealth,
      isAlive: this.state.isAlive(),
      damageType,
      source
    };
  }

  heal(amount, source = 'unknown') {
    const newHealth = this.state.heal(amount);
    
    this.logger.info('Character healed', {
      characterId: this.characterId,
      amount,
      source,
      newHealth
    });

    return {
      newHealth,
      source
    };
  }

  // Session management
  joinSession(sessionId, gameState, token) {
    this.state.joinSession(sessionId, gameState);
    
    this.logger.info('Character joined game session', {
      characterId: this.characterId,
      sessionId
    });

    return {
      success: true,
      characterInfo: this.getCharacterInfo()
    };
  }

  leaveSession() {
    const sessionId = this.state.state.session.sessionId;
    this.state.leaveSession();
    
    this.logger.info('Character left game session', {
      characterId: this.characterId,
      sessionId
    });

    return {
      success: true,
      sessionId
    };
  }

  // Utility methods
  rollDice(sides = 20, count = 1, modifier = 0) {
    let total = 0;
    const rolls = [];
    
    for (let i = 0; i < count; i++) {
      const roll = Math.floor(Math.random() * sides) + 1;
      rolls.push(roll);
      total += roll;
    }
    
    total += modifier;
    
    return {
      total,
      rolls,
      modifier,
      dice: `${count}d${sides}${modifier !== 0 ? (modifier > 0 ? '+' : '') + modifier : ''}`
    };
  }

  getAbilityModifier(abilityScore) {
    return Math.floor((abilityScore - 10) / 2);
  }

  // Save the character (called periodically)
  save() {
    this.state.saveState();
    this.logger.info('Character state saved', {
      characterId: this.characterId
    });
  }
}

module.exports = CharacterBase;