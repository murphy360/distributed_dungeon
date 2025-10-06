# Testing Guide for Distributed Character Containers

This guide covers comprehensive testing strategies for the distributed character container system, from unit tests to full integration testing.

## 🧪 Testing Strategy Overview

### Testing Levels

1. **Unit Tests** - Individual component testing
2. **Integration Tests** - Character container + game system integration  
3. **End-to-End Tests** - Full distributed system testing
4. **Load Tests** - Multiple character performance testing
5. **AI Behavior Tests** - AI decision validation

## 🚀 Quick Test Setup

### Prerequisites

```bash
# Ensure main system is running
cd distributed_dungeon
docker-compose up -d

# Verify all services are healthy
docker-compose ps
```

### 1. Manual Character Container Test

```bash
# Start a test character
cd character-containers/example-fighter
cp .env.example .env

# Edit .env for testing
CHARACTER_NAME=test-fighter
CHARACTER_PORT=3001
LOG_LEVEL=debug

# Run the character container
docker-compose up -d

# Test basic functionality
./test/manual-test.sh
```

### 2. Automated Test Suite

```bash
# Run all tests
npm run test:all

# Run specific test categories
npm run test:unit
npm run test:integration
npm run test:e2e
```

## 🔬 Unit Testing

### Character Component Tests

Test individual character container components in isolation:

#### State Management Tests
```bash
npm run test -- --grep "CharacterState"
```

#### AI Decision Tests  
```bash
npm run test -- --grep "CombatAI"
npm run test -- --grep "ExplorationAI"
```

#### Communication Tests
```bash
npm run test -- --grep "Registry"
npm run test -- --grep "EventHandler"
```

### Example Unit Test Execution

```bash
cd character-containers/base-character
npm test

# Expected output:
# ✓ CharacterState should initialize with default values
# ✓ CharacterState should persist and restore state
# ✓ CombatAI should make valid combat decisions
# ✓ ExplorationAI should navigate dungeons logically
# ✓ Registry should handle authentication
```

## 🔗 Integration Testing

### Character-Game System Integration

Test how character containers interact with the main game system:

#### Registration Integration Test

```bash
# Test character registration with game system
cd character-containers/test-utils
node integration-test.js registration

# Expected: Character successfully registers and receives token
```

#### Combat Integration Test

```bash
# Test combat event handling
node integration-test.js combat

# Expected: Character receives combat events and responds appropriately
```

#### Exploration Integration Test  

```bash
# Test exploration event handling  
node integration-test.js exploration

# Expected: Character processes room changes and makes decisions
```

### Manual Integration Testing

```bash
# Terminal 1: Start main system
cd distributed_dungeon
docker-compose up

# Terminal 2: Start test character
cd character-containers/example-fighter
docker-compose up

# Terminal 3: Run integration tests
curl http://localhost:3001/api/character/status
curl http://localhost:3001/health

# Test character registration
curl -X POST http://localhost:3000/api/characters/register \
  -H "Content-Type: application/json" \
  -d '{"characterEndpoint": "http://localhost:3001"}'
```

## 🌐 End-to-End Testing

### Full System Test

Test complete gameplay scenarios with multiple characters:

#### Multi-Character Dungeon Test

```bash
# Start main system
cd distributed_dungeon  
docker-compose up -d

# Start multiple characters
./scripts/deploy-test-party.sh

# Run E2E test scenario
cd character-containers/test-utils
node e2e-test.js dungeon-crawl

# Expected: 3 characters complete a dungeon with combat and exploration
```

#### Party Coordination Test

```bash
# Test character cooperation
node e2e-test.js party-coordination

# Expected: Characters coordinate in combat and share resources
```

### Automated E2E Test Suite

```bash
# Run full E2E suite
npm run test:e2e

# Tests include:
# - Character container startup and registration
# - Multi-character combat scenarios  
# - Exploration and decision-making
# - Resource management and persistence
# - Error handling and recovery
```

## 🤖 AI Behavior Testing

### Combat AI Validation

Test AI decision-making in various combat scenarios:

```bash
# Test aggressive fighter AI
cd character-containers/test-utils
node ai-test.js combat --character fighter --scenario "outnumbered"

# Expected: Fighter uses Action Surge and focuses on strongest enemy
```

### Exploration AI Validation

```bash
# Test cautious wizard AI
node ai-test.js exploration --character wizard --scenario "trapped_room"

# Expected: Wizard uses Detect Magic before proceeding
```

### Personality Configuration Test

```bash
# Test different AI personalities
node ai-test.js personality --aggressiveness 0.9 --caution 0.1
node ai-test.js personality --aggressiveness 0.2 --caution 0.8

# Expected: Different decision patterns based on personality
```

## ⚡ Load Testing

### Multiple Character Performance

Test system performance with many character containers:

```bash
# Start load test with 10 characters
cd character-containers/test-utils
node load-test.js --characters 10 --duration 5min

# Monitor system resources
docker stats

# Expected: System remains stable with acceptable response times
```

### Concurrent Combat Test

```bash
# Test multiple simultaneous combats
node load-test.js --scenario concurrent-combat --battles 5

# Expected: All combats resolve correctly without conflicts
```

## 🔧 Testing Tools and Scripts

### Manual Testing Script

Create comprehensive manual testing:

```bash
# character-containers/test-utils/manual-test.sh
#!/bin/bash

echo "🧪 Starting Manual Character Container Test..."

# Test 1: Health Check
echo "1. Testing health endpoint..."
HEALTH=$(curl -s http://localhost:3001/health)
if echo "$HEALTH" | grep -q "healthy"; then
    echo "✅ Health check passed"
else
    echo "❌ Health check failed: $HEALTH"
    exit 1
fi

# Test 2: Character Info
echo "2. Testing character info..."
CHAR_INFO=$(curl -s http://localhost:3001/api/character)
if echo "$CHAR_INFO" | grep -q "fighter"; then
    echo "✅ Character info retrieved"
else
    echo "❌ Character info failed"
    exit 1
fi

# Test 3: AI Status
echo "3. Testing AI status..."
AI_STATUS=$(curl -s http://localhost:3001/api/ai/status)
if echo "$AI_STATUS" | grep -q "enabled"; then
    echo "✅ AI system active"
else
    echo "❌ AI system inactive"
    exit 1
fi

echo "🎉 All manual tests passed!"
```

### Integration Test Script

```bash
# character-containers/test-utils/integration-test.js
const axios = require('axios');
const io = require('socket.io-client');

async function testCharacterRegistration() {
    console.log('Testing character registration...');
    
    try {
        // Test registration with game system
        const response = await axios.post('http://localhost:3000/api/characters/register', {
            characterEndpoint: 'http://localhost:3001',
            characterId: 'test-fighter-001'
        });
        
        if (response.data.success) {
            console.log('✅ Character registration successful');
            return response.data.token;
        } else {
            throw new Error('Registration failed');
        }
    } catch (error) {
        console.log('❌ Character registration failed:', error.message);
        return null;
    }
}

async function testCombatIntegration(token) {
    console.log('Testing combat integration...');
    
    // Connect to game system WebSocket
    const socket = io('http://localhost:3000', {
        auth: { token }
    });
    
    return new Promise((resolve) => {
        socket.on('connect', () => {
            console.log('✅ Connected to game system');
            
            // Simulate combat event
            socket.emit('test_combat_event', {
                type: 'combat_turn',
                characterId: 'test-fighter-001',
                gameState: {
                    combat: {
                        enemies: [{ id: 'orc-1', hp: 15, type: 'melee' }],
                        allies: []
                    }
                },
                availableActions: [
                    { type: 'attack', target: 'orc-1', weapon: 'longsword' },
                    { type: 'defend' }
                ]
            });
        });
        
        socket.on('action_response', (response) => {
            if (response.action && response.action.type) {
                console.log('✅ Combat integration successful');
                console.log('Character action:', response.action.type);
                resolve(true);
            } else {
                console.log('❌ Combat integration failed');
                resolve(false);
            }
            socket.disconnect();
        });
        
        setTimeout(() => {
            console.log('❌ Combat integration timeout');
            socket.disconnect();
            resolve(false);
        }, 5000);
    });
}

async function runIntegrationTests() {
    console.log('🧪 Starting Integration Tests...\n');
    
    const token = await testCharacterRegistration();
    if (!token) return;
    
    await testCombatIntegration(token);
    
    console.log('\n🎉 Integration tests completed!');
}

if (require.main === module) {
    runIntegrationTests().catch(console.error);
}
```

## 📊 Test Monitoring and Reporting

### Test Results Dashboard

Monitor test results in real-time:

```bash
# Start test monitoring dashboard
cd character-containers/test-utils
node test-dashboard.js

# Access at http://localhost:8080
# Shows:
# - Test execution status
# - Character container health
# - Performance metrics
# - Error logs
```

### Automated Test Reports

```bash
# Generate test reports
npm run test:report

# Outputs:
# - test-results.html - Visual test report
# - coverage.html - Code coverage report
# - performance.json - Performance metrics
```

## 🐛 Debugging Failed Tests

### Common Test Failures

#### Character Won't Start
```bash
# Check Docker logs
docker-compose logs character-container

# Common issues:
# - Port conflicts
# - Missing environment variables
# - Network connectivity
```

#### Registration Failures
```bash
# Check game system connectivity
curl http://localhost:3000/health

# Check character endpoint accessibility
curl http://localhost:3001/health

# Verify network configuration
docker network ls
```

#### AI Decision Failures
```bash
# Enable debug logging
LOG_LEVEL=debug docker-compose up

# Check AI decision logs
docker-compose logs | grep "AI"
```

### Debug Commands

```bash
# Interactive character container debugging
docker-compose exec character-container sh

# Check character state file
cat /app/data/character-state.db

# Test Redis connectivity
redis-cli -h redis -p 6379 ping

# Check WebSocket connection
curl -i http://localhost:3001/socket.io/

# Manual AI test
curl -X POST http://localhost:3001/api/ai/test-decision \
  -H "Content-Type: application/json" \
  -d '{"scenario": "combat", "enemies": [{"id": "test", "hp": 10}]}'
```

## 🎯 Test Scenarios

### Scenario 1: Solo Character Test

```bash
# Test single character functionality
cd character-containers/example-fighter
docker-compose up -d

# Wait for startup
sleep 10

# Run solo tests
curl http://localhost:3001/health
curl http://localhost:3001/api/character
curl http://localhost:3001/api/ai/status

echo "✅ Solo character test complete"
```

### Scenario 2: Multi-Character Test

```bash
# Test multiple characters
cd character-containers

# Start fighter
CHARACTER_NAME=fighter CHARACTER_PORT=3001 docker-compose -f example-fighter/docker-compose.yml up -d

# Start wizard (when we create it)
# CHARACTER_NAME=wizard CHARACTER_PORT=3002 docker-compose -f example-wizard/docker-compose.yml up -d

# Test party interaction
# curl http://localhost:3001/api/character/party
# curl http://localhost:3002/api/character/party

echo "✅ Multi-character test complete"
```

### Scenario 3: Combat Simulation Test

```bash
# Test combat scenarios
cd character-containers/test-utils
node combat-simulation.js

# Simulates:
# - Initiative rolls
# - Turn-based combat
# - AI decision making
# - Damage resolution
# - Victory conditions
```

### Scenario 4: Stress Test

```bash
# Test system under load
cd character-containers/test-utils
node stress-test.js --characters 20 --concurrent-actions 100

# Monitors:
# - Response times
# - Memory usage
# - CPU utilization
# - Error rates
```

## 📋 Test Checklist

Before deploying character containers to production:

### ✅ Basic Functionality
- [ ] Character container starts successfully
- [ ] Health endpoint responds correctly
- [ ] Character state persists across restarts
- [ ] API endpoints return valid responses
- [ ] Docker container builds without errors

### ✅ Game Integration  
- [ ] Character registers with game system
- [ ] Authentication tokens work correctly
- [ ] WebSocket connection establishes
- [ ] Combat events processed correctly
- [ ] Exploration events handled properly

### ✅ AI Behavior
- [ ] Combat AI makes logical decisions
- [ ] Exploration AI navigates effectively
- [ ] Personality traits affect decisions
- [ ] AI responds to different scenarios
- [ ] Decision-making performance acceptable

### ✅ Performance
- [ ] Response times under 200ms
- [ ] Memory usage stable over time
- [ ] CPU usage within acceptable limits
- [ ] Container restarts gracefully
- [ ] Multiple characters perform well

### ✅ Error Handling
- [ ] Network failures handled gracefully
- [ ] Invalid events rejected properly
- [ ] State corruption recovery works
- [ ] Logging provides useful information
- [ ] Monitoring alerts function correctly

## 🎉 Running the Complete Test Suite

Execute all tests in the proper sequence:

```bash
# 1. Start the main game system
cd distributed_dungeon
docker-compose up -d
sleep 30  # Wait for services to be ready

# 2. Run unit tests
cd character-containers/base-character
npm test

# 3. Start test character
cd ../example-fighter
docker-compose up -d
sleep 10

# 4. Run integration tests
cd ../test-utils
node integration-test.js

# 5. Run E2E tests
node e2e-test.js

# 6. Run performance tests
node load-test.js --characters 5 --duration 2min

# 7. Generate reports
npm run test:report

echo "🎉 Complete test suite finished!"
echo "Check test-results.html for detailed results"
```

This comprehensive testing strategy ensures your distributed character container system is robust, performant, and ready for production deployment! 🧪⚔️🛡️