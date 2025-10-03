# API Specifications

## Overview

This document defines the REST API contracts for all services in the Distributed Dungeon system. All APIs follow RESTful conventions and return JSON responses.

## Common Response Formats

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation completed successfully",
  "timestamp": "2025-10-03T12:00:00Z"
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid character level",
    "details": { ... }
  },
  "timestamp": "2025-10-03T12:00:00Z"
}
```

## Player Service API

### Base URL: `http://player-service:3004/api`

#### Character Management

##### Create Character
```http
POST /players
Content-Type: application/json

{
  "name": "Aragorn",
  "class": "Ranger",
  "race": "Human",
  "level": 1,
  "background": "Folk Hero",
  "stats": {
    "strength": 16,
    "dexterity": 18,
    "constitution": 14,
    "intelligence": 12,
    "wisdom": 15,
    "charisma": 13
  },
  "hitPoints": {
    "current": 12,
    "maximum": 12,
    "temporary": 0
  },
  "isNPC": false,
  "ownerId": "user-uuid"
}
```

##### Get Character
```http
GET /players/{playerId}
```

##### Update Character
```http
PUT /players/{playerId}
Content-Type: application/json

{
  "level": 2,
  "hitPoints": {
    "current": 20,
    "maximum": 20
  }
}
```

##### Delete Character
```http
DELETE /players/{playerId}
```

#### Skills Management

##### Add Skill to Character
```http
POST /players/{playerId}/skills
Content-Type: application/json

{
  "name": "Stealth",
  "proficient": true,
  "expertise": false,
  "customModifier": 0
}
```

##### Update Character Skill
```http
PUT /players/{playerId}/skills/{skillId}
Content-Type: application/json

{
  "proficient": true,
  "expertise": true,
  "customModifier": 2
}
```

##### Remove Skill from Character
```http
DELETE /players/{playerId}/skills/{skillId}
```

#### Spells Management

##### Add Spell to Character
```http
POST /players/{playerId}/spells
Content-Type: application/json

{
  "name": "Cure Light Wounds",
  "level": 1,
  "school": "Evocation",
  "castingTime": "1 action",
  "range": "Touch",
  "components": ["V", "S"],
  "duration": "Instantaneous",
  "description": "A creature you touch regains hit points equal to 1d8 + your spellcasting ability modifier.",
  "prepared": true
}
```

##### Cast Spell
```http
POST /players/{playerId}/spells/{spellId}/cast
Content-Type: application/json

{
  "targetId": "target-player-id",
  "spellSlotLevel": 1,
  "upcasting": false
}
```

## Dungeon Service API

### Base URL: `http://dungeon-service:3002/api`

#### Dungeon Management

##### Create Dungeon
```http
POST /dungeons
Content-Type: application/json

{
  "name": "The Forgotten Catacombs",
  "description": "Ancient underground burial chambers filled with undead",
  "minLevel": 3,
  "maxLevel": 7,
  "maxPlayers": 6,
  "isActive": true,
  "settings": {
    "allowPvP": false,
    "respawnEnabled": true,
    "difficultyModifier": 1.2,
    "experienceModifier": 1.0
  },
  "customRules": [
    {
      "name": "Necromantic Aura",
      "description": "All healing spells are reduced by 50%",
      "type": "healing_modifier",
      "value": 0.5
    }
  ]
}
```

##### Get Dungeon Details
```http
GET /dungeons/{dungeonId}
```

##### Update Dungeon
```http
PUT /dungeons/{dungeonId}
```

##### Join Dungeon
```http
POST /dungeons/{dungeonId}/players
Content-Type: application/json

{
  "playerId": "player-uuid"
}
```

##### Leave Dungeon
```http
DELETE /dungeons/{dungeonId}/players/{playerId}
```

##### Get Dungeon Players
```http
GET /dungeons/{dungeonId}/players
```

## Monster Service API

### Base URL: `http://monster-service:3003/api`

#### Monster Management

##### Create Monster Template
```http
POST /monsters/templates
Content-Type: application/json

{
  "name": "Goblin Warrior",
  "type": "humanoid",
  "size": "Small",
  "challengeRating": 0.25,
  "armorClass": 15,
  "hitPoints": {
    "dice": "2d6",
    "modifier": 0
  },
  "speed": {
    "walk": 30,
    "climb": 0,
    "fly": 0,
    "swim": 0
  },
  "stats": {
    "strength": 8,
    "dexterity": 14,
    "constitution": 10,
    "intelligence": 10,
    "wisdom": 8,
    "charisma": 8
  },
  "skills": ["Stealth"],
  "senses": ["Darkvision 60 ft"],
  "languages": ["Common", "Goblin"],
  "actions": [
    {
      "name": "Scimitar",
      "type": "melee",
      "attackBonus": 4,
      "damage": "1d6+2",
      "damageType": "slashing"
    }
  ],
  "aiPersonality": {
    "aggression": 0.7,
    "intelligence": 0.4,
    "loyalty": 0.6,
    "fearThreshold": 0.3
  }
}
```

##### Spawn Monster Instance
```http
POST /monsters/instances
Content-Type: application/json

{
  "templateId": "goblin-warrior-template-id",
  "dungeonId": "dungeon-uuid",
  "position": {
    "x": 10,
    "y": 5,
    "z": 0
  },
  "customModifiers": {
    "hitPointsBonus": 5,
    "damageBonus": 2
  }
}
```

##### Get Monster AI Response
```http
POST /monsters/instances/{monsterId}/ai-action
Content-Type: application/json

{
  "gameState": {
    "players": [...],
    "environment": {...},
    "lastAction": "Player attacked with sword"
  },
  "contextPrompt": "The goblin is cornered and wounded"
}
```

## Dungeon Master Service API

### Base URL: `http://dungeon-master-service:3001/api`

#### Session Management

##### Create Game Session
```http
POST /sessions
Content-Type: application/json

{
  "dungeonId": "dungeon-uuid",
  "dmId": "dm-user-uuid",
  "mode": "manual",
  "settings": {
    "autoResolveSimpleCombat": false,
    "allowPlayerInitiative": true,
    "logAllActions": true
  }
}
```

##### Get Session Status
```http
GET /sessions/{sessionId}
```

##### End Session
```http
DELETE /sessions/{sessionId}
```

#### Player Monitoring

##### Get All Players in Dungeon
```http
GET /dungeons/{dungeonId}/players/detailed
```

##### Override Player Stats (DM Only)
```http
PATCH /players/{playerId}/dm-override
Content-Type: application/json
Authorization: Bearer {dm-jwt-token}

{
  "temporaryModifiers": {
    "strength": 2,
    "hitPoints": -10,
    "armorClass": 1
  },
  "conditions": ["blessed", "poisoned"],
  "reason": "Divine intervention and poison trap"
}
```

##### Force Player Action
```http
POST /players/{playerId}/force-action
Content-Type: application/json
Authorization: Bearer {dm-jwt-token}

{
  "action": "move",
  "parameters": {
    "position": { "x": 15, "y": 20 },
    "reason": "Teleportation trap"
  }
}
```

## Rules Engine Service API

### Base URL: `http://rules-engine:3006/api`

#### Rule Processing

##### Validate Action
```http
POST /validate-action
Content-Type: application/json

{
  "playerId": "player-uuid",
  "action": {
    "type": "attack",
    "weapon": "longsword",
    "target": "monster-uuid"
  },
  "gameState": {
    "dungeonId": "dungeon-uuid",
    "currentTurn": "player-uuid",
    "combatRound": 3
  }
}
```

##### Calculate Skill Check
```http
POST /skill-check
Content-Type: application/json

{
  "playerId": "player-uuid",
  "skill": "stealth",
  "difficulty": 15,
  "advantage": false,
  "disadvantage": false,
  "customModifiers": [
    {
      "name": "Magic Item Bonus",
      "value": 2
    }
  ]
}
```

##### Calculate Combat
```http
POST /combat/calculate
Content-Type: application/json

{
  "attacker": {
    "id": "player-uuid",
    "type": "player",
    "weapon": "longsword",
    "attackBonus": 5
  },
  "defender": {
    "id": "monster-uuid",
    "type": "monster",
    "armorClass": 16,
    "hitPoints": 25
  },
  "conditions": {
    "surprise": false,
    "flanking": true,
    "cover": "none"
  }
}
```

## Communication Service API

### Base URL: `http://communication-service:3005/api`

#### Message Routing

##### Send Message to Channel
```http
POST /messages/send
Content-Type: application/json

{
  "channel": "discord",
  "channelId": "discord-channel-id",
  "message": {
    "type": "game_action",
    "content": "Aragorn attacks the goblin with his longsword!",
    "metadata": {
      "playerId": "player-uuid",
      "dungeonId": "dungeon-uuid",
      "actionType": "attack"
    }
  }
}
```

##### Broadcast Event
```http
POST /events/broadcast
Content-Type: application/json

{
  "event": "combat_started",
  "dungeonId": "dungeon-uuid",
  "data": {
    "participants": ["player1", "player2", "monster1"],
    "initiative": [
      { "id": "player1", "initiative": 18 },
      { "id": "monster1", "initiative": 12 },
      { "id": "player2", "initiative": 8 }
    ]
  },
  "channels": ["discord", "meshtastic"]
}
```

## WebSocket Events

### Real-time Game Events

#### Connection
```javascript
// Connect to game session
const ws = new WebSocket('ws://dungeon-master-service:3001/ws');

// Authentication
ws.send(JSON.stringify({
  type: 'auth',
  token: 'jwt-token',
  dungeonId: 'dungeon-uuid'
}));
```

#### Event Types
```javascript
// Player action
{
  type: 'player_action',
  playerId: 'uuid',
  action: 'attack',
  target: 'monster-uuid',
  result: { damage: 8, hit: true }
}

// Game state update
{
  type: 'game_state_update',
  dungeonId: 'uuid',
  changes: {
    player_health: { 'player1': 25, 'player2': 18 },
    monster_status: { 'monster1': 'defeated' }
  }
}

// Chat message
{
  type: 'chat_message',
  sender: 'player-name',
  message: 'I cast fireball!',
  channel: 'game'
}
```

## Rate Limiting

All APIs implement rate limiting:
- **Player Actions**: 10 requests per minute per player
- **DM Actions**: 100 requests per minute per DM
- **Monster AI**: 5 requests per minute per monster
- **Chat Messages**: 30 messages per minute per user

## Authentication

### JWT Token Format
```json
{
  "sub": "user-uuid",
  "role": "player|dm|admin",
  "dungeonId": "dungeon-uuid",
  "permissions": ["read_character", "write_character", "cast_spell"],
  "exp": 1735689600,
  "iat": 1735603200
}
```

### API Key Format (Service-to-Service)
```http
Authorization: Bearer service-api-key-here
X-Service-Name: dungeon-master-service
X-Request-ID: unique-request-uuid
```