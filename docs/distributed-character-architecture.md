# Distributed Character Container Architecture

## Overview
This document describes the architecture for distributing individual player characters into separate Docker containers, enabling players to build, customize, and deploy their own character containers that interact with the main Distributed Dungeon system.

## Core Concepts

### Character Container Independence
- Each player character runs in its own isolated Docker container
- Characters maintain their own state, abilities, and behavior logic
- Players can customize their character's AI, decision-making, and automation
- Characters can be deployed anywhere and connect to game sessions remotely

### Communication Architecture
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Dungeon       │◄──►│   Character      │◄──►│  Other Game     │
│   Master        │    │   Registry       │    │  Services       │
│   Service       │    │   Service        │    │  (Monster, etc) │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         ▲                        ▲                       ▲
         │                        │                       │
         ▼                        ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Game Event Bus (Redis)                      │
└─────────────────────────────────────────────────────────────────┘
         ▲                        ▲                       ▲
         │                        │                       │
         ▼                        ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Character     │    │   Character     │    │   Character     │
│   Container 1   │    │   Container 2   │    │   Container N   │
│   (Fighter)     │    │   (Wizard)      │    │   (Rogue)       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Character Container Specification

### Base Character Container Features
1. **Character State Management**
   - Health, mana, inventory, abilities
   - Persistent state storage (volume-mounted)
   - State synchronization with game services

2. **Action Processing Engine**
   - Combat actions (attack, defend, cast spell)
   - Movement and exploration
   - Social interactions and dialogue

3. **AI/Automation Layer**
   - Decision-making algorithms
   - Behavior patterns and strategies
   - Player-customizable automation scripts

4. **Communication Interface**
   - REST API for game interactions
   - WebSocket for real-time events
   - Event bus integration (Redis pub/sub)

### Container Structure
```
character-container/
├── src/
│   ├── character/           # Character logic and state
│   │   ├── base.js         # Base character class
│   │   ├── state.js        # State management
│   │   └── abilities.js    # Character abilities
│   ├── ai/                 # AI and automation
│   │   ├── decision.js     # Decision engine
│   │   ├── combat.js       # Combat AI
│   │   └── exploration.js  # Exploration AI
│   ├── communication/      # Game communication
│   │   ├── api.js          # REST endpoints
│   │   ├── events.js       # Event handling
│   │   └── registry.js     # Service registration
│   └── index.js           # Main application
├── config/
│   ├── character.json     # Character configuration
│   └── abilities.json     # Abilities definition
├── data/                  # Persistent character data
├── Dockerfile
├── docker-compose.yml
└── package.json
```

## Character Registration Protocol

### Registration Flow
1. Character container starts and loads configuration
2. Container registers with Character Registry Service
3. Registry validates character and assigns session
4. Character receives game state and available actions
5. Character begins processing game events

### Registration API
```javascript
// Character Registration Request
POST /api/registry/character
{
  "characterId": "unique-character-id",
  "name": "Thorin Ironbeard",
  "class": "fighter",
  "level": 5,
  "containerEndpoint": "http://character-container:3000",
  "capabilities": ["combat", "exploration", "social"],
  "version": "1.0.0"
}

// Registry Response
{
  "sessionId": "game-session-123",
  "characterToken": "jwt-token-for-auth",
  "gameState": { /* current game state */ },
  "eventChannels": ["combat", "exploration", "social"]
}
```

## Event-Driven Communication

### Game Events
Character containers subscribe to relevant game events:
- **Combat Events**: Initiative, attacks, damage, healing
- **Exploration Events**: Movement, discoveries, traps
- **Social Events**: Dialogue, negotiations, interactions
- **System Events**: State changes, errors, notifications

### Character Actions
Containers can trigger actions in the game:
```javascript
// Combat Action
{
  "type": "combat.attack",
  "characterId": "thorin-ironbeard",
  "target": "goblin-1",
  "weapon": "battle-axe",
  "timestamp": "2025-10-03T22:45:00Z"
}

// Exploration Action
{
  "type": "exploration.move",
  "characterId": "thorin-ironbeard",
  "direction": "north",
  "cautious": true
}
```

## Data Persistence Strategy

### Character Data Storage
- Each character container has a persistent volume
- State saved to JSON files and SQLite database
- Automatic backups and state snapshots
- Character data portable between deployments

### Shared Game State
- Core game state maintained by Dungeon Master
- Characters receive state updates via events
- Optimistic updates with conflict resolution
- Eventually consistent distributed state

## Security Model

### Authentication & Authorization
- JWT tokens for character authentication
- API key validation for container registration
- Rate limiting and request validation
- Secure communication channels (TLS)

### Container Isolation
- Network policies for container communication
- Resource limits and quotas
- Sandboxed execution environment
- No direct database access from character containers

## Development & Deployment

### Character Container SDK
Players can use a base SDK to build character containers:
```javascript
const { CharacterBase, CombatAI, ExplorationAI } = require('@distributed-dungeon/character-sdk');

class MyFighter extends CharacterBase {
  constructor(config) {
    super(config);
    this.combatAI = new CombatAI({ aggressive: true });
    this.explorationAI = new ExplorationAI({ cautious: false });
  }
  
  async onCombatTurn(gameState) {
    return this.combatAI.decideCombatAction(gameState);
  }
}
```

### Deployment Options
1. **Local Development**: Docker Compose with multiple character containers
2. **Distributed Deployment**: Characters deployed on different machines
3. **Cloud Deployment**: Characters as cloud containers (AWS ECS, Azure Container Instances)
4. **Edge Deployment**: Characters running on player's devices

## Benefits

### For Players
- Full control over character behavior and AI
- Ability to customize and extend character logic
- Portable characters across different game sessions
- Learning opportunity for programming and AI

### For Game Masters
- Scalable player management
- Reduced server load (distributed processing)
- Enhanced game dynamics with unique character behaviors
- Easy integration of new character types

### For Developers
- Modular, microservices architecture
- Clear separation of concerns
- Easier testing and debugging
- Community-driven character development

## Implementation Phases

### Phase 1: Core Infrastructure
- Character Registry Service
- Base Character Container Template
- Communication protocols and APIs

### Phase 2: Game Integration
- Update existing services for distributed characters
- Event bus implementation
- State synchronization

### Phase 3: Character SDK
- Development toolkit for players
- Example character implementations
- Documentation and tutorials

### Phase 4: Advanced Features
- Character marketplace
- AI behavior sharing
- Advanced automation tools
- Performance monitoring and optimization