const express = require('express');
const { Pool } = require('pg');
const redis = require('redis');
const jwt = require('jsonwebtoken');
const winston = require('winston');

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
const PORT = process.env.PORT || 3005;

// Middleware
app.use(express.json());

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

// Redis connection
const redisClient = redis.createClient({
    url: `redis://:${process.env.REDIS_PASSWORD || 'redispass123'}@${process.env.REDIS_HOST || 'dungeon_redis'}:${process.env.REDIS_PORT || 6379}`
});

redisClient.on('error', (err) => {
    logger.error('Redis Client Error', err);
});

// Connect to Redis
redisClient.connect().catch(console.error);

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        // Check database connection
        await pool.query('SELECT 1');
        
        // Check Redis connection
        await redisClient.ping();
        
        res.json({ 
            status: 'healthy', 
            service: 'rules-engine-service',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Health check failed:', error);
        res.status(503).json({ 
            status: 'unhealthy', 
            service: 'rules-engine-service',
            error: error.message 
        });
    }
});

// Calculate ability modifier
const getAbilityModifier = (score) => {
    return Math.floor((score - 10) / 2);
};

// Roll dice
const rollDice = (diceString) => {
    const match = diceString.match(/(\d+)d(\d+)(?:\+(\d+))?/);
    if (!match) return null;
    
    const [, numDice, dieSize, modifier] = match;
    let total = 0;
    const rolls = [];
    
    for (let i = 0; i < parseInt(numDice); i++) {
        const roll = Math.floor(Math.random() * parseInt(dieSize)) + 1;
        rolls.push(roll);
        total += roll;
    }
    
    if (modifier) {
        total += parseInt(modifier);
    }
    
    return { total, rolls, modifier: modifier ? parseInt(modifier) : 0 };
};

// Validate dice roll request
app.post('/api/dice/roll', (req, res) => {
    try {
        const { dice, reason } = req.body;
        
        if (!dice) {
            return res.status(400).json({
                success: false,
                error: 'Dice parameter is required (e.g., "1d20", "3d6+2")'
            });
        }
        
        const result = rollDice(dice);
        
        if (!result) {
            return res.status(400).json({
                success: false,
                error: 'Invalid dice format. Use format like "1d20" or "3d6+2"'
            });
        }
        
        res.json({
            success: true,
            data: {
                dice,
                result: result.total,
                rolls: result.rolls,
                modifier: result.modifier,
                reason: reason || 'Manual roll',
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        logger.error('Error rolling dice:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to roll dice'
        });
    }
});

// Calculate attack roll
app.post('/api/combat/attack', async (req, res) => {
    try {
        const { attackerId, targetId, weaponType, advantage, disadvantage } = req.body;
        
        if (!attackerId || !targetId) {
            return res.status(400).json({
                success: false,
                error: 'Attacker ID and Target ID are required'
            });
        }
        
        // Get attacker and target information
        const attacker = await pool.query(`
            SELECT c.*, p.current_hit_points 
            FROM characters c
            LEFT JOIN players p ON c.id = p.character_id
            WHERE c.id = $1 OR p.id = $1
        `, [attackerId]);
        
        const target = await pool.query(`
            SELECT c.*, p.current_hit_points 
            FROM characters c
            LEFT JOIN players p ON c.id = p.character_id
            WHERE c.id = $1 OR p.id = $1
        `, [targetId]);
        
        if (attacker.rows.length === 0 || target.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Attacker or target not found'
            });
        }
        
        const attackerData = attacker.rows[0];
        const targetData = target.rows[0];
        
        // Calculate attack bonus (simplified - would need weapon data in full implementation)
        const strMod = getAbilityModifier(attackerData.abilities?.strength || 10);
        const dexMod = getAbilityModifier(attackerData.abilities?.dexterity || 10);
        const proficiencyBonus = Math.ceil(attackerData.level / 4) + 1;
        
        // Assume melee uses STR, ranged uses DEX (simplified)
        const attackBonus = (weaponType === 'ranged' ? dexMod : strMod) + proficiencyBonus;
        
        // Roll attack
        let attackRoll = rollDice('1d20');
        let finalRoll = attackRoll.total + attackBonus;
        
        // Handle advantage/disadvantage
        if (advantage || disadvantage) {
            const secondRoll = rollDice('1d20');
            if (advantage) {
                attackRoll = attackRoll.total >= secondRoll.total ? attackRoll : secondRoll;
            } else {
                attackRoll = attackRoll.total <= secondRoll.total ? attackRoll : secondRoll;
            }
            finalRoll = attackRoll.total + attackBonus;
        }
        
        // Check if hit
        const targetAC = targetData.armor_class || 10;
        const isHit = finalRoll >= targetAC;
        const isCritical = attackRoll.total === 20;
        const isCriticalMiss = attackRoll.total === 1;
        
        let damage = null;
        if (isHit && !isCriticalMiss) {
            // Calculate damage (simplified - 1d8 + ability modifier)
            const baseDamage = rollDice(isCritical ? '2d8' : '1d8');
            const damageBonus = weaponType === 'ranged' ? dexMod : strMod;
            damage = {
                total: baseDamage.total + damageBonus,
                rolls: baseDamage.rolls,
                modifier: damageBonus,
                isCritical
            };
        }
        
        res.json({
            success: true,
            data: {
                attacker: attackerData.name,
                target: targetData.name,
                attackRoll: attackRoll.total,
                attackBonus,
                finalRoll,
                targetAC,
                isHit,
                isCritical,
                isCriticalMiss,
                damage,
                advantage,
                disadvantage
            }
        });
    } catch (error) {
        logger.error('Error calculating attack:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to calculate attack'
        });
    }
});

// Calculate skill check
app.post('/api/skills/check', async (req, res) => {
    try {
        const { characterId, skill, difficulty, advantage, disadvantage } = req.body;
        
        if (!characterId || !skill) {
            return res.status(400).json({
                success: false,
                error: 'Character ID and skill are required'
            });
        }
        
        // Get character information
        const character = await pool.query(`
            SELECT * FROM characters WHERE id = $1
        `, [characterId]);
        
        if (character.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Character not found'
            });
        }
        
        const characterData = character.rows[0];
        
        // Skill to ability mapping
        const skillAbilities = {
            acrobatics: 'dexterity',
            'animal-handling': 'wisdom',
            arcana: 'intelligence',
            athletics: 'strength',
            deception: 'charisma',
            history: 'intelligence',
            insight: 'wisdom',
            intimidation: 'charisma',
            investigation: 'intelligence',
            medicine: 'wisdom',
            nature: 'intelligence',
            perception: 'wisdom',
            performance: 'charisma',
            persuasion: 'charisma',
            religion: 'intelligence',
            'sleight-of-hand': 'dexterity',
            stealth: 'dexterity',
            survival: 'wisdom'
        };
        
        const abilityName = skillAbilities[skill.toLowerCase()];
        if (!abilityName) {
            return res.status(400).json({
                success: false,
                error: 'Invalid skill name'
            });
        }
        
        const abilityScore = characterData.abilities?.[abilityName] || 10;
        const abilityModifier = getAbilityModifier(abilityScore);
        const proficiencyBonus = Math.ceil(characterData.level / 4) + 1;
        
        // Check if character is proficient in skill
        const isProficient = characterData.skills?.[skill] || false;
        const skillBonus = abilityModifier + (isProficient ? proficiencyBonus : 0);
        
        // Roll skill check
        let skillRoll = rollDice('1d20');
        
        // Handle advantage/disadvantage
        if (advantage || disadvantage) {
            const secondRoll = rollDice('1d20');
            if (advantage) {
                skillRoll = skillRoll.total >= secondRoll.total ? skillRoll : secondRoll;
            } else {
                skillRoll = skillRoll.total <= secondRoll.total ? skillRoll : secondRoll;
            }
        }
        
        const finalResult = skillRoll.total + skillBonus;
        
        // Determine success based on difficulty
        const difficultyClasses = {
            trivial: 5,
            easy: 10,
            medium: 15,
            hard: 20,
            'very-hard': 25,
            'nearly-impossible': 30
        };
        
        const dc = typeof difficulty === 'number' ? difficulty : difficultyClasses[difficulty] || 15;
        const isSuccess = finalResult >= dc;
        
        res.json({
            success: true,
            data: {
                character: characterData.name,
                skill,
                ability: abilityName,
                roll: skillRoll.total,
                abilityModifier,
                proficiencyBonus: isProficient ? proficiencyBonus : 0,
                skillBonus,
                finalResult,
                dc,
                isSuccess,
                advantage,
                disadvantage
            }
        });
    } catch (error) {
        logger.error('Error calculating skill check:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to calculate skill check'
        });
    }
});

// Get spell information
app.get('/api/spells/:name', async (req, res) => {
    try {
        const { name } = req.params;
        const result = await pool.query(`
            SELECT * FROM spells WHERE LOWER(name) = LOWER($1)
        `, [name]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Spell not found'
            });
        }
        
        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        logger.error('Error fetching spell:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch spell'
        });
    }
});

// Cast spell
app.post('/api/spells/cast', async (req, res) => {
    try {
        const { casterId, spellName, spellLevel, targets } = req.body;
        
        if (!casterId || !spellName) {
            return res.status(400).json({
                success: false,
                error: 'Caster ID and spell name are required'
            });
        }
        
        // Get spell information
        const spell = await pool.query(`
            SELECT * FROM spells WHERE LOWER(name) = LOWER($1)
        `, [spellName]);
        
        if (spell.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Spell not found'
            });
        }
        
        const spellData = spell.rows[0];
        
        // Get caster information
        const caster = await pool.query(`
            SELECT * FROM characters WHERE id = $1
        `, [casterId]);
        
        if (caster.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Caster not found'
            });
        }
        
        const casterData = caster.rows[0];
        
        // Calculate spell attack bonus and save DC
        const spellcastingAbility = casterData.class?.toLowerCase().includes('wizard') ? 'intelligence' :
                                  casterData.class?.toLowerCase().includes('cleric') ? 'wisdom' :
                                  casterData.class?.toLowerCase().includes('sorcerer') ? 'charisma' :
                                  casterData.class?.toLowerCase().includes('warlock') ? 'charisma' : 'wisdom';
        
        const spellcastingModifier = getAbilityModifier(casterData.abilities?.[spellcastingAbility] || 10);
        const proficiencyBonus = Math.ceil(casterData.level / 4) + 1;
        
        const spellAttackBonus = spellcastingModifier + proficiencyBonus;
        const spellSaveDC = 8 + spellcastingModifier + proficiencyBonus;
        
        res.json({
            success: true,
            data: {
                caster: casterData.name,
                spell: spellData,
                spellLevel: spellLevel || spellData.level,
                spellAttackBonus,
                spellSaveDC,
                targets: targets || [],
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        logger.error('Error casting spell:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to cast spell'
        });
    }
});

// Calculate saving throw
app.post('/api/saves/throw', async (req, res) => {
    try {
        const { characterId, saveType, dc, advantage, disadvantage } = req.body;
        
        if (!characterId || !saveType || dc === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Character ID, save type, and DC are required'
            });
        }
        
        // Get character information
        const character = await pool.query(`
            SELECT * FROM characters WHERE id = $1
        `, [characterId]);
        
        if (character.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Character not found'
            });
        }
        
        const characterData = character.rows[0];
        
        const abilityScore = characterData.abilities?.[saveType] || 10;
        const abilityModifier = getAbilityModifier(abilityScore);
        const proficiencyBonus = Math.ceil(characterData.level / 4) + 1;
        
        // Check if character has proficiency in this save
        const saveProficiencies = characterData.save_proficiencies || [];
        const isProficient = saveProficiencies.includes(saveType);
        const saveBonus = abilityModifier + (isProficient ? proficiencyBonus : 0);
        
        // Roll saving throw
        let saveRoll = rollDice('1d20');
        
        // Handle advantage/disadvantage
        if (advantage || disadvantage) {
            const secondRoll = rollDice('1d20');
            if (advantage) {
                saveRoll = saveRoll.total >= secondRoll.total ? saveRoll : secondRoll;
            } else {
                saveRoll = saveRoll.total <= secondRoll.total ? saveRoll : secondRoll;
            }
        }
        
        const finalResult = saveRoll.total + saveBonus;
        const isSuccess = finalResult >= dc;
        
        res.json({
            success: true,
            data: {
                character: characterData.name,
                saveType,
                roll: saveRoll.total,
                abilityModifier,
                proficiencyBonus: isProficient ? proficiencyBonus : 0,
                saveBonus,
                finalResult,
                dc,
                isSuccess,
                advantage,
                disadvantage
            }
        });
    } catch (error) {
        logger.error('Error calculating saving throw:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to calculate saving throw'
        });
    }
});

// Start server
app.listen(PORT, () => {
    logger.info(`Rules Engine Service running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');
    await pool.end();
    await redisClient.quit();
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully');
    await pool.end();
    await redisClient.quit();
    process.exit(0);
});