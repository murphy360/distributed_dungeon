-- Distributed Dungeon Database Initialization Script
-- This script creates the complete database schema for the RPG system

BEGIN;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ===========================================
-- USERS AND AUTHENTICATION
-- ===========================================

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
    settings JSONB DEFAULT '{}'
);

CREATE INDEX idx_users_username ON users (username);
CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_users_role ON users (role);
CREATE INDEX idx_users_active ON users (is_active);

-- ===========================================
-- CORE GAME DATA
-- ===========================================

-- Skills table
CREATE TABLE skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    ability_score VARCHAR(20) NOT NULL CHECK (
        ability_score IN ('strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma')
    ),
    description TEXT
);

CREATE INDEX idx_skills_name ON skills (name);
CREATE INDEX idx_skills_ability ON skills (ability_score);

-- Spells table
CREATE TABLE spells (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    level INTEGER CHECK (level >= 0 AND level <= 9),
    school VARCHAR(50) NOT NULL,
    casting_time VARCHAR(100) NOT NULL,
    range VARCHAR(100) NOT NULL,
    components VARCHAR(20)[] NOT NULL,
    duration VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    higher_level TEXT,
    ritual BOOLEAN DEFAULT false,
    concentration BOOLEAN DEFAULT false
);

CREATE INDEX idx_spells_name ON spells (name);
CREATE INDEX idx_spells_level ON spells (level);
CREATE INDEX idx_spells_school ON spells (school);

-- ===========================================
-- PLAYER CHARACTERS
-- ===========================================

-- Players table (Character sheets)
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
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_players_user_id ON players (user_id);
CREATE INDEX idx_players_level ON players (level);
CREATE INDEX idx_players_class ON players (class);
CREATE INDEX idx_players_is_npc ON players (is_npc);
CREATE INDEX idx_players_is_active ON players (is_active);

-- Player skills junction table
CREATE TABLE player_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
    proficient BOOLEAN DEFAULT false,
    expertise BOOLEAN DEFAULT false,
    custom_modifier INTEGER DEFAULT 0,
    UNIQUE (player_id, skill_id)
);

CREATE INDEX idx_player_skills_player_id ON player_skills (player_id);
CREATE INDEX idx_player_skills_skill_id ON player_skills (skill_id);

-- Player spells junction table
CREATE TABLE player_spells (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    spell_id UUID REFERENCES spells(id) ON DELETE CASCADE,
    prepared BOOLEAN DEFAULT false,
    always_prepared BOOLEAN DEFAULT false,
    spell_slots_used INTEGER DEFAULT 0,
    UNIQUE (player_id, spell_id)
);

CREATE INDEX idx_player_spells_player_id ON player_spells (player_id);
CREATE INDEX idx_player_spells_spell_id ON player_spells (spell_id);
CREATE INDEX idx_player_spells_prepared ON player_spells (prepared);

-- ===========================================
-- DUNGEONS AND GAME SESSIONS
-- ===========================================

-- Dungeons table
CREATE TABLE dungeons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    min_level INTEGER DEFAULT 1 CHECK (min_level >= 1),
    max_level INTEGER DEFAULT 20 CHECK (max_level <= 20),
    max_players INTEGER DEFAULT 6 CHECK (max_players >= 1),
    is_active BOOLEAN DEFAULT true,
    
    settings JSONB DEFAULT '{
        "allowPvP": false,
        "respawnEnabled": true,
        "difficultyModifier": 1.0,
        "experienceModifier": 1.0
    }',
    
    custom_rules JSONB DEFAULT '[]',
    map_data JSONB,
    rooms JSONB DEFAULT '[]',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id),
    
    CHECK (max_level >= min_level)
);

CREATE INDEX idx_dungeons_active ON dungeons (is_active);
CREATE INDEX idx_dungeons_level_range ON dungeons (min_level, max_level);
CREATE INDEX idx_dungeons_created_by ON dungeons (created_by);

-- Dungeon players junction table
CREATE TABLE dungeon_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dungeon_id UUID REFERENCES dungeons(id) ON DELETE CASCADE,
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'active' CHECK (
        status IN ('active', 'inactive', 'kicked', 'left')
    ),
    position JSONB,
    UNIQUE (dungeon_id, player_id)
);

CREATE INDEX idx_dungeon_players_dungeon_id ON dungeon_players (dungeon_id);
CREATE INDEX idx_dungeon_players_player_id ON dungeon_players (player_id);
CREATE INDEX idx_dungeon_players_status ON dungeon_players (status);

-- Game sessions table
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
    
    settings JSONB DEFAULT '{
        "autoResolveSimpleCombat": false,
        "allowPlayerInitiative": true,
        "logAllActions": true
    }',
    
    current_turn UUID,
    combat_round INTEGER DEFAULT 0,
    initiative_order JSONB DEFAULT '[]',
    
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_dungeon_id ON sessions (dungeon_id);
CREATE INDEX idx_sessions_dm_id ON sessions (dm_id);
CREATE INDEX idx_sessions_status ON sessions (status);
CREATE INDEX idx_sessions_active ON sessions (status, ended_at);

-- ===========================================
-- MONSTERS
-- ===========================================

-- Monster templates
CREATE TABLE monster_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    size VARCHAR(20) NOT NULL,
    challenge_rating DECIMAL(4,2) NOT NULL,
    
    armor_class INTEGER NOT NULL,
    hit_points_dice VARCHAR(20) NOT NULL,
    hit_points_average INTEGER NOT NULL,
    speed JSONB NOT NULL,
    
    strength INTEGER NOT NULL DEFAULT 10,
    dexterity INTEGER NOT NULL DEFAULT 10,
    constitution INTEGER NOT NULL DEFAULT 10,
    intelligence INTEGER NOT NULL DEFAULT 10,
    wisdom INTEGER NOT NULL DEFAULT 10,
    charisma INTEGER NOT NULL DEFAULT 10,
    
    saving_throws JSONB DEFAULT '{}',
    skills JSONB DEFAULT '{}',
    damage_resistances VARCHAR(255)[],
    damage_immunities VARCHAR(255)[],
    condition_immunities VARCHAR(255)[],
    senses VARCHAR(255)[],
    languages VARCHAR(255)[],
    
    actions JSONB NOT NULL DEFAULT '[]',
    legendary_actions JSONB DEFAULT '[]',
    special_abilities JSONB DEFAULT '[]',
    
    ai_personality JSONB DEFAULT '{
        "aggression": 0.5,
        "intelligence": 0.5,
        "loyalty": 0.5,
        "fearThreshold": 0.3
    }',
    ai_prompts JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_monster_templates_name ON monster_templates (name);
CREATE INDEX idx_monster_templates_type ON monster_templates (type);
CREATE INDEX idx_monster_templates_cr ON monster_templates (challenge_rating);
CREATE INDEX idx_monster_templates_size ON monster_templates (size);

-- Monster instances
CREATE TABLE monster_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES monster_templates(id) ON DELETE CASCADE,
    dungeon_id UUID REFERENCES dungeons(id) ON DELETE CASCADE,
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    
    name VARCHAR(100),
    hp_current INTEGER NOT NULL,
    hp_maximum INTEGER NOT NULL,
    position JSONB,
    status VARCHAR(20) DEFAULT 'active' CHECK (
        status IN ('active', 'defeated', 'fled', 'hidden')
    ),
    
    conditions JSONB DEFAULT '[]',
    temporary_modifiers JSONB DEFAULT '{}',
    
    ai_memory JSONB DEFAULT '{}',
    last_ai_action TIMESTAMP WITH TIME ZONE,
    
    spawned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    defeated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_monster_instances_template_id ON monster_instances (template_id);
CREATE INDEX idx_monster_instances_dungeon_id ON monster_instances (dungeon_id);
CREATE INDEX idx_monster_instances_session_id ON monster_instances (session_id);
CREATE INDEX idx_monster_instances_status ON monster_instances (status);

-- ===========================================
-- GAME EVENTS AND LOGGING
-- ===========================================

CREATE TABLE game_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    
    player_id UUID REFERENCES players(id),
    monster_id UUID REFERENCES monster_instances(id),
    target_player_id UUID REFERENCES players(id),
    target_monster_id UUID REFERENCES monster_instances(id),
    
    action_type VARCHAR(50),
    data JSONB NOT NULL DEFAULT '{}',
    result JSONB DEFAULT '{}',
    
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    turn_number INTEGER,
    round_number INTEGER
);

CREATE INDEX idx_game_events_session_id ON game_events (session_id);
CREATE INDEX idx_game_events_type ON game_events (event_type);
CREATE INDEX idx_game_events_player_id ON game_events (player_id);
CREATE INDEX idx_game_events_timestamp ON game_events (timestamp);
CREATE INDEX idx_game_events_turn_round ON game_events (turn_number, round_number);

-- ===========================================
-- RULES SYSTEM
-- ===========================================

CREATE TABLE rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(50) NOT NULL,
    type VARCHAR(50) NOT NULL,
    scope VARCHAR(20) DEFAULT 'global' CHECK (
        scope IN ('global', 'dungeon', 'session')
    ),
    
    description TEXT NOT NULL,
    implementation JSONB NOT NULL,
    conditions JSONB DEFAULT '[]',
    
    parent_rule_id UUID REFERENCES rules(id),
    priority INTEGER DEFAULT 0,
    
    dungeon_id UUID REFERENCES dungeons(id),
    
    is_active BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_rules_category ON rules (category);
CREATE INDEX idx_rules_type ON rules (type);
CREATE INDEX idx_rules_scope ON rules (scope);
CREATE INDEX idx_rules_dungeon_id ON rules (dungeon_id);
CREATE INDEX idx_rules_priority ON rules (priority);
CREATE INDEX idx_rules_active ON rules (is_active);

-- ===========================================
-- FUNCTIONS AND TRIGGERS
-- ===========================================

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply timestamp triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_players_updated_at BEFORE UPDATE ON players
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dungeons_updated_at BEFORE UPDATE ON dungeons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rules_updated_at BEFORE UPDATE ON rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Character level validation function
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

-- ===========================================
-- PERFORMANCE INDEXES
-- ===========================================

-- Composite indexes for common queries
CREATE INDEX idx_player_level_class ON players (level, class) WHERE is_active = true;
CREATE INDEX idx_dungeon_level_active ON dungeons (min_level, max_level) WHERE is_active = true;
CREATE INDEX idx_session_active_dungeon ON sessions (dungeon_id, status) WHERE ended_at IS NULL;
CREATE INDEX idx_events_session_timestamp ON game_events (session_id, timestamp DESC);

-- Partial indexes for active records
CREATE INDEX idx_active_players ON players (id) WHERE is_active = true;
CREATE INDEX idx_active_dungeons ON dungeons (id) WHERE is_active = true;
CREATE INDEX idx_active_sessions ON sessions (id) WHERE status = 'active';

-- Full-text search indexes
CREATE INDEX idx_players_search ON players USING gin(to_tsvector('english', name || ' ' || COALESCE(notes, '')));
CREATE INDEX idx_dungeons_search ON dungeons USING gin(to_tsvector('english', name || ' ' || COALESCE(description, '')));
CREATE INDEX idx_spells_search ON spells USING gin(to_tsvector('english', name || ' ' || description));

COMMIT;

-- Create a sample session first, then log initialization
DO $$
DECLARE
    session_uuid UUID := gen_random_uuid();
    user_uuid UUID := gen_random_uuid();
    dungeon_uuid UUID := gen_random_uuid();
BEGIN
    -- Insert a sample user first
    INSERT INTO users (id, username, email, password_hash, role) 
    VALUES (user_uuid, 'system', 'system@distributeddungeon.com', 'system', 'admin');
    
    -- Insert a sample dungeon first
    INSERT INTO dungeons (id, name, description, min_level, max_level, max_players, created_by) 
    VALUES (dungeon_uuid, 'System Initialization Dungeon', 'Initial system setup dungeon', 1, 20, 6, user_uuid);
    
    -- Insert a sample session
    INSERT INTO sessions (id, dungeon_id, dm_id, status, mode) 
    VALUES (session_uuid, dungeon_uuid, user_uuid, 'active', 'manual');
    
    -- Log successful initialization
    INSERT INTO game_events (session_id, event_type, data) 
    VALUES (session_uuid, 'database_initialized', '{"message": "Database schema created successfully", "version": "1.0.0"}');
END $$;