# Distributed Character Containers

Welcome to the Distributed Character Container system for Distributed Dungeon RPG! This revolutionary architecture allows each player character to run in its own Docker container with autonomous AI, enabling a truly distributed gaming experience where players can develop, customize, and deploy their own characters independently.

## 🚀 Quick Start

### 1. Set Up the Base System

First, ensure the main Distributed Dungeon system is running:

```bash
# In the main project directory
cd distributed_dungeon
docker-compose up -d
```

### 2. Create Your First Character

```bash
# Copy the base character template
cp -r character-containers/base-character character-containers/my-fighter

# Navigate to your character directory
cd character-containers/my-fighter

# Configure your character
cp .env.example .env
# Edit .env with your character details

# Run your character
docker-compose up -d
```

### 3. Verify Your Character is Active

```bash
# Check character health
curl http://localhost:3000/health

# Get character information
curl http://localhost:3000/api/character

# View logs
docker-compose logs -f character-container
```

## 🏗️ Architecture Overview

### Distributed Design

Each character container is a fully autonomous microservice that:

- **Runs Independently**: Characters operate in separate Docker containers
- **Autonomous AI**: Makes combat and exploration decisions automatically
- **Real-time Communication**: Connects to the game system via WebSocket and Redis
- **Persistent State**: Maintains character data across restarts
- **RESTful API**: Provides complete character management interface

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                   Game System (Main)                        │
├─────────────────┬─────────────────┬─────────────────────────┤
│  Dungeon Master │     Dungeon     │    Communication        │
│    Service      │    Service      │      Service            │
├─────────────────┼─────────────────┼─────────────────────────┤
│  Player Service │  Monster Service│   Rules Engine          │
└─────────────────┴─────────────────┴─────────────────────────┘
                            │
                    ┌───────┴───────┐
                    │   Character   │
                    │   Registry    │
                    └───────┬───────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼──────┐   ┌────────▼──────┐   ┌────────▼──────┐
│  Character   │   │  Character    │   │  Character    │
│ Container #1 │   │ Container #2  │   │ Container #3  │
│   (Fighter)  │   │   (Wizard)    │   │   (Rogue)     │
└──────────────┘   └───────────────┘   └───────────────┘
```

## 📁 Directory Structure

```
character-containers/
├── base-character/              # Base character template
│   ├── src/
│   │   ├── character/          # Character core logic
│   │   │   ├── base.js         # Base character class
│   │   │   └── state.js        # State management
│   │   ├── ai/                 # AI decision systems
│   │   │   ├── combat.js       # Combat AI
│   │   │   └── exploration.js  # Exploration AI
│   │   ├── communication/      # Communication layer
│   │   │   ├── registry.js     # Game registration
│   │   │   ├── events.js       # Event handling
│   │   │   └── api.js          # REST API
│   │   └── index.js           # Main application
│   ├── Dockerfile             # Container configuration
│   ├── docker-compose.yml     # Docker Compose setup
│   └── package.json           # Dependencies
├── example-fighter/           # Example Fighter character
└── docs/                     # Documentation
```

## 🤖 AI System

### Personality Configuration

Each character has configurable AI personality traits:

```javascript
// AI Personality (values 0.0 to 1.0)
AI_AGGRESSIVENESS=0.7  // Combat engagement tendency
AI_CAUTION=0.4         // Risk assessment behavior
AI_CURIOSITY=0.6       // Exploration motivation
AI_TACTICAL=0.8        // Strategic thinking level
```

### AI Decision Making

#### Combat AI
- Analyzes threat levels and enemy capabilities
- Considers character class abilities and resources
- Makes tactical decisions based on personality
- Coordinates with allies through event system

#### Exploration AI
- Navigates dungeons intelligently
- Searches for secrets and treasure
- Manages resources (health, spells, items)
- Responds to environmental hazards

### AI Event Flow

```
Game Event → Character Container → AI Analysis → Decision → Action Response
     ↓              ↓                    ↓           ↓            ↓
combat_turn → CombatAI.decide() → assess_threat → select_action → attack
```

## 🔌 Communication System

### Event Types

Characters communicate through a rich event system:

#### Combat Events
- `combat_turn` - Process combat round
- `combat_start` - Initialize combat state
- `combat_end` - Clean up after combat
- `damage_taken` - React to damage
- `ally_down` - Respond to ally defeat

#### Exploration Events
- `room_entered` - Process new room
- `item_found` - Handle item discovery
- `trap_triggered` - React to traps
- `secret_discovered` - Process secret areas
- `rest_opportunity` - Decide on resting

#### Social Events
- `player_joined` - Welcome new players
- `message_received` - Process chat messages
- `trade_request` - Handle item trading
- `alliance_proposed` - Consider alliances

### Real-time Communication

```javascript
// WebSocket connection for real-time events
socket.on('combat_turn', async (eventData) => {
  const decision = await character.processEvent(eventData);
  socket.emit('action_response', decision);
});

// Redis pub/sub for distributed messaging
redis.subscribe('game_events');
redis.on('message', (channel, message) => {
  character.handleEvent(JSON.parse(message));
});
```

## 🛠️ Character Development

### Creating Custom Characters

#### 1. Extend Base Character

```javascript
// src/character/my-custom-character.js
const CharacterBase = require('./base');

class MyCustomCharacter extends CharacterBase {
  constructor(config) {
    super({
      ...config,
      class: 'my_class',
      specialAbilities: ['custom_ability_1', 'custom_ability_2']
    });
  }

  async onCombatTurn(eventData) {
    // Custom combat behavior
    if (this.shouldUseSpecialAbility(eventData)) {
      return this.useSpecialAbility(eventData);
    }
    return super.onCombatTurn(eventData);
  }
}
```

#### 2. Custom AI Behavior

```javascript
// src/ai/my-custom-ai.js
const CombatAI = require('./combat');

class MyCustomAI extends CombatAI {
  async decideCombatAction(character, gameState, availableActions) {
    // Custom AI logic
    if (this.detectSpecialCondition(gameState)) {
      return this.executeSpecialStrategy(character, gameState);
    }
    return super.decideCombatAction(character, gameState, availableActions);
  }
}
```

#### 3. Update Container Configuration

```javascript
// src/index.js - Override initialization methods
class MyCustomContainer extends CharacterContainer {
  async initializeCharacter() {
    this.character = new MyCustomCharacter(this.config);
    // Additional setup...
  }

  async initializeAI() {
    this.combatAI = new MyCustomAI(this.config.aiConfig);
    // Additional AI setup...
  }
}
```

### Character Classes Examples

#### Fighter
- **Strengths**: High health, strong melee combat, tactical abilities
- **AI Behavior**: Aggressive, protective of allies, frontline combat
- **Special Abilities**: Second Wind, Action Surge, fighting styles

#### Wizard
- **Strengths**: Powerful spells, battlefield control, utility magic
- **AI Behavior**: Cautious, strategic spell usage, positioning
- **Special Abilities**: Spell slots, ritual casting, spell recovery

#### Rogue
- **Strengths**: Stealth, high damage, trap detection, skills
- **AI Behavior**: Opportunistic, sneaky, treasure-focused
- **Special Abilities**: Sneak Attack, expertise, thieves' tools

## 🚀 Deployment

### Single Character Deployment

```bash
# Production deployment
NODE_ENV=production docker-compose up -d

# Development with hot reload
BUILD_TARGET=development VOLUME_MOUNT_TYPE=rw docker-compose up -d
```

### Multi-Character Deployment

```bash
# Deploy multiple characters with unique configurations
./scripts/deploy-party.sh fighter wizard rogue cleric
```

Example deployment script:

```bash
#!/bin/bash
# scripts/deploy-party.sh

CHARACTERS=("$@")
BASE_PORT=3000

for i in "${!CHARACTERS[@]}"; do
  CHARACTER=${CHARACTERS[$i]}
  PORT=$((BASE_PORT + i + 1))
  
  echo "Deploying $CHARACTER on port $PORT..."
  
  CHARACTER_NAME="$CHARACTER-$i" \
  CHARACTER_PORT="$PORT" \
  CHARACTER_CLASS="$CHARACTER" \
  docker-compose -f character-containers/example-$CHARACTER/docker-compose.yml up -d
done
```

### Scaling and Load Balancing

```yaml
# docker-compose.scale.yml
version: '3.8'
services:
  character-load-balancer:
    image: nginx:alpine
    ports:
      - "3000-3099:80"
    volumes:
      - ./nginx-character-lb.conf:/etc/nginx/nginx.conf
    depends_on:
      - character-container
    
  character-container:
    # ... character service configuration
    deploy:
      replicas: 5  # Scale to 5 instances
      restart_policy:
        condition: on-failure
```

## 📊 Monitoring and Management

### Health Monitoring

Each character container includes comprehensive health checks:

```bash
# Individual character health
curl http://localhost:3001/health

# Detailed status
curl http://localhost:3001/api/character/status

# AI status
curl http://localhost:3001/api/ai/status
```

### Logging and Debugging

```bash
# View character logs
docker-compose logs -f character-container

# Debug mode with detailed logging
LOG_LEVEL=debug docker-compose up

# Access container for debugging
docker-compose exec character-container sh
```

### Metrics and Analytics

Characters automatically track:
- Combat effectiveness
- Decision-making patterns
- Resource usage
- Communication frequency
- Error rates and recovery

## 🔧 Advanced Configuration

### Environment Variables

#### Character Configuration
- `CHARACTER_ID` - Unique character identifier
- `CHARACTER_NAME` - Display name
- `CHARACTER_CLASS` - Character class
- `CHARACTER_LEVEL` - Starting level
- `CHARACTER_PORT` - API port (must be unique)

#### AI Personality
- `AI_AGGRESSIVENESS` (0.0-1.0) - Combat engagement
- `AI_CAUTION` (0.0-1.0) - Risk assessment
- `AI_CURIOSITY` (0.0-1.0) - Exploration drive
- `AI_TACTICAL` (0.0-1.0) - Strategic thinking

#### System Integration
- `REGISTRY_URL` - Game system registry endpoint
- `GAME_SERVER_URL` - Main game server
- `REDIS_URL` - Redis connection for events

### Custom Event Handlers

```javascript
// Register custom event handlers
character.on('custom_event', async (eventData) => {
  // Handle custom game events
  return await this.processCustomEvent(eventData);
});

// Emit custom events
character.emit('character_action', {
  action: 'custom_action',
  data: customData
});
```

### Plugin System

```javascript
// src/plugins/my-plugin.js
class MyCharacterPlugin {
  constructor(character) {
    this.character = character;
  }

  initialize() {
    // Add custom behaviors
    this.character.addAbility('my_custom_ability', this.executeAbility.bind(this));
  }

  async executeAbility(context) {
    // Custom ability implementation
    return { success: true, message: 'Custom ability used!' };
  }
}

// Load plugin in character
character.loadPlugin(new MyCharacterPlugin(character));
```

## 🤝 Integration with Main System

### Character Registry

Characters automatically register with the main game system:

1. **Startup Registration**: Container starts and registers character
2. **Authentication**: Receives JWT token for secure communication
3. **Event Subscription**: Connects to game event system
4. **Heartbeat**: Sends periodic status updates
5. **Graceful Shutdown**: Unregisters on container stop

### Game Events Integration

```javascript
// Game system sends events to characters
gameSystem.broadcast('combat_start', {
  combatId: 'combat-123',
  participants: ['char-001', 'char-002'],
  initiative: [...]
});

// Characters respond with actions
character.respondToEvent('combat_turn', {
  action: { type: 'attack', target: 'enemy-1' },
  acknowledged: true
});
```

## 🔍 Troubleshooting

### Common Issues

#### Port Conflicts
```bash
# Check if port is in use
netstat -tulpn | grep :3001

# Use different port
CHARACTER_PORT=3002 docker-compose up -d
```

#### Network Connectivity
```bash
# Verify dungeon network exists
docker network ls | grep dungeon

# Create network if missing
docker network create dungeon-network
```

#### Registration Failures
```bash
# Check game system is running
curl http://localhost:3001/health

# Verify character can reach registry
docker-compose exec character-container curl http://host.docker.internal:3001/health
```

#### Redis Connection Issues
```bash
# Test Redis connectivity
redis-cli -h localhost -p 6379 ping

# Check Redis authentication
redis-cli -h localhost -p 6379 -a redispass123 ping
```

### Debug Mode

Enable comprehensive debugging:

```bash
# Full debug logging
LOG_LEVEL=debug \
NODE_ENV=development \
BUILD_TARGET=development \
VOLUME_MOUNT_TYPE=rw \
docker-compose up
```

### Log Analysis

```bash
# Filter logs by type
docker-compose logs character-container | grep "ERROR"
docker-compose logs character-container | grep "AI"
docker-compose logs character-container | grep "combat"

# Real-time log monitoring
docker-compose logs -f character-container | grep -E "(ERROR|WARN|combat|ai)"
```

## 🎮 Game Flow Example

### Complete Game Session

1. **Character Startup**
   ```bash
   # Players start their characters
   cd my-fighter && docker-compose up -d
   cd my-wizard && docker-compose up -d
   cd my-rogue && docker-compose up -d
   ```

2. **Registration and Party Formation**
   ```javascript
   // Characters automatically register and join party
   // Game system creates party: [fighter, wizard, rogue]
   ```

3. **Dungeon Exploration**
   ```javascript
   // Game sends exploration event
   gameSystem.emit('room_entered', {
     room: { id: 'room-1', description: 'Dark corridor...', exits: ['north', 'east'] },
     party: ['char-001', 'char-002', 'char-003']
   });
   
   // Each character AI decides action independently
   fighter.ai.decide() → { action: 'investigate', target: 'suspicious_wall' }
   wizard.ai.decide() → { action: 'cast_spell', spell: 'detect_magic' }
   rogue.ai.decide() → { action: 'search', skill: 'perception' }
   ```

4. **Combat Encounter**
   ```javascript
   // Combat starts
   gameSystem.emit('combat_start', {
     enemies: [{ id: 'orc-1', hp: 15 }, { id: 'orc-2', hp: 15 }],
     initiative: ['char-001', 'orc-1', 'char-002', 'orc-2', 'char-003']
   });
   
   // Each character processes their turn
   fighter: attack with sword → damage dealt
   wizard: cast magic missile → multiple targets
   rogue: sneak attack → high damage with advantage
   ```

5. **Autonomous Interaction**
   ```javascript
   // Characters interact without player input
   // Fighter protects wizard when health is low
   // Wizard uses tactical spells for party benefit
   // Rogue focuses on high-value targets
   ```

## 📚 API Reference

### Character Management API

#### GET /api/character
Get character information and status.

```bash
curl http://localhost:3001/api/character
```

Response:
```json
{
  "character": {
    "id": "char-001",
    "name": "Grax the Fighter",
    "class": "fighter",
    "level": 3,
    "hp": 28,
    "maxHp": 30,
    "stats": { "strength": 16, "dexterity": 13, ... }
  },
  "status": "active",
  "aiEnabled": true
}
```

#### POST /api/character/action
Submit a manual action for the character.

```bash
curl -X POST http://localhost:3001/api/character/action \
  -H "Content-Type: application/json" \
  -d '{"action": {"type": "attack", "target": "enemy-1"}}'
```

### AI Control API

#### GET /api/ai/status
Get AI system status and configuration.

```bash
curl http://localhost:3001/api/ai/status
```

#### PUT /api/ai/personality
Update AI personality configuration.

```bash
curl -X PUT http://localhost:3001/api/ai/personality \
  -H "Content-Type: application/json" \
  -d '{"aggressiveness": 0.8, "caution": 0.3}'
```

### System Administration API

#### GET /health
Health check endpoint.

#### GET /api/connection/status
Check connection status to game system.

#### POST /api/character/save
Force save character state.

## 🚀 Future Enhancements

### Planned Features

1. **Advanced AI Learning**
   - Machine learning integration
   - Behavioral adaptation over time
   - Player preference learning

2. **Enhanced Communication**
   - Voice synthesis for character speech
   - Advanced chat interactions
   - Emotion modeling

3. **Extended Character System**
   - Multi-classing support
   - Custom spell/ability creation
   - Dynamic character progression

4. **Performance Optimization**
   - Container orchestration with Kubernetes
   - Auto-scaling based on demand
   - Optimized resource usage

5. **Developer Tools**
   - Character behavior IDE
   - AI debugging tools
   - Performance profiling

### Community Integration

- **Character Marketplace**: Share and download custom characters
- **Tournament Mode**: Automated character competitions
- **Analytics Dashboard**: Character performance metrics
- **Plugin Ecosystem**: Community-developed character enhancements

## 📄 License

This project is part of the Distributed Dungeon RPG system. See the main project LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-character`)
3. Commit your changes (`git commit -am 'Add amazing character features'`)
4. Push to the branch (`git push origin feature/amazing-character`)
5. Create a Pull Request

### Development Guidelines

- Follow existing code style and patterns
- Add tests for new character behaviors
- Update documentation for new features
- Ensure Docker compatibility
- Maintain backward compatibility with base character API

## 📞 Support

- **Documentation**: Check the `/docs` directory for detailed guides
- **Issues**: Report bugs and feature requests on GitHub
- **Community**: Join our Discord for discussions and help
- **Examples**: See `example-*` directories for implementation patterns

---

**Happy Adventuring!** 🗡️⚡🏹

*Create, deploy, and watch your AI characters explore dungeons autonomously in the most advanced distributed RPG system ever built.*