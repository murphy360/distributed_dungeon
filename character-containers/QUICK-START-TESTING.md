# Quick Start Testing Guide

This guide will get you testing the distributed character container system in just a few minutes!

## 🚀 Prerequisites

1. **Main Game System Running**:
   ```powershell
   cd distributed_dungeon
   docker-compose up -d
   ```

2. **Verify Game System**:
   ```powershell
   curl http://localhost:3000/health
   # Should return: {"status":"healthy",...}
   ```

## 🧪 Option 1: Quick Manual Test (Recommended for First Time)

### Step 1: Start a Character Container
```powershell
cd character-containers\example-fighter
cp .env.example .env
docker-compose up -d
```

### Step 2: Run Manual Tests
```powershell
# Windows PowerShell
cd ..\test-utils
.\manual-test.ps1

# Or if you have bash (Git Bash/WSL)
bash manual-test.sh
```

**Expected Output:**
```
🧪 Starting Manual Character Container Test...
1. Health Check... ✅ PASSED
2. Character Info... ✅ PASSED  
3. AI Status... ✅ PASSED
4. State Persistence... ✅ PASSED
5. Response Time... ✅ PASSED
6. Error Handling... ✅ PASSED
🎉 ALL TESTS PASSED! (6/6)
```

## 🤖 Option 2: Automated Test Suite

### Step 1: Install Test Dependencies
```powershell
cd character-containers\test-utils
npm install
```

### Step 2: Deploy Test Character and Run Integration Tests
```powershell
# Deploy a test character automatically
.\deploy-test-party.ps1 fighter

# Run integration tests
node integration-test.js
```

**Expected Output:**
```
🧪 Starting Integration Tests for Character Containers
✅ Character registration successful
✅ Combat integration successful - Action: attack
✅ Exploration integration successful
✅ State synchronization successful
✅ Error handling works correctly
🎉 ALL INTEGRATION TESTS PASSED! (5/5)
```

## 🎮 Option 3: Full Multi-Character Test

### Deploy Multiple Characters
```powershell
# Deploy a full party (fighter + future characters)
.\deploy-test-party.ps1 fighter

# When more characters are available:
# .\deploy-test-party.ps1 fighter,wizard,rogue
```

### Test Party Interaction
```powershell
# Test each character individually
Invoke-WebRequest http://localhost:3001/health  # Fighter
# Invoke-WebRequest http://localhost:3002/health  # Wizard (when available)
# Invoke-WebRequest http://localhost:3003/health  # Rogue (when available)

# Run integration tests on all characters
node integration-test.js --character-url http://localhost:3001
# node integration-test.js --character-url http://localhost:3002
# node integration-test.js --character-url http://localhost:3003
```

## 🔧 Troubleshooting

### Character Won't Start
```powershell
# Check logs
docker-compose logs character-container

# Common fixes:
# 1. Port already in use - change CHARACTER_PORT in .env
# 2. Main system not running - run: docker-compose up -d in main directory
# 3. Network issues - check: docker network ls
```

### Tests Failing
```powershell
# Check character is healthy
curl http://localhost:3001/health

# Check main system is healthy  
curl http://localhost:3000/health

# Restart character if needed
docker-compose restart character-container
```

### Cleanup After Testing
```powershell
# Stop and remove all test characters
.\deploy-test-party.ps1 -Cleanup

# Or manually stop character
cd ..\example-fighter
docker-compose down
```

## 📊 What the Tests Validate

### Manual Tests
- ✅ Container health and startup
- ✅ Character API endpoints respond correctly
- ✅ AI system is active and configured
- ✅ State persistence works
- ✅ Response times are acceptable
- ✅ Error handling functions properly

### Integration Tests  
- ✅ Character registration with game system
- ✅ Real-time combat event processing
- ✅ Exploration event handling
- ✅ Character state synchronization
- ✅ WebSocket communication
- ✅ Authentication and security

### End-to-End Tests (Advanced)
- ✅ Multi-character coordination
- ✅ Full dungeon crawl simulation
- ✅ AI decision making under various scenarios
- ✅ Performance under load
- ✅ Error recovery and resilience

## 🎯 Success Criteria

**Your distributed character system is working correctly when:**

1. **Character Container Starts**: Container builds and runs without errors
2. **Health Checks Pass**: All API endpoints respond within acceptable time
3. **Game Integration Works**: Character can register and communicate with main system
4. **AI Makes Decisions**: Combat and exploration AI provide valid responses
5. **State Persists**: Character data survives container restarts
6. **Multiple Characters**: Can run multiple character containers simultaneously

## 🚀 Next Steps After Testing

Once tests pass, you can:

1. **Customize Characters**: Modify AI personality, abilities, and behavior
2. **Create New Character Classes**: Build wizard, rogue, cleric containers
3. **Deploy to Production**: Use production Docker configurations
4. **Scale Up**: Run parties of multiple characters
5. **Monitor Performance**: Use logging and metrics for optimization

## 📝 Test Results

Keep track of your test results:

```
Date: ___________
Character Container Version: _______
Test Results:
[ ] Manual Tests Passed (6/6)
[ ] Integration Tests Passed (5/5)
[ ] Multi-Character Tests Passed
[ ] Performance Acceptable
[ ] Ready for Production: Yes/No

Notes:
_________________________________
_________________________________
```

---

**Happy Testing!** 🧪⚔️🛡️

*Your distributed character containers are ready to adventure autonomously!*