# Database Schema Design

## Overview

The Distributed Dungeon system uses PostgreSQL as the primary database with Redis for caching and session management. The schema is designed to support flexible character sheets, dynamic rule systems, and scalable game sessions.

## Entity Relationship Diagram

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    Users    │────▶│   Players   │────▶│ Player_     │
│             │     │             │     │ Skills      │
│ - id (PK)   │     │ - id (PK)   │     │             │
│ - username  │     │ - user_id   │     │ - player_id │
│ - email     │     │ - name      │     │ - skill_id  │
│ - role      │     │ - class     │     │ - proficient│
│ - created   │     │ - level     │     │ - expertise │
└─────────────┘     │ - stats     │     └─────────────┘
                    │ - hp        │            │
                    │ - is_npc    │            ▼
                    └─────────────┘     ┌─────────────┐
                           │            │   Skills    │
                           ▼            │             │
                    ┌─────────────┐     │ - id (PK)   │
                    │ Player_     │     │ - name      │
                    │ Spells      │     │ - ability   │
                    │             │     │ - description│
                    │ - player_id │     └─────────────┘
                    │ - spell_id  │
                    │ - prepared  │            │
                    │ - slots_used│            ▼
                    └─────────────┘     ┌─────────────┐
                           │            │   Spells    │
                           ▼            │             │
                    ┌─────────────┐     │ - id (PK)   │
                    │   Spells    │     │ - name      │
                    │             │     │ - level     │
                    │ - id (PK)   │     │ - school    │
                    │ - name      │     │ - components│
                    │ - level     │     │ - description│
                    │ - school    │     └─────────────┘
                    │ - components│
                    │ - range     │
                    │ - duration  │
                    │ - description│
                    └─────────────┘

┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Dungeons   │────▶│ Dungeon_    │────▶│ Sessions    │
│             │     │ Players     │     │             │
│ - id (PK)   │     │             │     │ - id (PK)   │
│ - name      │     │ - dungeon_id│     │ - dungeon_id│
│ - min_level │     │ - player_id │     │ - dm_id     │
│ - max_level │     │ - joined_at │     │ - status    │
│ - max_players│     │ - status    │     │ - mode      │
│ - settings  │     └─────────────┘     │ - started_at│
│ - custom_rules│                       │ - ended_at  │
└─────────────┘                         └─────────────┘
       │                                       │
       ▼                                       ▼
┌─────────────┐                         ┌─────────────┐
│ Monster_    │                         │ Game_Events │
│ Instances   │                         │             │
│             │                         │ - id (PK)   │
│ - id (PK)   │                         │ - session_id│
│ - template_id│                        │ - event_type│
│ - dungeon_id│                         │ - player_id │
│ - position  │                         │ - data      │
│ - hp_current│                         │ - timestamp │
│ - status    │                         └─────────────┘
└─────────────┘
       │
       ▼
┌─────────────┐
│ Monster_    │
│ Templates   │
│             │
│ - id (PK)   │
│ - name      │
│ - type      │
│ - challenge_│
│   rating    │
│ - stats     │
│ - actions   │
│ - ai_config │
└─────────────┘
```

## Table Definitions

### Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) DEFAULT 'player' CHECK (role IN ('player', 'dm', 'admin')),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE,
    settings JSONB DEFAULT '{}',
    
    -- Indexes
    INDEX idx_users_username (username),
    INDEX idx_users_email (email),
    INDEX idx_users_role (role)
);
```

### Players Table (Character Sheets)
```sql
CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    class VARCHAR(50) NOT NULL,
    race VARCHAR(50) NOT NULL,
    level INTEGER DEFAULT 1 CHECK (level >= 1 AND level <= 20),
    background VARCHAR(100),
    alignment VARCHAR(50),
    
    -- Core Stats
    strength INTEGER DEFAULT 10 CHECK (strength >= 1 AND strength <= 30),
    dexterity INTEGER DEFAULT 10 CHECK (dexterity >= 1 AND dexterity <= 30),
    constitution INTEGER DEFAULT 10 CHECK (constitution >= 1 AND constitution <= 30),
    intelligence INTEGER DEFAULT 10 CHECK (intelligence >= 1 AND intelligence <= 30),
    wisdom INTEGER DEFAULT 10 CHECK (wisdom >= 1 AND wisdom <= 30),
    charisma INTEGER DEFAULT 10 CHECK (charisma >= 1 AND charisma <= 30),
    
    -- Hit Points
    hp_maximum INTEGER NOT NULL DEFAULT 1,
    hp_current INTEGER NOT NULL DEFAULT 1,
    hp_temporary INTEGER DEFAULT 0,
    
    -- Combat Stats
    armor_class INTEGER DEFAULT 10,
    speed INTEGER DEFAULT 30,
    proficiency_bonus INTEGER DEFAULT 2,
    
    -- Meta Information
    is_npc BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    experience_points INTEGER DEFAULT 0,
    
    -- Flexible Data
    equipment JSONB DEFAULT '[]',
    features JSONB DEFAULT '[]',
    conditions JSONB DEFAULT '[]',
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_players_user_id (user_id),
    INDEX idx_players_level (level),
    INDEX idx_players_class (class),
    INDEX idx_players_is_npc (is_npc),
    INDEX idx_players_is_active (is_active)
);
```

### Skills Table
```sql
CREATE TABLE skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    ability_score VARCHAR(20) NOT NULL CHECK (
        ability_score IN ('strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma')
    ),
    description TEXT,
    
    -- Indexes
    INDEX idx_skills_name (name),
    INDEX idx_skills_ability (ability_score)
);
```

### Player_Skills Table
```sql
CREATE TABLE player_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
    proficient BOOLEAN DEFAULT false,
    expertise BOOLEAN DEFAULT false,
    custom_modifier INTEGER DEFAULT 0,
    
    -- Unique constraint to prevent duplicate skills per player
    UNIQUE (player_id, skill_id),
    
    -- Indexes
    INDEX idx_player_skills_player_id (player_id),
    INDEX idx_player_skills_skill_id (skill_id)
);
```

### Spells Table
```sql
CREATE TABLE spells (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    level INTEGER CHECK (level >= 0 AND level <= 9),
    school VARCHAR(50) NOT NULL,
    casting_time VARCHAR(100) NOT NULL,
    range VARCHAR(100) NOT NULL,
    components VARCHAR(20)[] NOT NULL, -- Array of V, S, M
    duration VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    higher_level TEXT,
    ritual BOOLEAN DEFAULT false,
    concentration BOOLEAN DEFAULT false,
    
    -- Indexes
    INDEX idx_spells_name (name),
    INDEX idx_spells_level (level),
    INDEX idx_spells_school (school)
);
```

### Player_Spells Table
```sql
CREATE TABLE player_spells (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    spell_id UUID REFERENCES spells(id) ON DELETE CASCADE,
    prepared BOOLEAN DEFAULT false,
    always_prepared BOOLEAN DEFAULT false, -- For class features
    spell_slots_used INTEGER DEFAULT 0,
    
    -- Unique constraint
    UNIQUE (player_id, spell_id),
    
    -- Indexes
    INDEX idx_player_spells_player_id (player_id),
    INDEX idx_player_spells_spell_id (spell_id),
    INDEX idx_player_spells_prepared (prepared)
);
```

### Dungeons Table
```sql
CREATE TABLE dungeons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    min_level INTEGER DEFAULT 1 CHECK (min_level >= 1),
    max_level INTEGER DEFAULT 20 CHECK (max_level <= 20),
    max_players INTEGER DEFAULT 6 CHECK (max_players >= 1),
    is_active BOOLEAN DEFAULT true,
    
    -- Settings as JSON
    settings JSONB DEFAULT '{
        "allowPvP": false,
        "respawnEnabled": true,
        "difficultyModifier": 1.0,
        "experienceModifier": 1.0
    }',
    
    -- Custom rules as JSON array
    custom_rules JSONB DEFAULT '[]',
    
    -- Environment data
    map_data JSONB,
    rooms JSONB DEFAULT '[]',
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    
    -- Constraints
    CHECK (max_level >= min_level),
    
    -- Indexes
    INDEX idx_dungeons_active (is_active),
    INDEX idx_dungeons_level_range (min_level, max_level),
    INDEX idx_dungeons_created_by (created_by)
);
```

### Dungeon_Players Table
```sql
CREATE TABLE dungeon_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dungeon_id UUID REFERENCES dungeons(id) ON DELETE CASCADE,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'active' CHECK (
        status IN ('active', 'inactive', 'kicked', 'left')
    ),
    position JSONB, -- Current position in dungeon
    
    -- Unique constraint for active players
    UNIQUE (dungeon_id, player_id),
    
    -- Indexes
    INDEX idx_dungeon_players_dungeon_id (dungeon_id),
    INDEX idx_dungeon_players_player_id (player_id),
    INDEX idx_dungeon_players_status (status)
);
```

### Sessions Table
```sql
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dungeon_id UUID REFERENCES dungeons(id) ON DELETE CASCADE,
    dm_id UUID REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'active' CHECK (
        status IN ('active', 'paused', 'ended')
    ),
    mode VARCHAR(20) DEFAULT 'manual' CHECK (
        mode IN ('manual', 'automatic')
    ),
    
    -- Session configuration
    settings JSONB DEFAULT '{
        "autoResolveSimpleCombat": false,
        "allowPlayerInitiative": true,
        "logAllActions": true
    }',
    
    -- Current game state
    current_turn UUID, -- References player or monster
    combat_round INTEGER DEFAULT 0,
    initiative_order JSONB DEFAULT '[]',
    
    -- Timestamps
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_sessions_dungeon_id (dungeon_id),
    INDEX idx_sessions_dm_id (dm_id),
    INDEX idx_sessions_status (status),
    INDEX idx_sessions_active (status, ended_at)
);
```

### Monster_Templates Table
```sql
CREATE TABLE monster_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL, -- humanoid, beast, undead, etc.
    size VARCHAR(20) NOT NULL, -- tiny, small, medium, large, etc.
    challenge_rating DECIMAL(4,2) NOT NULL,
    
    -- Combat Stats
    armor_class INTEGER NOT NULL,
    hit_points_dice VARCHAR(20) NOT NULL, -- e.g., "2d8+2"
    hit_points_average INTEGER NOT NULL,
    speed JSONB NOT NULL, -- {"walk": 30, "fly": 60, "swim": 0}
    
    -- Ability Scores
    strength INTEGER NOT NULL DEFAULT 10,
    dexterity INTEGER NOT NULL DEFAULT 10,
    constitution INTEGER NOT NULL DEFAULT 10,
    intelligence INTEGER NOT NULL DEFAULT 10,
    wisdom INTEGER NOT NULL DEFAULT 10,
    charisma INTEGER NOT NULL DEFAULT 10,
    
    -- Skills and Abilities
    saving_throws JSONB DEFAULT '{}',
    skills JSONB DEFAULT '{}',
    damage_resistances VARCHAR(255)[],
    damage_immunities VARCHAR(255)[],
    condition_immunities VARCHAR(255)[],
    senses VARCHAR(255)[],
    languages VARCHAR(255)[],
    
    -- Actions and Abilities
    actions JSONB NOT NULL DEFAULT '[]',
    legendary_actions JSONB DEFAULT '[]',
    special_abilities JSONB DEFAULT '[]',
    
    -- AI Configuration
    ai_personality JSONB DEFAULT '{
        "aggression": 0.5,
        "intelligence": 0.5,
        "loyalty": 0.5,
        "fearThreshold": 0.3
    }',
    ai_prompts JSONB DEFAULT '{}',
    
    -- Meta
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    
    -- Indexes
    INDEX idx_monster_templates_name (name),
    INDEX idx_monster_templates_type (type),
    INDEX idx_monster_templates_cr (challenge_rating),
    INDEX idx_monster_templates_size (size)
);
```

### Monster_Instances Table
```sql
CREATE TABLE monster_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES monster_templates(id) ON DELETE CASCADE,
    dungeon_id UUID REFERENCES dungeons(id) ON DELETE CASCADE,
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    
    -- Current State
    name VARCHAR(100), -- Instance name (can override template)
    hp_current INTEGER NOT NULL,
    hp_maximum INTEGER NOT NULL,
    position JSONB, -- Current position in dungeon
    status VARCHAR(20) DEFAULT 'active' CHECK (
        status IN ('active', 'defeated', 'fled', 'hidden')
    ),
    
    -- Temporary Modifiers
    conditions JSONB DEFAULT '[]',
    temporary_modifiers JSONB DEFAULT '{}',
    
    -- AI State
    ai_memory JSONB DEFAULT '{}',
    last_ai_action TIMESTAMP WITH TIME ZONE,
    
    -- Timestamps
    spawned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    defeated_at TIMESTAMP WITH TIME ZONE,
    
    -- Indexes
    INDEX idx_monster_instances_template_id (template_id),
    INDEX idx_monster_instances_dungeon_id (dungeon_id),
    INDEX idx_monster_instances_session_id (session_id),
    INDEX idx_monster_instances_status (status)
);
```

### Game_Events Table
```sql
CREATE TABLE game_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    
    -- Participants
    player_id UUID REFERENCES players(id),
    monster_id UUID REFERENCES monster_instances(id),
    target_player_id UUID REFERENCES players(id),
    target_monster_id UUID REFERENCES monster_instances(id),
    
    -- Event Data
    action_type VARCHAR(50),
    data JSONB NOT NULL DEFAULT '{}',
    result JSONB DEFAULT '{}',
    
    -- Metadata
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    turn_number INTEGER,
    round_number INTEGER,
    
    -- Indexes
    INDEX idx_game_events_session_id (session_id),
    INDEX idx_game_events_type (event_type),
    INDEX idx_game_events_player_id (player_id),
    INDEX idx_game_events_timestamp (timestamp),
    INDEX idx_game_events_turn_round (turn_number, round_number)
);
```

### Rules Table
```sql
CREATE TABLE rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(50) NOT NULL, -- combat, spellcasting, skills, etc.
    type VARCHAR(50) NOT NULL, -- core, optional, house, dungeon
    scope VARCHAR(20) DEFAULT 'global' CHECK (
        scope IN ('global', 'dungeon', 'session')
    ),
    
    -- Rule Definition
    description TEXT NOT NULL,
    implementation JSONB NOT NULL, -- Rule logic in structured format
    conditions JSONB DEFAULT '[]', -- When this rule applies
    
    -- Hierarchy
    parent_rule_id UUID REFERENCES rules(id),
    priority INTEGER DEFAULT 0,
    
    -- Scope References
    dungeon_id UUID REFERENCES dungeons(id),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    
    -- Indexes
    INDEX idx_rules_category (category),
    INDEX idx_rules_type (type),
    INDEX idx_rules_scope (scope),
    INDEX idx_rules_dungeon_id (dungeon_id),
    INDEX idx_rules_priority (priority),
    INDEX idx_rules_active (is_active)
);
```

## Initial Data Seeds

### Core Skills
```sql
INSERT INTO skills (name, ability_score, description) VALUES
('Acrobatics', 'dexterity', 'Your Dexterity (Acrobatics) check covers your attempt to stay on your feet in a tricky situation'),
('Animal Handling', 'wisdom', 'When there is any question whether you can calm down a domesticated animal'),
('Arcana', 'intelligence', 'Your Intelligence (Arcana) check measures your ability to recall lore about spells'),
('Athletics', 'strength', 'Your Strength (Athletics) check covers difficult situations you encounter while climbing'),
('Deception', 'charisma', 'Your Charisma (Deception) check determines whether you can convincingly hide the truth'),
('History', 'intelligence', 'Your Intelligence (History) check measures your ability to recall lore about historical events'),
('Insight', 'wisdom', 'Your Wisdom (Insight) check decides whether you can determine the true intentions of a creature'),
('Intimidation', 'charisma', 'When you attempt to influence someone through overt threats'),
('Investigation', 'intelligence', 'When you look around for clues and make deductions based on those clues'),
('Medicine', 'wisdom', 'A Wisdom (Medicine) check lets you try to stabilize a dying companion'),
('Nature', 'intelligence', 'Your Intelligence (Nature) check measures your ability to recall lore about terrain'),
('Perception', 'wisdom', 'Your Wisdom (Perception) check lets you spot, hear, or otherwise detect the presence of something'),
('Performance', 'charisma', 'Your Charisma (Performance) check determines how well you can delight an audience'),
('Persuasion', 'charisma', 'When you attempt to influence someone or a group of people with tact'),
('Religion', 'intelligence', 'Your Intelligence (Religion) check measures your ability to recall lore about deities'),
('Sleight of Hand', 'dexterity', 'Whenever you attempt an act of legerdemain or manual trickery'),
('Stealth', 'dexterity', 'Make a Dexterity (Stealth) check when you attempt to conceal yourself from enemies'),
('Survival', 'wisdom', 'The DM might ask you to make a Wisdom (Survival) check to follow tracks');
```

### Sample Spells
```sql
INSERT INTO spells (name, level, school, casting_time, range, components, duration, description) VALUES
('Cure Light Wounds', 1, 'Evocation', '1 action', 'Touch', ARRAY['V', 'S'], 'Instantaneous', 'A creature you touch regains a number of hit points equal to 1d8 + your spellcasting ability modifier.'),
('Magic Missile', 1, 'Evocation', '1 action', '120 feet', ARRAY['V', 'S'], 'Instantaneous', 'You create three glowing darts of magical force. Each dart hits a creature of your choice that you can see within range.'),
('Shield', 1, 'Abjuration', '1 reaction', 'Self', ARRAY['V', 'S'], '1 round', 'An invisible barrier of magical force appears and protects you. Until the start of your next turn, you have a +5 bonus to AC.'),
('Fireball', 3, 'Evocation', '1 action', '150 feet', ARRAY['V', 'S', 'M'], 'Instantaneous', 'A bright streak flashes from your pointing finger to a point you choose within range and then blossoms with a low roar into an explosion of flame.');
```

## Indexing Strategy

### Performance Indexes
```sql
-- Composite indexes for common queries
CREATE INDEX idx_player_level_class ON players (level, class) WHERE is_active = true;
CREATE INDEX idx_dungeon_level_active ON dungeons (min_level, max_level) WHERE is_active = true;
CREATE INDEX idx_session_active_dungeon ON sessions (dungeon_id, status) WHERE ended_at IS NULL;
CREATE INDEX idx_events_session_timestamp ON game_events (session_id, timestamp DESC);

-- Partial indexes for active records
CREATE INDEX idx_active_players ON players (id) WHERE is_active = true;
CREATE INDEX idx_active_dungeons ON dungeons (id) WHERE is_active = true;
CREATE INDEX idx_active_sessions ON sessions (id) WHERE status = 'active';
```

### Full-Text Search
```sql
-- Full-text search on player names and descriptions
CREATE INDEX idx_players_search ON players USING gin(to_tsvector('english', name || ' ' || COALESCE(notes, '')));
CREATE INDEX idx_dungeons_search ON dungeons USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));
CREATE INDEX idx_spells_search ON spells USING gin(to_tsvector('english', name || ' ' || description));
```

## Triggers and Functions

### Update Timestamps
```sql
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to all tables with updated_at
CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON players
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dungeons_updated_at BEFORE UPDATE ON dungeons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
-- ... (repeat for other tables)
```

### Level Up Validation
```sql
CREATE OR REPLACE FUNCTION validate_character_level()
RETURNS TRIGGER AS $$
BEGIN
    -- Ensure proficiency bonus matches level
    NEW.proficiency_bonus = CASE
        WHEN NEW.level BETWEEN 1 AND 4 THEN 2
        WHEN NEW.level BETWEEN 5 AND 8 THEN 3
        WHEN NEW.level BETWEEN 9 AND 12 THEN 4
        WHEN NEW.level BETWEEN 13 AND 16 THEN 5
        WHEN NEW.level BETWEEN 17 AND 20 THEN 6
        ELSE 2
    END;
    
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER validate_player_level BEFORE INSERT OR UPDATE ON players
    FOR EACH ROW EXECUTE FUNCTION validate_character_level();
```