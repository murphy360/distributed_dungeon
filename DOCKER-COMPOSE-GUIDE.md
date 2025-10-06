# Distributed Dungeon System - Docker Compose Management

This directory contains Docker Compose configurations for orchestrating the entire Distributed Dungeon system.

## 🚀 Quick Start

### Development Environment
```bash
# Start all services in development mode
docker-compose up -d

# View logs for all services
docker-compose logs -f

# Stop all services
docker-compose down

# Rebuild and restart a specific service
docker-compose up -d --build monster
```

### Production Environment
```bash
# Start all services in production mode
docker-compose -f docker-compose.prod.yml up -d

# Scale specific services
docker-compose -f docker-compose.prod.yml up -d --scale monster=3 --scale player=2

# Stop production environment
docker-compose -f docker-compose.prod.yml down
```

## 🌐 Service Access Points

### Web Interfaces
- **Dungeon Explorer**: http://localhost:3000 (Interactive dungeon map and state viewer)
- **Monster Compendium**: http://localhost:3007 (Monster browser and encounter builder)

### Core Services
- **Dungeon Master**: http://localhost:3001 (Central orchestration service)
- **Player Management**: http://localhost:3004 (Player character management)
- **Communication Hub**: http://localhost:3005 (Discord and Meshtastic integration)
- **Rules Engine**: http://localhost:3006 (D&D 5e rules processing)

### API Endpoints
- **Dungeon Master API**: http://localhost:3001/api
- **Dungeon Service API**: http://localhost:3002/api
- **Monster Service API**: http://localhost:3003/api
- **Player Service API**: http://localhost:3004/api
- **Communication API**: http://localhost:3005/api
- **Rules Engine API**: http://localhost:3006/api

### Database & Cache
- **PostgreSQL**: localhost:5432 (dungeon_db)
- **Redis**: localhost:6379
- **Database Admin**: http://localhost:8080 (Adminer)
- **Redis Commander**: http://localhost:8081

### Load Balancer
- **Nginx**: http://localhost (port 80/443)

## 📊 Service Dependencies

```
┌─────────────────┐    ┌─────────────────┐
│   PostgreSQL    │    │      Redis      │
│    (Database)   │    │     (Cache)     │
└─────────┬───────┘    └─────────┬───────┘
          │                      │
          └──────────┬───────────┘
                     │
       ┌─────────────▼─────────────┐
       │     Dungeon Master        │
       │   (Orchestration)         │
       └─────────────┬─────────────┘
                     │
       ┌─────────────▼─────────────┐
       │      Core Services        │
       │ ┌─────────┬─────────────┐ │
       │ │ Dungeon │   Monster   │ │
       │ │ Service │   Service   │ │
       │ └─────────┴─────────────┘ │
       │ ┌─────────┬─────────────┐ │
       │ │ Player  │ Rules Engine│ │
       │ │ Service │   Service   │ │
       │ └─────────┴─────────────┘ │
       │ ┌─────────────────────────┐ │
       │ │  Communication Service  │ │
       │ └─────────────────────────┘ │
       └─────────────┬─────────────┘
                     │
       ┌─────────────▼─────────────┐
       │        Nginx              │
       │   (Load Balancer)         │
       └───────────────────────────┘
```

## 🔧 Configuration

### Environment Variables
Create a `.env` file in the project root:

```bash
# Database Configuration
DATABASE_PASSWORD=your_secure_database_password
REDIS_PASSWORD=your_secure_redis_password

# API Keys
GEMINI_API_KEY=your_gemini_api_key
JWT_SECRET=your_super_secret_jwt_key

# Discord Bot (Optional)
DISCORD_BOT_TOKEN=your_discord_bot_token
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_GUILD_ID=your_discord_guild_id

# Production Scaling
DUNGEON_MASTER_REPLICAS=1
DUNGEON_SERVICE_REPLICAS=2
MONSTER_SERVICE_REPLICAS=3
PLAYER_SERVICE_REPLICAS=2
COMMUNICATION_SERVICE_REPLICAS=1
RULES_ENGINE_REPLICAS=2
```

### Service Health Checks
All services include health checks:
- **Database**: PostgreSQL connection test
- **Redis**: Connection and ping test
- **Services**: HTTP health endpoint tests
- **Nginx**: Load balancer health check

### Resource Limits (Production)
- **Database**: 2GB RAM, 1 CPU
- **Core Services**: 512MB-1GB RAM, 0.5-1 CPU
- **Character Containers**: 256MB RAM, 0.2 CPU

## 📋 Management Commands

### Service Management
```bash
# Check service status
docker-compose ps

# View service logs
docker-compose logs [service-name]

# Restart a specific service
docker-compose restart [service-name]

# Scale services (production)
docker-compose -f docker-compose.prod.yml up -d --scale monster=5
```

### Database Management
```bash
# Access PostgreSQL
docker-compose exec database psql -U postgres -d dungeon_db

# Backup database
docker-compose exec database pg_dump -U postgres dungeon_db > backup.sql

# Restore database
docker-compose exec -T database psql -U postgres -d dungeon_db < backup.sql
```

### Development Tools
```bash
# Access service shell
docker-compose exec [service-name] sh

# View real-time resource usage
docker stats

# Clean up unused containers/images
docker system prune -f
```

## 🔍 Monitoring & Debugging

### Health Check URLs
- http://localhost:3001/health (Dungeon Master)
- http://localhost:3002/health (Dungeon Service)
- http://localhost:3003/health (Monster Service)
- http://localhost:3004/health (Player Service)  
- http://localhost:3005/health (Communication)
- http://localhost:3006/health (Rules Engine)

### Log Aggregation
```bash
# Follow all service logs
docker-compose logs -f

# Filter logs by service
docker-compose logs -f monster player

# View last 100 log lines
docker-compose logs --tail=100
```

## 🚀 Deployment Options

### Local Development
- Hot reloading enabled
- Source code mounted as volumes
- Debug ports exposed
- Development dependencies included

### Production Deployment
- Optimized container builds
- Resource limits enforced
- Multiple service replicas
- SSL/TLS termination at load balancer
- Health checks and auto-restart policies

### Character Containers
Character containers are managed separately but can integrate with the main system:
```bash
# Start character containers
cd character-containers/my-character
docker-compose up -d
```

## 🎮 Automated System Management

### PowerShell Management Scripts

The system includes two PowerShell scripts for easy management:

#### System Startup Script (`start-system.ps1`)
Complete system orchestration with intelligent service dependency management:

```powershell
# Start development environment
.\start-system.ps1

# Start with admin tools enabled
.\start-system.ps1 -Admin

# Start production environment  
.\start-system.ps1 -Environment production

# Start with rebuild and cleanup
.\start-system.ps1 -Rebuild -Clean

# Show logs during startup
.\start-system.ps1 -ShowLogs
```

**Features:**
- Environment file validation and template creation
- Intelligent service startup sequencing (infrastructure → core → monitoring)
- Health check verification for all services
- Comprehensive status display with service URLs
- Error handling and troubleshooting guidance

#### System Management Script (`manage-system.ps1`)
Day-to-day operations and maintenance:

```powershell
# Check system status with health checks
.\manage-system.ps1 -Action status

# View logs for all services
.\manage-system.ps1 -Action logs -Follow

# View logs for specific service
.\manage-system.ps1 -Action logs -Service monster -Follow

# Restart services
.\manage-system.ps1 -Action restart
.\manage-system.ps1 -Action restart -Service dungeon

# Scale services (production)
.\manage-system.ps1 -Action scale -Service monster -Replicas 3

# Comprehensive health check
.\manage-system.ps1 -Action health

# System backup and restore
.\manage-system.ps1 -Action backup -BackupPath "backup-20241221"
.\manage-system.ps1 -Action restore -BackupPath "backup-20241221"

# System cleanup
.\manage-system.ps1 -Action cleanup
```

**Operations Available:**
- `status` - Container status and resource usage
- `logs` - Service log viewing with filtering
- `stop/restart` - Service lifecycle management  
- `scale` - Dynamic service scaling
- `health` - Comprehensive endpoint testing
- `backup/restore` - Data backup and recovery
- `cleanup` - Complete system cleanup

### Service Health Monitoring

The management scripts provide comprehensive health monitoring:

- **Container Health**: Docker health check status
- **Service Endpoints**: HTTP endpoint availability testing  
- **Web Interfaces**: Frontend accessibility verification
- **Resource Usage**: CPU, memory, and network statistics
- **Database Connectivity**: PostgreSQL and Redis connection testing

## 🛡️ Security Considerations

- Environment variables for sensitive data
- Network isolation between services
- JWT authentication for service communication
- Rate limiting on public endpoints
- SSL/TLS encryption in production
- Database connection pooling and timeouts

## 📚 Additional Resources

- [API Documentation](./docs/api-specification.md)
- [Architecture Overview](./docs/distributed-character-architecture.md)
- [Character Container Guide](./character-containers/README.md)
- [Deployment Guide](./docs/deployment-guide.md)