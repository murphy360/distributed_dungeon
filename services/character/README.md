# Character Container Template

This is the base template for creating distributed character containers for the Distributed Dungeon RPG system. Each player character runs in its own Docker container with AI capabilities, real-time communication, and full game integration.

## Features

- **Autonomous AI Character**: Advanced AI for combat and exploration decisions
- **Real-time Communication**: WebSocket and Redis-based event system
- **State Management**: Persistent character state with automatic saving
- **REST API**: Complete API for character management and interaction
- **Docker Ready**: Fully containerized with development and production modes
- **Health Monitoring**: Built-in health checks and monitoring
- **Personality System**: Configurable AI personality traits

## Quick Start

### 1. Clone and Configure

```bash
# Copy the base template
cp -r services/character my-character

# Navigate to your character directory
cd my-character

# Create environment configuration
cp .env.example .env
```

### 2. Customize Your Character

Edit `.env` file:

```bash
# Basic character info
CHARACTER_ID=char-my-unique-id
CHARACTER_NAME=my-character-name
CHARACTER_CLASS=fighter
CHARACTER_LEVEL=1
CHARACTER_PORT=3001  # Use unique port for each character

# AI personality (values from 0.0 to 1.0)
AI_AGGRESSIVENESS=0.7  # Aggressive fighter
AI_CAUTION=0.3         # Low caution
AI_CURIOSITY=0.6       # Moderate curiosity
AI_TACTICAL=0.8        # Highly tactical

# Game system connection
REGISTRY_URL=http://host.docker.internal:3001
GAME_SERVER_URL=http://host.docker.internal:3000
```

### 3. Run Your Character

```bash
# Production mode
docker-compose up -d

# Development mode with hot reload
BUILD_TARGET=development VOLUME_MOUNT_TYPE=rw docker-compose up -d
```

### 4. Verify Character is Running

```bash
# Check health
curl http://localhost:3001/health

# Get character info
curl http://localhost:3001/api/character

# Check logs
docker-compose logs -f character-container
```

## Architecture

### Core Components

1. **CharacterBase** (`src/character/base.js`)
   - Main character logic and state management
   - Event handling and action processing
   - Integration with AI systems

2. **AI Systems** 
   - **CombatAI** (`src/ai/combat.js`) - Combat decision making
   - **ExplorationAI** (`src/ai/exploration.js`) - Exploration and interaction

3. **Communication Layer**
   - **CharacterRegistry** (`src/communication/registry.js`) - Game system registration
   - **EventHandler** (`src/communication/events.js`) - Real-time event processing
   - **CharacterAPI** (`src/communication/api.js`) - REST API server

4. **State Management** (`src/character/state.js`)
   - Persistent character state
   - Automatic saving and loading
   - State validation and recovery

### AI Personality System

Characters have configurable AI personalities that affect decision-making:

- **Aggressiveness** (0.0-1.0): Likelihood to engage in combat
- **Caution** (0.0-1.0): How careful in dangerous situations  
- **Curiosity** (0.0-1.0): Tendency to explore new areas
- **Tactical** (0.0-1.0): Strategic thinking in combat

### Event System

Characters communicate through events:

- **Combat Events**: `combat_turn`, `combat_start`, `combat_end`
- **Exploration Events**: `room_entered`, `item_found`, `trap_triggered`
- **Social Events**: `player_joined`, `message_received`
- **System Events**: `game_state_update`, `health_check`

## API Endpoints

### Character Management

- `GET /health` - Health check
- `GET /api/character` - Get character information
- `POST /api/character/action` - Submit character action
- `GET /api/character/status` - Get detailed status
- `POST /api/character/save` - Force save character state

### AI Controls

- `GET /api/ai/status` - Get AI status
- `POST /api/ai/enable` - Enable AI decision making
- `POST /api/ai/disable` - Disable AI decision making
- `PUT /api/ai/personality` - Update AI personality

### Communication

- `GET /api/connection/status` - Connection status
- `POST /api/connection/reconnect` - Reconnect to game system
- `GET /api/events/history` - Recent event history

## Customization

### Creating Custom Characters

1. **Extend CharacterBase**:

```javascript
// src/character/my-fighter.js
const CharacterBase = require('./base');

class MyFighter extends CharacterBase {
  constructor(config) {
    super({
      ...config,
      class: 'fighter',
      specialAbilities: ['second_wind', 'action_surge']
    });
  }

  // Override specific behaviors
  async onCombatTurn(eventData) {
    // Custom combat logic
    const result = await super.onCombatTurn(eventData);
    
    // Add fighter-specific logic
    if (this.state.state.hp < this.state.state.maxHp * 0.3) {
      result.action = { type: 'second_wind' };
    }
    
    return result;
  }
}
```

2. **Custom AI Behavior**:

```javascript
// src/ai/my-combat-ai.js
const CombatAI = require('./combat');

class MyFighterCombatAI extends CombatAI {
  async decideCombatAction(character, gameState, availableActions) {
    // Custom AI logic for fighters
    
    // Use shield bash if enemy is close
    if (this.isEnemyAdjacent(gameState)) {
      return { type: 'shield_bash', target: this.getNearestEnemy(gameState) };
    }
    
    // Fall back to base AI
    return super.decideCombatAction(character, gameState, availableActions);
  }
}
```

3. **Update Main Application**:

```javascript
// src/index.js
const MyFighter = require('./character/my-fighter');
const MyFighterCombatAI = require('./ai/my-combat-ai');

// In initializeCharacter()
this.character = new MyFighter(this.config);

// In initializeAI()
this.combatAI = new MyFighterCombatAI(this.config.aiConfig);
```

## Development

### Running in Development Mode

```bash
# Enable hot reload and development features
BUILD_TARGET=development VOLUME_MOUNT_TYPE=rw docker-compose up
```

### Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Test specific component
npm test -- --grep "CombatAI"
```

### Debugging

```bash
# View logs
docker-compose logs -f character-container

# Access container shell
docker-compose exec character-container sh

# Debug with Node inspector
NODE_OPTIONS="--inspect=0.0.0.0:9229" npm run dev
```

## Deployment

### Production Deployment

1. **Build Production Image**:

```bash
docker build -t my-character:latest --target production .
```

2. **Deploy with Docker Compose**:

```bash
NODE_ENV=production docker-compose up -d
```

3. **Scale Multiple Characters**:

```bash
# Deploy multiple character instances
for i in {1..3}; do
  CHARACTER_NAME=fighter-$i CHARACTER_PORT=$((3000+i)) docker-compose up -d
done
```

### Monitoring

- Health checks run every 30 seconds
- Automatic container restart on failure
- Persistent character state survives container restarts
- Log rotation and management
- Resource usage monitoring

## Integration with Main Game System

### Character Registry

Characters automatically register with the main game system on startup:

1. Container starts and initializes character
2. Registers with Character Registry service
3. Receives authentication token and session ID
4. Connects to event system for real-time communication
5. Begins participating in game events

### Game Events

Characters respond to various game events:

- **Combat Rounds**: AI makes combat decisions
- **Exploration**: AI decides movement and interactions
- **Social Interactions**: Responds to other players
- **Environmental Changes**: Reacts to game world updates

## Troubleshooting

### Common Issues

1. **Port Conflicts**: Ensure each character uses a unique port
2. **Network Issues**: Verify `dungeon-network` exists (`docker network create dungeon-network`)
3. **Registry Connection**: Check that main game system is running
4. **Redis Connection**: Verify Redis is accessible at configured URL

### Debug Commands

```bash
# Check container status
docker-compose ps

# View character logs
docker-compose logs character-container

# Test API connectivity
curl http://localhost:3001/health

# Check Redis connection
redis-cli -h localhost -p 6380 ping
```

### Environment Variables

Key environment variables for troubleshooting:

- `LOG_LEVEL=debug` - Enable debug logging
- `NODE_ENV=development` - Development mode
- `REGISTRY_URL` - Game system registry URL
- `REDIS_URL` - Redis connection string

## Contributing

1. Fork the repository
2. Create your feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## License

This project is part of the Distributed Dungeon RPG system. See the main project LICENSE file for details.