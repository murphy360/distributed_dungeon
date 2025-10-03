# Distributed Dungeon - Microservices RPG Platform

## Overview

Distributed Dungeon is a sophisticated, containerized RPG platform built with microservices architecture. It enables multiplayer role-playing games with AI-powered characters, dynamic rule systems, and multi-platform communication support.

## Architecture

### Core Services

- **🎯 Dungeon Master Service** - Game session management, rule enforcement, and monitoring
- **🏰 Dungeon Service** - Dungeon creation, level requirements, and environment management
- **👹 Monster Service** - Monster behavior, stats, and AI interactions
- **👤 Player Service** - Character sheet management for players and NPCs
- **📡 Communication Service** - Discord/Meshtastic integration for multi-platform chat
- **⚖️ Rules Engine Service** - Core and dungeon-specific rule processing
- **🗄️ Database** - PostgreSQL for persistent game data storage

### Key Features

- **Dynamic Character Sheets**: Add skills, spells, and attributes via API
- **Level-Based Dungeon Access**: Minimum/maximum level requirements for dungeons
- **Dual Rule Systems**: Core game rules + dungeon-specific modifications
- **AI-Powered Roleplay**: Gemini LLM integration for immersive character interactions
- **Multi-Platform Communication**: Discord and Meshtastic channel support
- **DM API Access**: Full character sheet visibility and control for Dungeon Masters
- **Automated Dungeons**: AI-managed dungeons when DMs are unavailable
- **Real-time Monitoring**: Live game state tracking and event logging

## Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for development)
- PostgreSQL 14+ (handled via Docker)

### Installation

```bash
# Clone the repository
git clone https://github.com/murphy360/distributed_dungeon.git
cd distributed_dungeon

# Start all services
docker-compose up -d

# Initialize the database
docker-compose exec database psql -U postgres -d dungeon_db -f /docker-entrypoint-initdb.d/init.sql

# View logs
docker-compose logs -f
```

### Environment Configuration

Copy `.env.example` to `.env` and configure:

```env
# Database
DATABASE_URL=postgresql://postgres:password@database:5432/dungeon_db

# Gemini AI
GEMINI_API_KEY=your_gemini_api_key_here

# Discord Bot
DISCORD_BOT_TOKEN=your_discord_bot_token
DISCORD_GUILD_ID=your_guild_id

# Meshtastic (optional)
MESHTASTIC_DEVICE=/dev/ttyUSB0

# Service Configuration
DUNGEON_MASTER_PORT=3001
DUNGEON_SERVICE_PORT=3002
MONSTER_SERVICE_PORT=3003
PLAYER_SERVICE_PORT=3004
COMMUNICATION_SERVICE_PORT=3005
RULES_ENGINE_PORT=3006
```

## API Documentation

### Player Service API

#### Character Management
```bash
# Create new character
POST /api/players
{
  "name": "Aragorn",
  "class": "Ranger",
  "level": 5,
  "stats": {
    "strength": 16,
    "dexterity": 18,
    "constitution": 14,
    "intelligence": 12,
    "wisdom": 15,
    "charisma": 13
  }
}

# Add skill to character
POST /api/players/{playerId}/skills
{
  "name": "Stealth",
  "level": 3,
  "modifier": 2
}

# Add spell to character
POST /api/players/{playerId}/spells
{
  "name": "Cure Light Wounds",
  "level": 1,
  "school": "Healing",
  "description": "Heals 1d8+1 HP"
}
```

### Dungeon Service API

#### Dungeon Management
```bash
# Create dungeon
POST /api/dungeons
{
  "name": "The Forgotten Catacombs",
  "description": "Ancient underground burial chambers",
  "minLevel": 3,
  "maxLevel": 7,
  "maxPlayers": 6,
  "rules": {
    "allowPvP": false,
    "respawnEnabled": true,
    "difficultyModifier": 1.2
  }
}

# Join dungeon
POST /api/dungeons/{dungeonId}/join
{
  "playerId": "player-uuid-here"
}
```

### Dungeon Master API

#### Session Control
```bash
# Start game session
POST /api/dm/sessions
{
  "dungeonId": "dungeon-uuid",
  "mode": "manual", // or "automatic"
  "dmId": "dm-uuid"
}

# Get all player sheets in dungeon
GET /api/dm/dungeons/{dungeonId}/players

# Override character stats (DM only)
PATCH /api/dm/players/{playerId}
{
  "temporaryModifiers": {
    "strength": +2,
    "health": -10
  }
}
```

## Service Details

### 🎯 Dungeon Master Service
- Session management and game state coordination
- Real-time player monitoring
- Rule enforcement and conflict resolution
- Event logging and audit trails
- API endpoints for DM controls

### 🏰 Dungeon Service
- Dungeon creation and configuration
- Level requirement enforcement
- Environment and room management
- Player capacity and access control
- Custom rule integration

### 👹 Monster Service
- Monster AI behavior patterns
- Combat calculations and actions
- Loot generation and distribution
- Encounter scaling based on party level
- Gemini LLM integration for roleplay

### 👤 Player Service
- Character sheet CRUD operations
- Dynamic skill and spell management
- Equipment and inventory tracking
- Experience and level progression
- NPC character automation

### 📡 Communication Service
- Discord bot integration
- Meshtastic radio communication
- Message routing and formatting
- Channel management and permissions
- Real-time event broadcasting

### ⚖️ Rules Engine Service
- Core D&D 5e rule implementation
- Custom dungeon rule overlays
- Combat mechanics and calculations
- Skill check and saving throw logic
- Spell casting and effect resolution

## Database Schema

### Core Tables
- `players` - Character sheets and stats
- `dungeons` - Dungeon configurations and state
- `monsters` - Monster templates and instances
- `sessions` - Active game sessions
- `skills` - Available skills and character assignments
- `spells` - Spell database and character spellbooks
- `rules` - Core and dungeon-specific rules

See `database/migrations/` for detailed schema definitions.

## Development

### Project Structure
```
distributed_dungeon/
├── services/
│   ├── dungeon-master/     # Game session orchestration
│   ├── dungeon/           # Dungeon management
│   ├── monster/           # Monster AI and behavior
│   ├── player/            # Character sheet management
│   ├── communication/     # Multi-platform messaging
│   └── rules-engine/      # Game rules processing
├── shared/
│   ├── models/           # Common data models
│   └── utils/            # Shared utilities
├── database/
│   ├── migrations/       # Schema changes
│   └── seeds/           # Test data
├── docs/                # Technical documentation
├── config/              # Configuration files
└── scripts/             # Utility scripts
```

### Local Development
```bash
# Install dependencies for all services
npm run install:all

# Start services in development mode
npm run dev

# Run tests
npm run test

# Build all Docker images
npm run build:docker
```

### Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Deployment

### Production Deployment
```bash
# Build production images
docker-compose -f docker-compose.prod.yml build

# Deploy to production
docker-compose -f docker-compose.prod.yml up -d

# Scale services as needed
docker-compose -f docker-compose.prod.yml up -d --scale monster=3 --scale player=2
```

### Monitoring and Logging
- Service health checks via Docker Compose
- Centralized logging with ELK stack (optional)
- Metrics collection with Prometheus (optional)
- Alert management with Grafana (optional)

## Troubleshooting

### Common Issues

**Service Connection Errors**
```bash
# Check service status
docker-compose ps

# View service logs
docker-compose logs service-name

# Restart specific service
docker-compose restart service-name
```

**Database Connection Issues**
```bash
# Check database status
docker-compose exec database pg_isready -U postgres

# Connect to database directly
docker-compose exec database psql -U postgres -d dungeon_db
```

**AI Integration Problems**
- Verify Gemini API key is valid and has sufficient quota
- Check network connectivity to Google AI services
- Review rate limiting in service logs

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- 📧 Email: support@distributeddungeon.com
- 💬 Discord: [Distributed Dungeon Server](https://discord.gg/distributeddungeon)
- 🐛 Issues: [GitHub Issues](https://github.com/murphy360/distributed_dungeon/issues)
- 📖 Documentation: [Wiki](https://github.com/murphy360/distributed_dungeon/wiki)

---

**Built with ❤️ for the RPG community**