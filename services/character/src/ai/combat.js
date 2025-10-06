const winston = require('winston');

// Combat AI decision-making engine
class CombatAI {
  constructor(config = {}) {
    this.config = {
      aggressiveness: config.aggressiveness || 0.5, // 0 = defensive, 1 = very aggressive
      tactical: config.tactical || 0.5, // 0 = simple, 1 = complex tactics
      riskTolerance: config.riskTolerance || 0.5, // 0 = cautious, 1 = reckless
      teamwork: config.teamwork || 0.7, // 0 = solo, 1 = strong team focus
      spellcasting: config.spellcasting || 0.5, // 0 = avoid spells, 1 = prefer spells
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
        new winston.transports.File({ filename: './data/combat-ai.log' })
      ]
    });
  }

  // Main combat decision method
  async decideCombatAction(character, gameState, availableActions) {
    const characterState = character.getCharacterSheet();
    
    this.logger.info('Combat AI making decision', {
      characterId: character.characterId,
      health: characterState.health,
      mana: characterState.mana,
      availableActions: availableActions?.length || 0
    });

    try {
      // Analyze the combat situation
      const situation = this.analyzeCombatSituation(characterState, gameState);
      
      // Generate possible actions
      const possibleActions = this.generatePossibleActions(characterState, gameState, availableActions);
      
      // Evaluate and score each action
      const scoredActions = possibleActions.map(action => ({
        ...action,
        score: this.scoreAction(action, situation, characterState)
      }));

      // Sort by score and select the best action
      scoredActions.sort((a, b) => b.score - a.score);
      
      const selectedAction = scoredActions[0];

      this.logger.info('Combat action selected', {
        characterId: character.characterId,
        action: selectedAction?.type,
        score: selectedAction?.score,
        totalOptions: scoredActions.length
      });

      return selectedAction || this.getDefaultAction(characterState);

    } catch (error) {
      this.logger.error('Combat AI decision failed', {
        characterId: character.characterId,
        error: error.message
      });
      
      return this.getDefaultAction(characterState);
    }
  }

  // Analyze the current combat situation
  analyzeCombatSituation(characterState, gameState) {
    const situation = {
      healthPercentage: characterState.health.current / characterState.health.maximum,
      manaPercentage: characterState.mana.maximum > 0 ? 
        characterState.mana.current / characterState.mana.maximum : 0,
      inDanger: characterState.health.current <= characterState.health.maximum * 0.3,
      lowResources: characterState.mana.current <= characterState.mana.maximum * 0.2,
      enemyCount: 0,
      allyCount: 0,
      strongestEnemy: null,
      weakestEnemy: null,
      nearestEnemy: null,
      tacticalAdvantage: false
    };

    // Analyze enemies and allies from game state
    if (gameState && gameState.combat) {
      situation.enemyCount = gameState.combat.enemies?.length || 0;
      situation.allyCount = gameState.combat.allies?.length || 0;
      
      if (gameState.combat.enemies?.length > 0) {
        // Find strongest, weakest, and nearest enemies
        situation.strongestEnemy = gameState.combat.enemies.reduce((strongest, enemy) => 
          enemy.health > strongest.health ? enemy : strongest
        );
        
        situation.weakestEnemy = gameState.combat.enemies.reduce((weakest, enemy) =>
          enemy.health < weakest.health ? enemy : weakest
        );
        
        // Simple distance calculation (assuming position data)
        if (characterState.position && gameState.combat.enemies[0].position) {
          situation.nearestEnemy = gameState.combat.enemies.reduce((nearest, enemy) => {
            const currentDistance = this.calculateDistance(characterState.position, nearest.position);
            const enemyDistance = this.calculateDistance(characterState.position, enemy.position);
            return enemyDistance < currentDistance ? enemy : nearest;
          });
        }
      }

      // Determine tactical advantage
      situation.tacticalAdvantage = situation.allyCount > situation.enemyCount ||
        (characterState.position && this.hasPositionalAdvantage(characterState.position, gameState));
    }

    return situation;
  }

  // Generate possible combat actions
  generatePossibleActions(characterState, gameState, availableActions) {
    const actions = [];

    // Basic attack actions
    if (this.canAttack(characterState, gameState)) {
      actions.push({
        type: 'combat.attack',
        subtype: 'melee',
        target: this.selectAttackTarget(characterState, gameState),
        weapon: characterState.inventory.equipment.weapon
      });

      // Ranged attack if available
      if (this.hasRangedWeapon(characterState)) {
        actions.push({
          type: 'combat.attack',
          subtype: 'ranged',
          target: this.selectAttackTarget(characterState, gameState),
          weapon: this.getRangedWeapon(characterState)
        });
      }
    }

    // Defensive actions
    actions.push({
      type: 'combat.defend',
      subtype: 'full_defense',
      description: 'Focus entirely on defense'
    });

    // Spell actions
    if (characterState.spells && characterState.spells.length > 0) {
      characterState.spells.forEach(spell => {
        if (this.canCastSpell(spell, characterState)) {
          actions.push({
            type: 'combat.cast_spell',
            spellName: spell.name,
            spellLevel: spell.level,
            target: this.selectSpellTarget(spell, characterState, gameState),
            manaCost: spell.level * 2
          });
        }
      });
    }

    // Item usage actions
    if (characterState.inventory.items) {
      characterState.inventory.items.forEach(item => {
        if (this.canUseItemInCombat(item)) {
          actions.push({
            type: 'inventory.use_item',
            itemId: item.id,
            item: item,
            target: this.selectItemTarget(item, characterState)
          });
        }
      });
    }

    // Movement actions
    if (this.shouldConsiderMovement(characterState, gameState)) {
      const movements = this.generateMovementOptions(characterState, gameState);
      actions.push(...movements);
    }

    return actions;
  }

  // Score an action based on situation and AI personality
  scoreAction(action, situation, characterState) {
    let score = 0;

    switch (action.type) {
      case 'combat.attack':
        score = this.scoreAttackAction(action, situation, characterState);
        break;
      case 'combat.defend':
        score = this.scoreDefenseAction(action, situation, characterState);
        break;
      case 'combat.cast_spell':
        score = this.scoreSpellAction(action, situation, characterState);
        break;
      case 'inventory.use_item':
        score = this.scoreItemAction(action, situation, characterState);
        break;
      case 'exploration.move':
        score = this.scoreMovementAction(action, situation, characterState);
        break;
      default:
        score = 1; // Base score for unknown actions
    }

    // Apply randomness to prevent completely predictable behavior
    const randomFactor = 0.1; // 10% randomness
    score *= (1 + (Math.random() - 0.5) * randomFactor);

    return Math.max(0, score);
  }

  // Score attack actions
  scoreAttackAction(action, situation, characterState) {
    let score = 50; // Base attack score

    // Adjust for aggressiveness
    score *= (0.5 + this.config.aggressiveness);

    // Prefer attacks when healthy
    score *= situation.healthPercentage;

    // Target selection affects score
    if (action.target) {
      // Prefer weaker enemies if tactical
      if (this.config.tactical > 0.5 && situation.weakestEnemy && 
          action.target.id === situation.weakestEnemy.id) {
        score *= 1.3;
      }
      
      // Prefer strongest enemy if aggressive
      if (this.config.aggressiveness > 0.7 && situation.strongestEnemy &&
          action.target.id === situation.strongestEnemy.id) {
        score *= 1.2;
      }
    }

    // Ranged attacks are better when outnumbered
    if (action.subtype === 'ranged' && situation.enemyCount > situation.allyCount) {
      score *= 1.2;
    }

    // Penalize if in danger and being reckless
    if (situation.inDanger && this.config.riskTolerance < 0.5) {
      score *= 0.7;
    }

    return score;
  }

  // Score defense actions
  scoreDefenseAction(action, situation, characterState) {
    let score = 30; // Base defense score

    // Strongly prefer defense when in danger
    if (situation.inDanger) {
      score *= 2.5;
    }

    // Prefer defense when outnumbered
    if (situation.enemyCount > situation.allyCount) {
      score *= 1.5;
    }

    // Adjust for risk tolerance (cautious characters defend more)
    score *= (2 - this.config.riskTolerance);

    // Lower score when healthy and aggressive
    if (situation.healthPercentage > 0.8 && this.config.aggressiveness > 0.6) {
      score *= 0.5;
    }

    return score;
  }

  // Score spell actions
  scoreSpellAction(action, situation, characterState) {
    let score = 40; // Base spell score

    // Adjust for spellcasting preference
    score *= (0.5 + this.config.spellcasting);

    // Don't cast if low on mana unless desperate
    if (situation.lowResources && !situation.inDanger) {
      score *= 0.3;
    }

    // Analyze spell type and situation
    const spell = characterState.spells.find(s => s.name === action.spellName);
    if (spell) {
      switch (spell.type) {
        case 'damage':
          // Damage spells are good when aggressive or when many enemies
          score *= (0.7 + this.config.aggressiveness * 0.6);
          if (situation.enemyCount > 2) score *= 1.3;
          break;
          
        case 'healing':
          // Healing spells are critical when in danger
          if (situation.inDanger) {
            score *= 3;
          } else if (situation.healthPercentage > 0.8) {
            score *= 0.2; // Don't heal when healthy
          }
          break;
          
        case 'buff':
          // Buffs are good at start of combat or when tactical
          score *= this.config.tactical;
          if (gameState?.combat?.round <= 2) score *= 1.5;
          break;
          
        case 'debuff':
          // Debuffs are good when tactical and facing strong enemies
          score *= this.config.tactical;
          if (situation.strongestEnemy) score *= 1.2;
          break;
          
        case 'utility':
          // Utility spells depend on situation
          score *= this.config.tactical * 0.8;
          break;
      }
    }

    return score;
  }

  // Score item usage actions
  scoreItemAction(action, situation, characterState) {
    let score = 20; // Base item score

    if (action.item) {
      switch (action.item.type) {
        case 'potion':
          if (action.item.subtype === 'healing' && situation.inDanger) {
            score *= 4; // Healing potions are critical when in danger
          } else if (action.item.subtype === 'mana' && situation.lowResources) {
            score *= 2;
          }
          break;
          
        case 'scroll':
          // Treat scrolls like spells
          score *= (0.5 + this.config.spellcasting);
          break;
          
        case 'tool':
          // Tools are situational
          score *= this.config.tactical;
          break;
      }
    }

    return score;
  }

  // Score movement actions
  scoreMovementAction(action, situation, characterState) {
    let score = 25; // Base movement score

    // Movement is good when in danger (retreating)
    if (situation.inDanger) {
      score *= 1.8;
    }

    // Movement is good for tactical positioning
    score *= this.config.tactical;

    // Prefer movement when outnumbered
    if (situation.enemyCount > situation.allyCount) {
      score *= 1.3;
    }

    return score;
  }

  // Helper methods
  calculateDistance(pos1, pos2) {
    if (!pos1 || !pos2) return Infinity;
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    const dz = (pos1.z || 0) - (pos2.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  hasPositionalAdvantage(position, gameState) {
    // Simple check for high ground or cover
    return position.z > 0 || position.cover === true;
  }

  canAttack(characterState, gameState) {
    return characterState.derivedStats.isAlive && 
           characterState.derivedStats.canAct &&
           (characterState.inventory.equipment.weapon || true); // Can always use fists
  }

  hasRangedWeapon(characterState) {
    const weapon = characterState.inventory.equipment.weapon;
    return weapon && (weapon.type === 'ranged' || weapon.range > 5);
  }

  getRangedWeapon(characterState) {
    return characterState.inventory.equipment.weapon;
  }

  canCastSpell(spell, characterState) {
    const manaCost = spell.level * 2;
    return characterState.mana.current >= manaCost;
  }

  canUseItemInCombat(item) {
    return item.type === 'potion' || item.type === 'scroll' || 
           (item.type === 'tool' && item.combatUsable);
  }

  shouldConsiderMovement(characterState, gameState) {
    // Consider movement if in danger, tactical, or if positioning would help
    return this.config.tactical > 0.3 || characterState.health.current < characterState.health.maximum * 0.5;
  }

  generateMovementOptions(characterState, gameState) {
    const movements = [];
    const directions = ['north', 'south', 'east', 'west'];
    
    directions.forEach(direction => {
      movements.push({
        type: 'exploration.move',
        direction,
        distance: 1,
        cautious: this.config.riskTolerance < 0.5
      });
    });

    return movements;
  }

  selectAttackTarget(characterState, gameState) {
    if (!gameState?.combat?.enemies?.length) return null;
    
    const enemies = gameState.combat.enemies;
    
    // Select target based on AI personality
    if (this.config.tactical > 0.6) {
      // Tactical AI targets weakest enemy
      return enemies.reduce((weakest, enemy) =>
        enemy.health < weakest.health ? enemy : weakest
      );
    } else if (this.config.aggressiveness > 0.7) {
      // Aggressive AI targets strongest enemy
      return enemies.reduce((strongest, enemy) =>
        enemy.health > strongest.health ? enemy : strongest
      );
    } else {
      // Default: target nearest enemy
      return enemies[0]; // Simplified - would calculate actual nearest
    }
  }

  selectSpellTarget(spell, characterState, gameState) {
    if (spell.targetType === 'self') {
      return characterState.characterId;
    } else if (spell.targetType === 'ally') {
      // Target ally with lowest health
      return gameState?.combat?.allies?.[0]?.id || characterState.characterId;
    } else {
      // Target enemy
      return this.selectAttackTarget(characterState, gameState)?.id;
    }
  }

  selectItemTarget(item, characterState) {
    if (item.type === 'potion' && item.subtype === 'healing') {
      return characterState.characterId; // Use on self
    }
    return null;
  }

  getDefaultAction(characterState) {
    // Default to defending if no other action is available
    return {
      type: 'combat.defend',
      subtype: 'full_defense',
      description: 'Default defensive action'
    };
  }
}

module.exports = CombatAI;