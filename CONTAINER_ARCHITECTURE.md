# 🐉 Distributed Dungeon Container Architecture & Interactions

## 📊 **Current Running Containers Overview**

```
🌐 Your Distributed D&D System consists of 11 interconnected containers:

┌─────────────────────────────────────────────────────────────────────────────┐
│                          NGINX REVERSE PROXY                               │
│                         (dungeon_nginx:80/443)                             │
│                    Routes external traffic to services                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                      ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                        MAIN DUNGEON NETWORK                                │
│                    (distributed_dungeon_dungeon_network)                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 🔗 **Container Interaction Diagram**

```
                          🌍 EXTERNAL ACCESS
                                   ↓
┌──────────────────────────────────────────────────────────────────────────────┐
│                        NGINX (Port 80/443)                                  │
│                     Reverse Proxy & Load Balancer                           │
└──────────────────────────────────────────────────────────────────────────────┘
                                   ↓
        ┌─────────────────────────────────────────────────────────────┐
        │                DUNGEON NETWORK                              │
        └─────────────────────────────────────────────────────────────┘
                                   ↓
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                           CORE SERVICES LAYER                              ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  DUNGEON MASTER │◄──►│   DUNGEON SVC   │◄──►│  PLAYER SVC     │
│   (Port 3001)   │    │   (Port 3002)   │    │  (Port 3004)    │
│                 │    │                 │    │                 │
│ • Session Mgmt  │    │ • World State   │    │ • Character Mgmt│
│ • WebSocket Hub │    │ • Location Mgmt │    │ • Action Proc   │
│ • Web Dashboard │    │ • Event Coord   │    │ • Inventory     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         ↑                       ↑                       ↑
         ↓                       ↓                       ↓
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   MONSTER SVC   │    │COMMUNICATION SVC│    │ RULES ENGINE    │
│   (Port 3003)   │    │   (Port 3005)   │    │   (Port 3006)   │
│                 │    │                 │    │                 │
│ • AI Monsters   │    │ • Discord Bot   │    │ • D&D Rules     │
│ • Combat Logic  │    │ • Meshtastic    │    │ • Dice Rolling  │
│ • Behavior AI   │    │ • Notifications │    │ • Validation    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         ↑                       ↑                       ↑
         └───────────────────────┼───────────────────────┘
                                 ↓
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                         DATA PERSISTENCE LAYER                             ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

┌─────────────────┐                           ┌─────────────────┐
│   POSTGRESQL    │◄─────────── ALL ──────────►│     REDIS       │
│  (Port 5432)    │         SERVICES          │   (Port 6379)   │
│                 │                           │                 │
│ • Game Data     │                           │ • Session Cache │
│ • User Accounts │                           │ • Real-time Data│
│ • World State   │                           │ • Pub/Sub       │
│ • Audit Logs    │                           │ • Rate Limiting │
└─────────────────┘                           └─────────────────┘
```

## ⚔️ **Character Container Ecosystem**

```
┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃                    CHARACTER CONTAINER NETWORK                              ┃
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

                 🌐 External Access (Port 3010)
                          ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                     GRAX FIGHTER CHARACTER                                 │
│                        (character-grax-fighter)                            │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐           │
│  │   WEB INTERFACE │  │   CHARACTER AI  │  │  REGISTRY CLIENT│           │
│  │                 │  │                 │  │                 │           │
│  │ • Character UI  │  │ • Combat AI     │  │ • Auto-Register │           │
│  │ • Real-time     │  │ • Exploration   │  │ • Heartbeat     │           │
│  │ • Controls      │  │ • Social AI     │  │ • Action Submit │           │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘           │
│                                                     ↑                      │
│                                                     ↓                      │
│                    ┌─────────────────┐        Connects to                  │
│                    │   FIGHTER REDIS │     DUNGEON MASTER                  │
│                    │   (Port 6381)   │     (host.docker.internal:3001)    │
│                    │                 │                                     │
│                    │ • Combat Cache  │                                     │
│                    │ • AI Memory     │                                     │
│                    │ • Strategy Data │                                     │
│                    └─────────────────┘                                     │
└─────────────────────────────────────────────────────────────────────────────┘
                                 ↑
                ┌────────────────────────────────┐
                │    CHARACTER PRIVATE NETWORK   │
                │  (character-network-grax)      │
                └────────────────────────────────┘
```

## 🔄 **Service Communication Patterns**

### **1. Service-to-Service Communication (Internal Network)**
```
┌─────────────────┐     HTTP REST API     ┌─────────────────┐
│  Dungeon Master │◄──────────────────────►│  All Services   │
│                 │                        │                 │
│ • Orchestration │   WebSocket (Events)   │ • Registration  │
│ • Session Mgmt  │◄──────────────────────►│ • Health Checks │
└─────────────────┘                        └─────────────────┘
         ↑                                           ↑
         └─────────── Shared Database ───────────────┘
```

### **2. Character Container Registration Flow**
```
Character Container                    Dungeon Master
       │                                     │
       │ ─── POST /api/registry/character ──►│ (Registration)
       │                                     │
       │◄─── JWT Token + Session ID ────────│
       │                                     │
       │ ─── POST /api/registry/heartbeat ──►│ (Every 30s)
       │                                     │
       │ ─── POST /api/game/action ─────────►│ (Game Actions)
       │                                     │
       │◄─── POST /event ──────────────────│ (Game Events)
```

### **3. Data Flow Architecture**
```
┌─── NGINX ───┐     ┌─── SERVICES ───┐     ┌─── DATA ───┐
│             │     │                │     │            │
│ • SSL/TLS   │────►│ • Business     │────►│ PostgreSQL │
│ • Routing   │     │   Logic        │     │            │
│ • Caching   │     │ • Validation   │◄────┤ • Schemas  │
│             │     │ • Processing   │     │ • Queries  │
└─────────────┘     └────────────────┘     └────────────┘
                             │                    ▲
                             ▼                    │
                    ┌─── REDIS CACHE ─────────────┘
                    │                     │
                    │ • Session Data      │
                    │ • Real-time Events  │
                    │ • Pub/Sub Messages  │
                    └─────────────────────┘
```

## 🛡️ **Security & Network Isolation**

### **Network Segmentation:**
- **Main Dungeon Network**: Core services communicate securely
- **Character Networks**: Each character has isolated private network
- **External Access**: Only through NGINX proxy and designated ports

### **Authentication Flow:**
```
External User → NGINX → Service → JWT Validation → Database
                  ↓
Character Container → Registry → JWT Token → Authenticated Actions
```

## 📊 **Port Mapping & Access Points**

| Container | Internal Port | External Port | Purpose |
|-----------|---------------|---------------|---------|
| NGINX | 80/443 | 80/443 | Web proxy & SSL termination |
| Dungeon Master | 3001 | 3001 | **🌟 Main Dashboard & API** |
| Dungeon Service | 3002 | 3002 | World state management |
| Monster Service | 3003 | 3003 | AI monster behavior |
| Player Service | 3004 | 3004 | Player character management |
| Communication | 3005 | 3005 | Discord/Meshtastic integration |
| Rules Engine | 3006 | 3006 | D&D rules validation |
| PostgreSQL | 5432 | 5432 | Database access |
| Redis | 6379 | 6379 | Cache & pub/sub |
| **Character UI** | 3000 | **3010** | **⚔️ Character Interface** |
| Fighter Redis | 6379 | 6381 | Character-specific cache |

## 🚀 **Key Interaction Highlights**

### **Real-time Communication:**
- **WebSocket Hub**: Dungeon Master coordinates all real-time events
- **Character Registration**: Automatic connection to game server
- **Event Broadcasting**: Actions propagate to all connected clients

### **Data Persistence:**
- **PostgreSQL**: Permanent game state, user data, world information
- **Redis**: Session management, caching, real-time event streaming
- **Character Data**: Persistent volumes for character state

### **AI Integration:**
- **Character AI**: Independent AI decision-making per character
- **Monster AI**: Centralized monster behavior management
- **Communication AI**: Discord bot for external player interaction

## 🎯 **Access Your Services:**

- **🌟 Dungeon Master Dashboard**: http://localhost:3001
- **⚔️ Character Interface**: http://localhost:3010
- **🌍 Main Game**: http://localhost:80 (via NGINX)
- **📊 Database Admin**: http://localhost:8080 (if enabled)

Your distributed D&D system is a masterpiece of microservices architecture! 🐉✨