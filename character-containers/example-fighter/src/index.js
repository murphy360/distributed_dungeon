// Import base character container components
const CharacterBase = require('../base-character/src/character/base');
const CombatAI = require('../base-character/src/ai/combat');
const CharacterContainer = require('../base-character/src/index');

// Custom Fighter Character Class
class FighterCharacter extends CharacterBase {
  constructor(config) {
    // Fighter-specific configuration
    const fighterConfig = {
      ...config,
      class: 'fighter',
      hitDie: 10,
      primaryStats: ['strength', 'constitution'],
      proficiencies: {
        armor: ['light', 'medium', 'heavy', 'shields'],
        weapons: ['simple', 'martial'],
        tools: [],
        savingThrows: ['strength', 'constitution'],
        skills: ['acrobatics', 'animal_handling', 'athletics', 'history', 'insight', 'intimidation', 'perception', 'survival']
      },
      specialAbilities: ['second_wind', 'fighting_style', 'action_surge'],
      equipment: {
        weapons: ['longsword', 'shield'],
        armor: ['chain_mail'],
        items: ['explorer_pack', 'handaxe', 'handaxe']
      }
    };

    super(fighterConfig);

    // Fighter-specific state
    this.state.updateState({
      secondWindUsed: false,
      actionSurgeUsed: false,
      fightingStyle: config.fightingStyle || 'defense', // defense, dueling, great_weapon_fighting, protection
      maneuvers: config.maneuvers || [],
      superiorityDice: config.level >= 3 ? 4 : 0
    });

    this.logger.info('Fighter character initialized', {
      name: this.state.state.name,
      fightingStyle: this.state.state.fightingStyle,
      level: this.state.state.level
    });
  }

  // Fighter-specific combat behavior
  async onCombatTurn(eventData) {
    this.logger.debug('Fighter processing combat turn', {
      characterId: this.characterId,
      hp: this.state.state.hp,
      maxHp: this.state.state.maxHp
    });

    // Check for Second Wind usage (heal when low on HP)
    const hpPercentage = this.state.state.hp / this.state.state.maxHp;
    if (hpPercentage < 0.4 && !this.state.state.secondWindUsed && this.state.state.level >= 1) {
      this.logger.info('Fighter using Second Wind ability');
      
      const healAmount = Math.floor(Math.random() * 10) + 1 + this.state.state.level;
      this.state.updateState({
        hp: Math.min(this.state.state.hp + healAmount, this.state.state.maxHp),
        secondWindUsed: true
      });

      return {
        acknowledged: true,
        action: {
          type: 'second_wind',
          healAmount: healAmount,
          message: `${this.state.state.name} uses Second Wind to recover ${healAmount} HP!`
        },
        aiGenerated: !eventData.manualControl
      };
    }

    // Check for Action Surge (extra action in combat)
    if (this.state.state.level >= 2 && !this.state.state.actionSurgeUsed && eventData.gameState?.combat?.intensity === 'high') {
      this.logger.info('Fighter considering Action Surge');
      
      // Use Action Surge for extra attack when facing multiple enemies
      const enemies = eventData.gameState?.combat?.enemies || [];
      if (enemies.length >= 2) {
        this.state.updateState({ actionSurgeUsed: true });
        
        return {
          acknowledged: true,
          action: {
            type: 'action_surge',
            extraAction: this.selectBestAttack(eventData),
            message: `${this.state.state.name} surges into action with extra attacks!`
          },
          aiGenerated: !eventData.manualControl
        };
      }
    }

    // Default to base combat behavior with fighter modifications
    const baseAction = await super.onCombatTurn(eventData);
    
    // Apply fighting style bonuses
    if (baseAction.action && baseAction.action.type === 'attack') {
      baseAction.action = this.applyFightingStyleBonus(baseAction.action);
    }

    return baseAction;
  }

  // Apply fighting style bonuses to attacks
  applyFightingStyleBonus(action) {
    const fightingStyle = this.state.state.fightingStyle;
    
    switch (fightingStyle) {
      case 'dueling':
        // +2 damage when wielding one-handed weapon with no other weapon
        if (action.weapon && !action.offHandWeapon) {
          action.damageBonus = (action.damageBonus || 0) + 2;
          action.message = `${action.message} (Dueling +2 dmg)`;
        }
        break;
        
      case 'defense':
        // +1 AC when wearing armor (passive, applied elsewhere)
        break;
        
      case 'great_weapon_fighting':
        // Reroll 1s and 2s on damage dice
        action.rerollLowDamage = true;
        break;
        
      case 'protection':
        // Can use reaction to impose disadvantage on attack against nearby ally
        if (action.type === 'reaction' && action.subtype === 'protect_ally') {
          action.effect = 'disadvantage_on_attack';
        }
        break;
    }
    
    return action;
  }

  // Select the best attack for the current situation
  selectBestAttack(eventData) {
    const enemies = eventData.gameState?.combat?.enemies || [];
    const availableActions = eventData.availableActions || [];
    
    // Prioritize attacks based on enemy types and positioning
    const attackActions = availableActions.filter(action => action.type === 'attack');
    
    if (attackActions.length === 0) {
      return { type: 'dodge', message: 'No attacks available, taking defensive stance' };
    }

    // Prefer weapon attacks over unarmed
    const weaponAttacks = attackActions.filter(action => action.weapon);
    if (weaponAttacks.length > 0) {
      return weaponAttacks[0];
    }

    return attackActions[0];
  }

  // Fighter-specific exploration behavior
  async onExplorationTurn(eventData) {
    this.logger.debug('Fighter processing exploration turn');

    // Fighters are good at detecting physical threats and traps
    const room = eventData.gameState?.currentRoom;
    if (room && room.features) {
      // Check for traps using Athletics or Perception
      const trapFeatures = room.features.filter(f => f.type === 'trap' || f.hidden);
      if (trapFeatures.length > 0) {
        return {
          acknowledged: true,
          action: {
            type: 'investigate',
            target: 'traps',
            skill: 'perception',
            bonus: this.getSkillBonus('perception'),
            message: `${this.state.state.name} carefully searches for traps`
          },
          aiGenerated: !eventData.manualControl
        };
      }
    }

    // Default to base exploration behavior
    return super.onExplorationTurn(eventData);
  }

  // Fighter-specific skill bonus calculation
  getSkillBonus(skill) {
    const baseBonus = super.getSkillBonus(skill);
    
    // Fighters get bonuses to certain physical skills
    switch (skill) {
      case 'athletics':
        return baseBonus + 2; // Fighters are naturally athletic
      case 'intimidation':
        return baseBonus + 1; // Fighters can be intimidating
      default:
        return baseBonus;
    }
  }

  // Reset abilities on short rest
  onShortRest() {
    this.logger.info('Fighter taking short rest');
    
    this.state.updateState({
      secondWindUsed: false,
      // Action Surge resets on short rest at higher levels
      actionSurgeUsed: this.state.state.level < 17 ? this.state.state.actionSurgeUsed : false
    });
    
    super.onShortRest();
  }

  // Reset all abilities on long rest
  onLongRest() {
    this.logger.info('Fighter taking long rest');
    
    this.state.updateState({
      secondWindUsed: false,
      actionSurgeUsed: false,
      superiorityDice: this.state.state.level >= 3 ? 4 : 0
    });
    
    super.onLongRest();
  }

  // Get fighter-specific character information
  getCharacterInfo() {
    const baseInfo = super.getCharacterInfo();
    
    return {
      ...baseInfo,
      fighterSpecific: {
        fightingStyle: this.state.state.fightingStyle,
        secondWindUsed: this.state.state.secondWindUsed,
        actionSurgeUsed: this.state.state.actionSurgeUsed,
        superiorityDice: this.state.state.superiorityDice,
        maneuvers: this.state.state.maneuvers
      }
    };
  }

  // Override to include fighter-specific data in character sheet
  getClassSpecificData() {
    return {
      fighterSpecific: {
        fightingStyle: this.state.state.fightingStyle,
        secondWindUsed: this.state.state.secondWindUsed,
        actionSurgeUsed: this.state.state.actionSurgeUsed,
        superiorityDice: this.state.state.superiorityDice,
        maneuvers: this.state.state.maneuvers
      }
    };
  }
}

// Custom Fighter Combat AI
class FighterCombatAI extends CombatAI {
  constructor(config) {
    // Fighter AI is more aggressive and tactical
    const fighterAIConfig = {
      ...config,
      aggressiveness: Math.min((config.aggressiveness || 0.5) + 0.2, 1.0),
      tactical: Math.min((config.tactical || 0.5) + 0.3, 1.0)
    };
    
    super(fighterAIConfig);
  }

  async decideCombatAction(character, gameState, availableActions) {
    this.logger.debug('Fighter AI making combat decision');

    // Fighter-specific tactical decisions
    const enemies = gameState?.combat?.enemies || [];
    const allies = gameState?.combat?.allies || [];

    // Protect allies if playing protection fighting style
    if (character.state.state.fightingStyle === 'protection' && allies.length > 0) {
      const threatenedAlly = allies.find(ally => ally.isBeingAttacked && ally.distance <= 5);
      if (threatenedAlly) {
        return {
          type: 'reaction',
          subtype: 'protect_ally',
          target: threatenedAlly.id,
          message: `${character.state.state.name} interposes their shield to protect ${threatenedAlly.name}!`
        };
      }
    }

    // Prioritize high-value targets
    if (enemies.length > 0) {
      // Target spellcasters first
      const spellcasters = enemies.filter(enemy => enemy.type === 'spellcaster' || enemy.spellSlots > 0);
      if (spellcasters.length > 0) {
        const target = spellcasters[0];
        return {
          type: 'attack',
          target: target.id,
          weapon: 'primary',
          message: `${character.state.state.name} charges at the spellcaster ${target.name}!`
        };
      }

      // Target weakest enemy if multiple enemies
      if (enemies.length > 2) {
        const weakestEnemy = enemies.reduce((weakest, enemy) => 
          enemy.hp < weakest.hp ? enemy : weakest
        );
        return {
          type: 'attack',
          target: weakestEnemy.id,
          weapon: 'primary',
          message: `${character.state.state.name} focuses on finishing off ${weakestEnemy.name}!`
        };
      }
    }

    // Fall back to base combat AI
    return super.decideCombatAction(character, gameState, availableActions);
  }

  // Fighter-specific threat assessment
  assessThreat(enemy, character) {
    let threatLevel = super.assessThreat(enemy, character);

    // Fighters are less threatened by physical attackers
    if (enemy.type === 'melee' || enemy.type === 'warrior') {
      threatLevel *= 0.8;
    }

    // More threatened by spellcasters and ranged attackers
    if (enemy.type === 'spellcaster' || enemy.type === 'ranged') {
      threatLevel *= 1.3;
    }

    return threatLevel;
  }
}

// Fighter Character Container
class FighterContainer extends CharacterContainer {
  constructor(config = {}) {
    // Default fighter configuration
    const fighterConfig = {
      ...config,
      name: config.name || process.env.CHARACTER_NAME || 'Grax the Fighter',
      class: 'fighter',
      fightingStyle: config.fightingStyle || process.env.FIGHTING_STYLE || 'defense',
      aiConfig: {
        aggressiveness: parseFloat(process.env.AI_AGGRESSIVENESS || '0.7'),
        caution: parseFloat(process.env.AI_CAUTION || '0.4'),
        curiosity: parseFloat(process.env.AI_CURIOSITY || '0.5'),
        tactical: parseFloat(process.env.AI_TACTICAL || '0.8'),
        ...config.aiConfig
      }
    };

    super(fighterConfig);
  }

  // Override character initialization to use Fighter class
  async initializeCharacter() {
    this.logger.info('Initializing Fighter character...');

    this.character = new FighterCharacter({
      characterId: this.config.characterId,
      name: this.config.name,
      class: this.config.class,
      level: this.config.level,
      fightingStyle: this.config.fightingStyle,
      ...this.config
    });

    this.character.aiEnabled = this.config.enableAI;

    this.logger.info('Fighter character initialized', {
      characterId: this.character.characterId,
      name: this.character.state.state.name,
      class: this.character.state.state.class,
      level: this.character.state.state.level,
      fightingStyle: this.character.state.state.fightingStyle
    });
  }

  // Override AI initialization to use Fighter AI
  async initializeAI() {
    this.logger.info('Initializing Fighter AI components...');

    // Initialize fighter combat AI
    this.combatAI = new FighterCombatAI(this.config.aiConfig);

    // Use base exploration AI (fighters don't need special exploration AI)
    const ExplorationAI = require('../base-character/src/ai/exploration');
    this.explorationAI = new ExplorationAI(this.config.aiConfig);

    this.logger.info('Fighter AI components initialized');
  }
}

// Main entry point
async function main() {
  const container = new FighterContainer();
  container.setupSignalHandlers();

  try {
    await container.start();
    
    // Keep the process running
    process.stdin.resume();
    
  } catch (error) {
    console.error('Failed to start fighter character container:', error.message);
    process.exit(1);
  }
}

// Run if this is the main module
if (require.main === module) {
  main();
}

module.exports = { FighterCharacter, FighterCombatAI, FighterContainer };