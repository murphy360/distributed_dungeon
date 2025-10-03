-- Seed data for Distributed Dungeon RPG System
-- This script populates the database with initial game content

BEGIN;

-- ===========================================
-- CORE SKILLS (D&D 5e Standard Skills)
-- ===========================================

INSERT INTO skills (name, ability_score, description) VALUES
('Acrobatics', 'dexterity', 'Your Dexterity (Acrobatics) check covers your attempt to stay on your feet in a tricky situation, such as when you''re trying to run across a sheet of ice, balance on a tightrope, or stay upright on a rocking ship''s deck.'),
('Animal Handling', 'wisdom', 'When there is any question whether you can calm down a domesticated animal, keep a mount from getting spooked, or intuit an animal''s intentions, the DM might call for a Wisdom (Animal Handling) check.'),
('Arcana', 'intelligence', 'Your Intelligence (Arcana) check measures your ability to recall lore about spells, magic items, eldritch symbols, magical traditions, the planes of existence, and the inhabitants of those planes.'),
('Athletics', 'strength', 'Your Strength (Athletics) check covers difficult situations you encounter while climbing, jumping, or swimming.'),
('Deception', 'charisma', 'Your Charisma (Deception) check determines whether you can convincingly hide the truth, either verbally or through your actions.'),
('History', 'intelligence', 'Your Intelligence (History) check measures your ability to recall lore about historical events, legendary people, ancient kingdoms, past disputes, recent wars, and lost civilizations.'),
('Insight', 'wisdom', 'Your Wisdom (Insight) check decides whether you can determine the true intentions of a creature, such as when searching out a lie or predicting someone''s next move.'),
('Intimidation', 'charisma', 'When you attempt to influence someone through overt threats, hostile actions, and physical violence, the DM might ask you to make a Charisma (Intimidation) check.'),
('Investigation', 'intelligence', 'When you look around for clues and make deductions based on those clues, you make an Intelligence (Investigation) check.'),
('Medicine', 'wisdom', 'A Wisdom (Medicine) check lets you try to stabilize a dying companion or diagnose an illness.'),
('Nature', 'intelligence', 'Your Intelligence (Nature) check measures your ability to recall lore about terrain, plants and animals, the weather, and natural cycles.'),
('Perception', 'wisdom', 'Your Wisdom (Perception) check lets you spot, hear, or otherwise detect the presence of something. It measures your general awareness of your surroundings and the keenness of your senses.'),
('Performance', 'charisma', 'Your Charisma (Performance) check determines how well you can delight an audience with music, dance, acting, storytelling, or some other form of entertainment.'),
('Persuasion', 'charisma', 'When you attempt to influence someone or a group of people with tact, social graces, or good nature, the DM might ask you to make a Charisma (Persuasion) check.'),
('Religion', 'intelligence', 'Your Intelligence (Religion) check measures your ability to recall lore about deities, rites and prayers, religious hierarchies, holy symbols, and the practices of secret cults.'),
('Sleight of Hand', 'dexterity', 'Whenever you attempt an act of legerdemain or manual trickery, such as planting something on someone else or concealing an object on your person, make a Dexterity (Sleight of Hand) check.'),
('Stealth', 'dexterity', 'Make a Dexterity (Stealth) check when you attempt to conceal yourself from enemies, slink past guards, slip away without being noticed, or sneak up on someone without being seen or heard.'),
('Survival', 'wisdom', 'The DM might ask you to make a Wisdom (Survival) check to follow tracks, hunt wild game, guide your group through frozen wastelands, identify signs that owlbears live nearby, predict the weather, or avoid quicksand and other hazards.');

-- ===========================================
-- CORE SPELLS (Sample D&D 5e Spells)
-- ===========================================

INSERT INTO spells (name, level, school, casting_time, range, components, duration, description, ritual, concentration) VALUES

-- Cantrips (Level 0)
('Eldritch Blast', 0, 'Evocation', '1 action', '120 feet', ARRAY['V', 'S'], 'Instantaneous', 'A beam of crackling energy streaks toward a creature within range. Make a ranged spell attack against the target. On a hit, the target takes 1d10 force damage.', false, false),
('Fire Bolt', 0, 'Evocation', '1 action', '120 feet', ARRAY['V', 'S'], 'Instantaneous', 'You hurl a mote of fire at a creature or object within range. Make a ranged spell attack against the target. On a hit, the target takes 1d10 fire damage.', false, false),
('Minor Illusion', 0, 'Illusion', '1 action', '30 feet', ARRAY['S', 'M'], '1 minute', 'You create a sound or an image of an object within range that lasts for the duration. The illusion also ends if you dismiss it as an action or cast this spell again.', false, false),
('Prestidigitation', 0, 'Transmutation', '1 action', '10 feet', ARRAY['V', 'S'], 'Up to 1 hour', 'This spell is a minor magical trick that novice spellcasters use for practice. You create one of several minor effects within range.', false, false),

-- 1st Level Spells
('Cure Wounds', 1, 'Evocation', '1 action', 'Touch', ARRAY['V', 'S'], 'Instantaneous', 'A creature you touch regains a number of hit points equal to 1d8 + your spellcasting ability modifier. This spell has no effect on undead or constructs.', false, false),
('Magic Missile', 1, 'Evocation', '1 action', '120 feet', ARRAY['V', 'S'], 'Instantaneous', 'You create three glowing darts of magical force. Each dart hits a creature of your choice that you can see within range. A dart deals 1d4 + 1 force damage to its target.', false, false),
('Shield', 1, 'Abjuration', '1 reaction', 'Self', ARRAY['V', 'S'], '1 round', 'An invisible barrier of magical force appears and protects you. Until the start of your next turn, you have a +5 bonus to AC, including against the triggering attack.', false, false),
('Sleep', 1, 'Enchantment', '1 action', '90 feet', ARRAY['V', 'S', 'M'], '1 minute', 'This spell sends creatures into a magical slumber. Roll 5d8; the total is how many hit points of creatures this spell can affect.', false, false),
('Healing Word', 1, 'Evocation', '1 bonus action', '60 feet', ARRAY['V'], 'Instantaneous', 'A creature of your choice that you can see within range regains hit points equal to 1d4 + your spellcasting ability modifier.', false, false),

-- 2nd Level Spells
('Misty Step', 2, 'Conjuration', '1 bonus action', 'Self', ARRAY['V'], 'Instantaneous', 'Briefly surrounded by silvery mist, you teleport up to 30 feet to an unoccupied space that you can see.', false, false),
('Web', 2, 'Conjuration', '1 action', '60 feet', ARRAY['V', 'S', 'M'], '1 hour', 'You conjure a mass of thick, sticky webbing at a point of your choice within range. The webs fill a 20-foot cube from that point for the duration.', false, true),
('Hold Person', 2, 'Enchantment', '1 action', '60 feet', ARRAY['V', 'S', 'M'], '1 minute', 'Choose a humanoid that you can see within range. The target must succeed on a Wisdom saving throw or be paralyzed for the duration.', false, true),

-- 3rd Level Spells
('Fireball', 3, 'Evocation', '1 action', '150 feet', ARRAY['V', 'S', 'M'], 'Instantaneous', 'A bright streak flashes from your pointing finger to a point you choose within range and then blossoms with a low roar into an explosion of flame.', false, false),
('Counterspell', 3, 'Abjuration', '1 reaction', '60 feet', ARRAY['S'], 'Instantaneous', 'You attempt to interrupt a creature in the process of casting a spell. If the creature is casting a spell of 3rd level or lower, its spell fails and has no effect.', false, false),
('Lightning Bolt', 3, 'Evocation', '1 action', 'Self (100-foot line)', ARRAY['V', 'S', 'M'], 'Instantaneous', 'A stroke of lightning forming a line 100 feet long and 5 feet wide blasts out from you in a direction you choose.', false, false);

-- ===========================================
-- SAMPLE MONSTER TEMPLATES
-- ===========================================

INSERT INTO monster_templates (name, type, size, challenge_rating, armor_class, hit_points_dice, hit_points_average, speed, strength, dexterity, constitution, intelligence, wisdom, charisma, actions, ai_personality) VALUES

('Goblin', 'humanoid', 'Small', 0.25, 15, '2d6', 7, '{"walk": 30}', 8, 14, 10, 10, 8, 8, 
'[
  {
    "name": "Scimitar",
    "type": "melee_weapon_attack",
    "attack_bonus": 4,
    "reach": "5 ft.",
    "targets": "one target",
    "damage": "1d6+2 slashing"
  },
  {
    "name": "Shortbow",
    "type": "ranged_weapon_attack",
    "attack_bonus": 4,
    "range": "80/320 ft.",
    "targets": "one target",
    "damage": "1d6+2 piercing"
  }
]',
'{"aggression": 0.6, "intelligence": 0.4, "loyalty": 0.7, "fearThreshold": 0.4}'),

('Orc', 'humanoid', 'Medium', 0.5, 13, '2d8+6', 15, '{"walk": 30}', 16, 12, 16, 7, 11, 10,
'[
  {
    "name": "Greataxe",
    "type": "melee_weapon_attack",
    "attack_bonus": 5,
    "reach": "5 ft.",
    "targets": "one target",
    "damage": "1d12+3 slashing"
  },
  {
    "name": "Javelin",
    "type": "melee_or_ranged_weapon_attack",
    "attack_bonus": 5,
    "reach": "5 ft. or range 30/120 ft.",
    "targets": "one target",
    "damage": "1d6+3 piercing"
  }
]',
'{"aggression": 0.8, "intelligence": 0.3, "loyalty": 0.5, "fearThreshold": 0.2}'),

('Skeleton', 'undead', 'Medium', 0.25, 13, '2d8+4', 13, '{"walk": 30}', 10, 14, 15, 6, 8, 5,
'[
  {
    "name": "Shortsword",
    "type": "melee_weapon_attack",
    "attack_bonus": 4,
    "reach": "5 ft.",
    "targets": "one target",
    "damage": "1d6+2 piercing"
  },
  {
    "name": "Shortbow",
    "type": "ranged_weapon_attack",
    "attack_bonus": 4,
    "range": "80/320 ft.",
    "targets": "one target",
    "damage": "1d6+2 piercing"
  }
]',
'{"aggression": 0.7, "intelligence": 0.2, "loyalty": 1.0, "fearThreshold": 0.0}'),

('Brown Bear', 'beast', 'Large', 1, 11, '4d10+8', 34, '{"walk": 40, "climb": 30}', 19, 10, 16, 2, 13, 7,
'[
  {
    "name": "Multiattack",
    "type": "multiattack",
    "description": "The bear makes two attacks: one with its bite and one with its claws."
  },
  {
    "name": "Bite",
    "type": "melee_weapon_attack",
    "attack_bonus": 6,
    "reach": "5 ft.",
    "targets": "one target",
    "damage": "1d8+4 piercing"
  },
  {
    "name": "Claws",
    "type": "melee_weapon_attack",
    "attack_bonus": 6,
    "reach": "5 ft.",
    "targets": "one target",
    "damage": "2d6+4 slashing"
  }
]',
'{"aggression": 0.4, "intelligence": 0.1, "loyalty": 0.0, "fearThreshold": 0.6}');

-- ===========================================
-- SAMPLE USERS AND CHARACTERS
-- ===========================================

-- Create sample users
INSERT INTO users (username, email, password_hash, role) VALUES
('dungeon_master', 'dm@distributeddungeon.com', '$2a$10$example.hash.for.password', 'dm'),
('player_one', 'player1@example.com', '$2a$10$example.hash.for.password', 'player'),
('player_two', 'player2@example.com', '$2a$10$example.hash.for.password', 'player'),
('admin_user', 'admin@distributeddungeon.com', '$2a$10$example.hash.for.password', 'admin');

-- Create sample characters
INSERT INTO players (user_id, name, class, race, level, strength, dexterity, constitution, intelligence, wisdom, charisma, hp_maximum, hp_current, armor_class) VALUES
((SELECT id FROM users WHERE username = 'player_one'), 'Aragorn', 'Ranger', 'Human', 5, 16, 18, 14, 12, 15, 13, 45, 45, 16),
((SELECT id FROM users WHERE username = 'player_two'), 'Gandalf', 'Wizard', 'Human', 8, 10, 14, 12, 20, 16, 18, 48, 48, 12),
((SELECT id FROM users WHERE username = 'dungeon_master'), 'Shopkeeper Bob', 'Commoner', 'Human', 1, 10, 10, 10, 12, 12, 14, 8, 8, 10);

-- Set the last character as NPC
UPDATE players SET is_npc = true WHERE name = 'Shopkeeper Bob';

-- ===========================================
-- SAMPLE DUNGEONS
-- ===========================================

INSERT INTO dungeons (name, description, min_level, max_level, max_players, created_by) VALUES
('The Forgotten Catacombs', 'Ancient underground burial chambers filled with undead creatures and forgotten treasures. The air is thick with the scent of decay and dark magic.', 3, 7, 6, (SELECT id FROM users WHERE username = 'dungeon_master')),
('Goblin Warren', 'A network of caves and tunnels inhabited by a clan of aggressive goblins. Perfect for beginning adventurers seeking their first real challenge.', 1, 3, 4, (SELECT id FROM users WHERE username = 'dungeon_master')),
('The Crystal Caverns', 'Mysterious caverns filled with magical crystals that amplify spellcasting abilities. Home to strange elemental creatures.', 5, 10, 6, (SELECT id FROM users WHERE username = 'dungeon_master'));

-- ===========================================
-- CORE RULES
-- ===========================================

INSERT INTO rules (name, category, type, description, implementation) VALUES

-- Core Combat Rules
('Basic Attack Roll', 'combat', 'core', 'Standard attack roll mechanics using 1d20 + ability modifier + proficiency bonus', 
'{"formula": "1d20 + ability_modifier + proficiency_bonus", "success_condition": ">=", "target": "armor_class"}'),

('Advantage/Disadvantage', 'combat', 'core', 'Roll twice and take higher/lower result', 
'{"advantage": "roll_twice_take_higher", "disadvantage": "roll_twice_take_lower"}'),

('Critical Hit', 'combat', 'core', 'Natural 20 on attack roll doubles damage dice', 
'{"trigger": "natural_20", "effect": "double_damage_dice"}'),

('Death Saving Throws', 'combat', 'core', 'Rules for characters at 0 hit points', 
'{"dc": 10, "success_threshold": 3, "failure_threshold": 3, "critical_success": "regain_1_hp", "critical_failure": "two_failures"}'),

-- Skill Check Rules
('Standard Skill Check', 'skills', 'core', 'Basic skill check mechanics', 
'{"formula": "1d20 + ability_modifier + proficiency_bonus", "proficiency_applies": "if_proficient"}'),

('Passive Perception', 'skills', 'core', 'Passive perception calculation', 
'{"formula": "10 + wisdom_modifier + proficiency_bonus", "applies_always": true}'),

-- Spellcasting Rules
('Spell Attack Roll', 'spellcasting', 'core', 'Spell attack roll mechanics', 
'{"formula": "1d20 + spellcasting_ability_modifier + proficiency_bonus"}'),

('Spell Save DC', 'spellcasting', 'core', 'Spell save difficulty class calculation', 
'{"formula": "8 + spellcasting_ability_modifier + proficiency_bonus"}'),

('Concentration', 'spellcasting', 'core', 'Maintaining concentration on spells', 
'{"save_dc": "max(10, damage_taken/2)", "save_type": "constitution", "break_on_failure": true}');

-- ===========================================
-- PERFORMANCE OPTIMIZATIONS
-- ===========================================

-- Update statistics for better query planning
ANALYZE users;
ANALYZE players;
ANALYZE skills;
ANALYZE spells;
ANALYZE dungeons;
ANALYZE monster_templates;
ANALYZE rules;

COMMIT;

-- Log successful seed completion
DO $$
BEGIN
    RAISE NOTICE 'Database seeded successfully with:';
    RAISE NOTICE '- % skills', (SELECT COUNT(*) FROM skills);
    RAISE NOTICE '- % spells', (SELECT COUNT(*) FROM spells);
    RAISE NOTICE '- % monster templates', (SELECT COUNT(*) FROM monster_templates);
    RAISE NOTICE '- % users', (SELECT COUNT(*) FROM users);
    RAISE NOTICE '- % characters', (SELECT COUNT(*) FROM players);
    RAISE NOTICE '- % dungeons', (SELECT COUNT(*) FROM dungeons);
    RAISE NOTICE '- % rules', (SELECT COUNT(*) FROM rules);
END $$;