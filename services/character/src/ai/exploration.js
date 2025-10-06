const winston = require('winston');

// Exploration AI for dungeon crawling and investigation
class ExplorationAI {
  constructor(config = {}) {
    this.config = {
      curiosity: config.curiosity || 0.7, // 0 = stick to mission, 1 = explore everything
      caution: config.caution || 0.5, // 0 = reckless, 1 = very careful
      thoroughness: config.thoroughness || 0.6, // 0 = quick, 1 = search everything
      leadership: config.leadership || 0.3, // 0 = follower, 1 = takes initiative
      secretFinding: config.secretFinding || 0.5, // 0 = obvious only, 1 = find hidden things
      trapAwareness: config.trapAwareness || 0.7, // 0 = ignore traps, 1 = paranoid about traps
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
        new winston.transports.File({ filename: './data/exploration-ai.log' })
      ]
    });

    // Exploration memory - remember where we've been and what we've found
    this.memory = {
      visitedRooms: new Set(),
      foundSecrets: [],
      knownTraps: [],
      interestingLocations: [],
      unexaminedAreas: [],
      currentObjective: null,
      explorationPlan: []
    };
  }

  // Main exploration decision method
  async decideExplorationAction(character, gameState, availableActions) {
    const characterState = character.getCharacterSheet();
    
    this.logger.info('Exploration AI making decision', {
      characterId: character.characterId,
      position: characterState.position,
      health: characterState.health.current,
      availableActions: availableActions?.length || 0
    });

    try {
      // Update our memory with current game state
      this.updateMemory(characterState, gameState);

      // Analyze the current exploration situation
      const situation = this.analyzeExplorationSituation(characterState, gameState);
      
      // Generate possible exploration actions
      const possibleActions = this.generateExplorationActions(characterState, gameState, availableActions);
      
      // Evaluate and score each action
      const scoredActions = possibleActions.map(action => ({
        ...action,
        score: this.scoreExplorationAction(action, situation, characterState)
      }));

      // Sort by score and select the best action
      scoredActions.sort((a, b) => b.score - a.score);
      
      const selectedAction = scoredActions[0];

      this.logger.info('Exploration action selected', {
        characterId: character.characterId,
        action: selectedAction?.type,
        score: selectedAction?.score,
        totalOptions: scoredActions.length
      });

      return selectedAction || this.getDefaultExplorationAction();

    } catch (error) {
      this.logger.error('Exploration AI decision failed', {
        characterId: character.characterId,
        error: error.message
      });
      
      return this.getDefaultExplorationAction();
    }
  }

  // Update exploration memory with current information
  updateMemory(characterState, gameState) {
    const currentRoom = this.getCurrentRoomId(characterState.position);
    
    // Mark current room as visited
    this.memory.visitedRooms.add(currentRoom);

    // Update unexamined areas based on game state
    if (gameState?.exploration?.visibleAreas) {
      gameState.exploration.visibleAreas.forEach(area => {
        if (!this.memory.visitedRooms.has(area.id) && !area.examined) {
          this.memory.unexaminedAreas.push(area);
        }
      });
    }

    // Record any new discoveries
    if (gameState?.exploration?.discoveries) {
      gameState.exploration.discoveries.forEach(discovery => {
        if (discovery.type === 'secret') {
          this.memory.foundSecrets.push(discovery);
        } else if (discovery.type === 'trap') {
          this.memory.knownTraps.push(discovery);
        } else {
          this.memory.interestingLocations.push(discovery);
        }
      });
    }
  }

  // Analyze current exploration situation
  analyzeExplorationSituation(characterState, gameState) {
    const situation = {
      currentRoom: this.getCurrentRoomId(characterState.position),
      healthPercentage: characterState.health.current / characterState.health.maximum,
      isInjured: characterState.health.current < characterState.health.maximum,
      hasUnexploredAreas: this.memory.unexaminedAreas.length > 0,
      hasObjective: this.memory.currentObjective !== null,
      inDanger: this.detectDanger(characterState, gameState),
      canRest: this.canSafelyRest(characterState, gameState),
      lightLevel: gameState?.exploration?.lightLevel || 'normal',
      visibilityReduced: gameState?.exploration?.lightLevel === 'dim' || gameState?.exploration?.lightLevel === 'dark',
      timeSpentExploring: this.memory.visitedRooms.size,
      potentialSecrets: this.identifyPotentialSecrets(gameState),
      potentialTraps: this.identifyPotentialTraps(gameState)
    };

    return situation;
  }

  // Generate possible exploration actions
  generateExplorationActions(characterState, gameState, availableActions) {
    const actions = [];

    // Movement actions
    const movementOptions = this.generateMovementOptions(characterState, gameState);
    actions.push(...movementOptions);

    // Search actions
    if (this.shouldSearch(characterState, gameState)) {
      actions.push({
        type: 'exploration.search',
        area: 'current_room',
        searchType: 'general',
        thorough: this.config.thoroughness > 0.6
      });

      // Search for secrets if character is inclined
      if (this.config.secretFinding > 0.4) {
        actions.push({
          type: 'exploration.search',
          area: 'current_room',
          searchType: 'secrets',
          thorough: this.config.thoroughness > 0.5
        });
      }

      // Search for traps if cautious
      if (this.config.trapAwareness > 0.5) {
        actions.push({
          type: 'exploration.search',
          area: 'ahead',
          searchType: 'traps',
          thorough: this.config.caution > 0.6
        });
      }
    }

    // Investigation actions
    if (gameState?.exploration?.interactableObjects) {
      gameState.exploration.interactableObjects.forEach(obj => {
        actions.push({
          type: 'exploration.investigate',
          target: obj.id,
          object: obj,
          approach: this.config.caution > 0.6 ? 'careful' : 'normal'
        });
      });
    }

    // Rest action if needed and safe
    if (this.shouldRest(characterState, gameState)) {
      actions.push({
        type: 'exploration.rest',
        duration: characterState.health.current < characterState.health.maximum * 0.5 ? 'long' : 'short',
        keepWatch: this.config.caution > 0.4
      });
    }

    // Use items for exploration
    const itemActions = this.generateExplorationItemActions(characterState);
    actions.push(...itemActions);

    return actions;
  }

  // Generate movement options for exploration
  generateMovementOptions(characterState, gameState) {
    const movements = [];
    const availableDirections = this.getAvailableDirections(characterState, gameState);

    availableDirections.forEach(direction => {
      const destination = this.getDestinationInfo(characterState.position, direction, gameState);
      
      movements.push({
        type: 'exploration.move',
        direction,
        distance: 1,
        cautious: this.config.caution > 0.5,
        destination,
        isExplored: destination ? this.memory.visitedRooms.has(destination.id) : false
      });
    });

    return movements;
  }

  // Generate item usage actions for exploration
  generateExplorationItemActions(characterState) {
    const actions = [];

    if (characterState.inventory.items) {
      characterState.inventory.items.forEach(item => {
        if (this.isExplorationItem(item)) {
          actions.push({
            type: 'inventory.use_item',
            itemId: item.id,
            item,
            purpose: 'exploration',
            target: this.selectExplorationItemTarget(item, characterState)
          });
        }
      });
    }

    return actions;
  }

  // Score exploration actions
  scoreExplorationAction(action, situation, characterState) {
    let score = 0;

    switch (action.type) {
      case 'exploration.move':
        score = this.scoreMovementAction(action, situation, characterState);
        break;
      case 'exploration.search':
        score = this.scoreSearchAction(action, situation, characterState);
        break;
      case 'exploration.investigate':
        score = this.scoreInvestigateAction(action, situation, characterState);
        break;
      case 'exploration.rest':
        score = this.scoreRestAction(action, situation, characterState);
        break;
      case 'inventory.use_item':
        score = this.scoreExplorationItemAction(action, situation, characterState);
        break;
      default:
        score = 10; // Base score for unknown actions
    }

    // Apply randomness for more natural behavior
    const randomFactor = 0.15; // 15% randomness
    score *= (1 + (Math.random() - 0.5) * randomFactor);

    return Math.max(0, score);
  }

  // Score movement actions
  scoreMovementAction(action, situation, characterState) {
    let score = 50; // Base movement score

    // Strongly prefer unexplored areas
    if (!action.isExplored) {
      score *= 1.8;
      score += this.config.curiosity * 20;
    } else {
      score *= 0.6; // Reduce score for re-visiting areas
    }

    // Avoid dangerous areas if cautious
    if (this.config.caution > 0.5 && this.isDangerousDirection(action.direction, characterState)) {
      score *= 0.5;
    }

    // Prefer movement towards objectives
    if (this.memory.currentObjective && this.isTowardObjective(action.direction, characterState)) {
      score *= 1.4;
    }

    // Reduce movement score if injured and not cautious
    if (situation.isInjured && this.config.caution < 0.3) {
      score *= 0.7;
    }

    // Leadership personalities prefer taking initiative
    if (this.config.leadership > 0.6) {
      score *= 1.2;
    }

    return score;
  }

  // Score search actions
  scoreSearchAction(action, situation, characterState) {
    let score = 40; // Base search score

    // Adjust for thoroughness
    score *= (0.5 + this.config.thoroughness);

    // Secret searching is influenced by secret-finding preference
    if (action.searchType === 'secrets') {
      score *= (0.3 + this.config.secretFinding * 1.4);
    }

    // Trap searching is influenced by caution
    if (action.searchType === 'traps') {
      score *= (0.2 + this.config.trapAwareness * 1.6);
    }

    // Don't search the same area repeatedly unless very thorough
    const currentRoom = this.getCurrentRoomId(characterState.position);
    if (this.hasSearchedRoom(currentRoom) && this.config.thoroughness < 0.8) {
      score *= 0.3;
    }

    // Higher score in rooms with potential secrets
    if (situation.potentialSecrets.length > 0) {
      score *= 1.5;
    }

    // Higher score when light level is good
    if (situation.lightLevel === 'bright') {
      score *= 1.2;
    } else if (situation.lightLevel === 'dim') {
      score *= 0.8;
    } else if (situation.lightLevel === 'dark') {
      score *= 0.5;
    }

    return score;
  }

  // Score investigation actions
  scoreInvestigateAction(action, situation, characterState) {
    let score = 60; // Base investigation score

    // Adjust for curiosity
    score *= (0.4 + this.config.curiosity * 1.2);

    // Higher score for obviously interesting objects
    if (action.object.interesting || action.object.magical || action.object.unique) {
      score *= 1.6;
    }

    // Lower score for dangerous-looking objects if cautious
    if (action.object.dangerous && this.config.caution > 0.6) {
      score *= 0.6;
    }

    // Higher score if this might advance an objective
    if (this.mightAdvanceObjective(action.object)) {
      score *= 1.8;
    }

    return score;
  }

  // Score rest actions
  scoreRestAction(action, situation, characterState) {
    let score = 20; // Base rest score

    // Strong preference for rest when injured
    if (situation.isInjured) {
      score *= (2 - situation.healthPercentage) * 2;
    }

    // Don't rest if not safe
    if (!situation.canRest) {
      score *= 0.1;
    }

    // Cautious characters rest more often
    score *= (0.7 + this.config.caution * 0.6);

    // Don't rest too frequently
    if (this.recentlyRested()) {
      score *= 0.2;
    }

    return score;
  }

  // Score exploration item usage
  scoreExplorationItemAction(action, situation, characterState) {
    let score = 30; // Base item score

    if (action.item) {
      switch (action.item.type) {
        case 'tool':
          if (action.item.name === 'torch' && situation.visibilityReduced) {
            score *= 2.5; // Torches are valuable in dark areas
          } else if (action.item.name === 'rope' && this.needsClimbing(characterState)) {
            score *= 2;
          } else if (action.item.name === 'thieves_tools' && situation.potentialSecrets.length > 0) {
            score *= 1.8;
          }
          break;
          
        case 'potion':
          if (action.item.subtype === 'healing' && situation.isInjured) {
            score *= 1.5;
          }
          break;
          
        case 'scroll':
          if (action.item.spell === 'detect_magic' || action.item.spell === 'find_traps') {
            score *= (0.5 + this.config.thoroughness);
          }
          break;
      }
    }

    return score;
  }

  // Helper methods
  getCurrentRoomId(position) {
    return `room_${Math.floor(position.x / 10)}_${Math.floor(position.y / 10)}_${position.z}`;
  }

  getAvailableDirections(characterState, gameState) {
    // This would normally be provided by the game state
    // For now, assume basic cardinal directions are available
    const allDirections = ['north', 'south', 'east', 'west'];
    
    // Filter out blocked directions based on game state
    if (gameState?.exploration?.blockedDirections) {
      return allDirections.filter(dir => !gameState.exploration.blockedDirections.includes(dir));
    }
    
    return allDirections;
  }

  getDestinationInfo(currentPosition, direction, gameState) {
    // Calculate destination position
    const newPos = { ...currentPosition };
    switch (direction) {
      case 'north': newPos.y += 1; break;
      case 'south': newPos.y -= 1; break;
      case 'east': newPos.x += 1; break;
      case 'west': newPos.x -= 1; break;
      case 'up': newPos.z += 1; break;
      case 'down': newPos.z -= 1; break;
    }

    return {
      id: this.getCurrentRoomId(newPos),
      position: newPos,
      explored: this.memory.visitedRooms.has(this.getCurrentRoomId(newPos))
    };
  }

  detectDanger(characterState, gameState) {
    return gameState?.exploration?.dangerLevel > 2 || 
           gameState?.exploration?.hostilePresence ||
           characterState.health.current < characterState.health.maximum * 0.3;
  }

  canSafelyRest(characterState, gameState) {
    return !this.detectDanger(characterState, gameState) &&
           gameState?.exploration?.safeToRest !== false;
  }

  shouldSearch(characterState, gameState) {
    const currentRoom = this.getCurrentRoomId(characterState.position);
    return !this.hasSearchedRoom(currentRoom) || 
           this.config.thoroughness > 0.8 ||
           gameState?.exploration?.suggestsSearch;
  }

  shouldRest(characterState, gameState) {
    return characterState.health.current < characterState.health.maximum * 0.7 &&
           this.canSafelyRest(characterState, gameState) &&
           !this.recentlyRested();
  }

  hasSearchedRoom(roomId) {
    // This would track which rooms have been searched
    return this.memory.searchedRooms?.has(roomId) || false;
  }

  recentlyRested() {
    // This would track when the character last rested
    return false; // Simplified for now
  }

  isExplorationItem(item) {
    const explorationItems = ['torch', 'rope', 'thieves_tools', 'compass', 'map'];
    const explorationScrolls = ['detect_magic', 'find_traps', 'light', 'darkvision'];
    
    return explorationItems.includes(item.name) ||
           (item.type === 'scroll' && explorationScrolls.includes(item.spell)) ||
           (item.type === 'potion' && item.subtype === 'healing');
  }

  selectExplorationItemTarget(item, characterState) {
    if (item.name === 'torch' || item.spell === 'light') {
      return 'environment'; // Light up the area
    } else if (item.type === 'potion' && item.subtype === 'healing') {
      return characterState.characterId; // Use on self
    }
    return 'environment';
  }

  isDangerousDirection(direction, characterState) {
    // Check if known traps or dangers exist in that direction
    return this.memory.knownTraps.some(trap => trap.direction === direction);
  }

  isTowardObjective(direction, characterState) {
    // This would calculate if the direction moves toward current objective
    return false; // Simplified for now
  }

  identifyPotentialSecrets(gameState) {
    return gameState?.exploration?.potentialSecrets || [];
  }

  identifyPotentialTraps(gameState) {
    return gameState?.exploration?.potentialTraps || [];
  }

  mightAdvanceObjective(object) {
    // Check if investigating this object might help with current objective
    return object.questRelated || object.storyline || object.magical;
  }

  needsClimbing(characterState) {
    // Check if current situation requires climbing
    return false; // Simplified for now
  }

  getDefaultExplorationAction() {
    return {
      type: 'exploration.search',
      area: 'current_room',
      searchType: 'general',
      description: 'Default search action'
    };
  }
}

module.exports = ExplorationAI;