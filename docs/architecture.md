# System Architecture

## Overview

Distributed Dungeon follows a microservices architecture with event-driven communication patterns. Each service is containerized and can be scaled independently based on load requirements.

## Service Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Communication Layer                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │   Discord   │  │ Meshtastic  │  │    Web Interface        │ │
│  │     Bot     │  │   Radio     │  │      (Future)           │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                 Communication Service                           │
│              (Message Routing & Formatting)                     │
└─────────────────────────────────────────────────────────────────┘
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐   ┌─────────────────┐   ┌───────────────────┐
│   Dungeon    │   │     Player      │   │     Monster       │
│   Master     │   │    Service      │   │    Service        │
│   Service    │   │                 │   │                   │
│              │   │ ┌─────────────┐ │   │ ┌───────────────┐ │
│ ┌──────────┐ │   │ │  Character  │ │   │ │    Monster    │ │
│ │ Session  │ │   │ │   Sheets    │ │   │ │      AI       │ │
│ │ Manager  │ │   │ └─────────────┘ │   │ └───────────────┘ │
│ └──────────┘ │   │                 │   │                   │
│              │   │ ┌─────────────┐ │   │ ┌───────────────┐ │
│ ┌──────────┐ │   │ │    Skills   │ │   │ │   Behavior    │ │
│ │   Rule   │ │   │ │ & Spells    │ │   │ │    Engine     │ │
│ │ Manager  │ │   │ └─────────────┘ │   │ └───────────────┘ │
│ └──────────┘ │   └─────────────────┘   └───────────────────┘
└──────────────┘            │                       │
        │                   │                       │
        ▼                   ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Rules Engine Service                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ Core Rules  │  │   Dungeon   │  │    Combat Calculator    │ │
│  │ (D&D 5e)    │  │   Rules     │  │                         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
        │                   │                       │
        ▼                   ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Dungeon Service                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │  Dungeon    │  │  Environment│  │    Access Control       │ │
│  │  Manager    │  │   Manager   │  │                         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
        │                   │                       │
        ▼                   ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Database Layer                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ PostgreSQL  │  │    Redis    │  │      File Storage       │ │
│  │ (Primary)   │  │  (Cache)    │  │     (Images/Assets)     │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow Patterns

### 1. Player Action Flow
```
Player Input → Communication Service → Dungeon Master Service → Rules Engine → Database
                                    ↓
                              Event Broadcast
                                    ↓
              All Connected Services → Communication Service → All Clients
```

### 2. Monster AI Action Flow
```
Game Event → Monster Service → Gemini LLM → Rules Engine → Action Decision
                             ↓
                        Execute Action
                             ↓
                    Update Game State → Database
```

### 3. Character Sheet Modification
```
DM API Call → Player Service → Validation → Database Update → Event Broadcast
```

## Service Communication

### Synchronous Communication (REST APIs)
- **Player Service ↔ Rules Engine**: Skill checks, spell validation
- **Dungeon Master ↔ All Services**: Control and monitoring
- **Monster Service ↔ Rules Engine**: Combat calculations
- **Dungeon Service ↔ Player Service**: Access validation

### Asynchronous Communication (Events)
- **Game State Changes**: Broadcast to all interested services
- **Combat Actions**: Real-time updates to all participants
- **Character Updates**: Notify DM and other players
- **Rule Violations**: Alert systems and logging

### Message Queuing
Using Redis for:
- Event broadcasting
- Action queuing
- Cache management
- Session state

## Scalability Considerations

### Horizontal Scaling
- **Player Service**: Scale based on active players
- **Monster Service**: Scale based on active monsters/encounters
- **Communication Service**: Scale based on active channels
- **Dungeon Service**: Scale based on active dungeons

### Load Balancing
- Round-robin for stateless services
- Session affinity for stateful services (Dungeon Master)
- Database connection pooling
- Redis cluster for distributed caching

### Performance Optimization
- Database indexing on frequently queried fields
- Caching of character sheets and game rules
- Lazy loading of monster behaviors
- Connection pooling for external APIs (Gemini)

## Security Architecture

### Authentication & Authorization
- JWT tokens for service-to-service communication
- Role-based access control (Player, DM, Admin)
- API key validation for external integrations
- OAuth2 for Discord integration

### Data Protection
- Encrypted database connections
- Secure environment variable management
- Input validation and sanitization
- Rate limiting on public APIs

### Network Security
- Internal service mesh communication
- Firewall rules for external access
- VPN for production database access
- SSL/TLS for all external communications

## Monitoring & Observability

### Health Checks
- Service availability monitoring
- Database connection health
- External API connectivity
- Memory and CPU usage tracking

### Logging Strategy
- Centralized logging with ELK stack
- Structured JSON logging
- Request tracing across services
- Error aggregation and alerting

### Metrics Collection
- Application performance metrics
- Business metrics (active players, sessions)
- Infrastructure metrics (CPU, memory, disk)
- Custom game-specific metrics

## Disaster Recovery

### Backup Strategy
- Automated database backups every 6 hours
- Character sheet snapshots before major changes
- Configuration backup to cloud storage
- Docker image versioning and rollback capability

### High Availability
- Multi-zone deployment
- Database clustering with failover
- Service redundancy
- Automated health checks and restarts

### Data Recovery
- Point-in-time recovery for databases
- Character sheet version history
- Game session replay capability
- Audit log preservation