const axios = require('axios');
const io = require('socket.io-client');

// Configuration
const CONFIG = {
    gameSystemUrl: 'http://localhost:3000',
    characterUrl: 'http://localhost:3001',
    timeout: 10000
};

// Colors for console output
const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    reset: '\x1b[0m'
};

// Utility functions
const log = {
    info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
    success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
    error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
    warning: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`)
};

// Wait for service to be ready
async function waitForService(url, maxAttempts = 30) {
    for (let i = 0; i < maxAttempts; i++) {
        try {
            await axios.get(`${url}/health`, { timeout: 2000 });
            return true;
        } catch (error) {
            if (i === maxAttempts - 1) return false;
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    return false;
}

// Test 1: Character Registration
async function testCharacterRegistration() {
    log.info('Testing character registration...');
    
    try {
        const response = await axios.post(`${CONFIG.gameSystemUrl}/api/characters/register`, {
            characterEndpoint: CONFIG.characterUrl,
            characterId: 'test-fighter-001',
            name: 'Test Fighter',
            class: 'fighter',
            level: 3
        }, { timeout: CONFIG.timeout });
        
        if (response.data.success && response.data.token) {
            log.success('Character registration successful');
            return {
                success: true,
                token: response.data.token,
                sessionId: response.data.sessionId
            };
        } else {
            throw new Error('Registration response missing success or token');
        }
    } catch (error) {
        log.error(`Character registration failed: ${error.message}`);
        return { success: false, error: error.message };
    }
}

// Test 2: Combat Event Integration
async function testCombatIntegration(token) {
    log.info('Testing combat integration...');
    
    return new Promise((resolve) => {
        const socket = io(CONFIG.gameSystemUrl, {
            auth: { token },
            timeout: CONFIG.timeout
        });
        
        let testCompleted = false;
        
        socket.on('connect', () => {
            log.info('Connected to game system WebSocket');
            
            // Simulate combat event
            const combatEvent = {
                type: 'combat_turn',
                characterId: 'test-fighter-001',
                gameState: {
                    combat: {
                        enemies: [
                            { id: 'orc-1', hp: 15, maxHp: 15, type: 'melee', ac: 13 }
                        ],
                        allies: [],
                        round: 1,
                        initiative: ['test-fighter-001', 'orc-1']
                    },
                    currentRoom: {
                        id: 'test-room',
                        description: 'A test combat room'
                    }
                },
                availableActions: [
                    { type: 'attack', target: 'orc-1', weapon: 'longsword' },
                    { type: 'defend' },
                    { type: 'dodge' }
                ]
            };
            
            socket.emit('combat_event', combatEvent);
        });
        
        socket.on('action_response', (response) => {
            if (testCompleted) return;
            testCompleted = true;
            
            if (response && response.action && response.action.type) {
                log.success(`Combat integration successful - Action: ${response.action.type}`);
                socket.disconnect();
                resolve({ success: true, action: response.action });
            } else {
                log.error('Combat integration failed - Invalid response');
                socket.disconnect();
                resolve({ success: false, error: 'Invalid response format' });
            }
        });
        
        socket.on('connect_error', (error) => {
            if (testCompleted) return;
            testCompleted = true;
            log.error(`WebSocket connection failed: ${error.message}`);
            resolve({ success: false, error: error.message });
        });
        
        // Timeout fallback
        setTimeout(() => {
            if (testCompleted) return;
            testCompleted = true;
            log.error('Combat integration timeout');
            socket.disconnect();
            resolve({ success: false, error: 'Timeout' });
        }, CONFIG.timeout);
    });
}

// Test 3: Exploration Event Integration
async function testExplorationIntegration(token) {
    log.info('Testing exploration integration...');
    
    return new Promise((resolve) => {
        const socket = io(CONFIG.gameSystemUrl, {
            auth: { token },
            timeout: CONFIG.timeout
        });
        
        let testCompleted = false;
        
        socket.on('connect', () => {
            const explorationEvent = {
                type: 'room_entered',
                characterId: 'test-fighter-001',
                gameState: {
                    currentRoom: {
                        id: 'dungeon-room-1',
                        description: 'A dark stone corridor with ancient carvings',
                        exits: ['north', 'east'],
                        features: [
                            { type: 'chest', locked: true, hidden: false },
                            { type: 'trap', hidden: true, detected: false }
                        ],
                        lighting: 'dim'
                    },
                    party: ['test-fighter-001']
                },
                availableActions: [
                    { type: 'move', direction: 'north' },
                    { type: 'move', direction: 'east' },
                    { type: 'investigate', target: 'chest' },
                    { type: 'search', skill: 'perception' }
                ]
            };
            
            socket.emit('exploration_event', explorationEvent);
        });
        
        socket.on('action_response', (response) => {
            if (testCompleted) return;
            testCompleted = true;
            
            if (response && response.acknowledged) {
                log.success(`Exploration integration successful - Response received`);
                socket.disconnect();
                resolve({ success: true, response });
            } else {
                log.error('Exploration integration failed - No acknowledgment');
                socket.disconnect();
                resolve({ success: false, error: 'No acknowledgment received' });
            }
        });
        
        socket.on('connect_error', (error) => {
            if (testCompleted) return;
            testCompleted = true;
            log.error(`WebSocket connection failed: ${error.message}`);
            resolve({ success: false, error: error.message });
        });
        
        setTimeout(() => {
            if (testCompleted) return;
            testCompleted = true;
            log.error('Exploration integration timeout');
            socket.disconnect();
            resolve({ success: false, error: 'Timeout' });
        }, CONFIG.timeout);
    });
}

// Test 4: Character State Synchronization
async function testStateSynchronization() {
    log.info('Testing character state synchronization...');
    
    try {
        // Get initial character state
        const initialState = await axios.get(`${CONFIG.characterUrl}/api/character`, {
            timeout: CONFIG.timeout
        });
        
        if (!initialState.data.character) {
            throw new Error('No character data received');
        }
        
        // Modify character state (simulate taking damage)
        const damageData = {
            damage: 5,
            damageType: 'slashing',
            source: 'test'
        };
        
        const damageResponse = await axios.post(`${CONFIG.characterUrl}/api/character/damage`, damageData, {
            timeout: CONFIG.timeout
        });
        
        if (!damageResponse.data.success) {
            throw new Error('Damage application failed');
        }
        
        // Verify state change
        const modifiedState = await axios.get(`${CONFIG.characterUrl}/api/character`, {
            timeout: CONFIG.timeout
        });
        
        const initialHp = initialState.data.character.hp;
        const modifiedHp = modifiedState.data.character.hp;
        
        if (modifiedHp < initialHp) {
            log.success(`State synchronization successful - HP: ${initialHp} → ${modifiedHp}`);
            return { success: true, hpChange: initialHp - modifiedHp };
        } else {
            throw new Error('HP did not decrease as expected');
        }
        
    } catch (error) {
        log.error(`State synchronization failed: ${error.message}`);
        return { success: false, error: error.message };
    }
}

// Test 5: Error Handling and Recovery
async function testErrorHandling() {
    log.info('Testing error handling and recovery...');
    
    try {
        // Test invalid endpoint
        try {
            await axios.get(`${CONFIG.characterUrl}/api/invalid-endpoint`, {
                timeout: CONFIG.timeout
            });
            throw new Error('Expected 404 error but request succeeded');
        } catch (error) {
            if (error.response && error.response.status === 404) {
                log.success('404 error handling works correctly');
            } else {
                throw error;
            }
        }
        
        // Test invalid JSON payload
        try {
            await axios.post(`${CONFIG.characterUrl}/api/character/action`, 
                'invalid json', 
                {
                    headers: { 'Content-Type': 'application/json' },
                    timeout: CONFIG.timeout
                }
            );
            throw new Error('Expected JSON parsing error but request succeeded');
        } catch (error) {
            if (error.response && error.response.status === 400) {
                log.success('JSON validation error handling works correctly');
            } else {
                throw error;
            }
        }
        
        return { success: true };
        
    } catch (error) {
        log.error(`Error handling test failed: ${error.message}`);
        return { success: false, error: error.message };
    }
}

// Main test runner
async function runIntegrationTests() {
    console.log('🧪 Starting Integration Tests for Character Containers');
    console.log('======================================================\n');
    
    const results = {
        total: 0,
        passed: 0,
        failed: 0,
        tests: []
    };
    
    // Wait for services to be ready
    log.info('Waiting for game system to be ready...');
    if (!(await waitForService(CONFIG.gameSystemUrl))) {
        log.error('Game system is not responding. Please start the main system first.');
        return process.exit(1);
    }
    
    log.info('Waiting for character container to be ready...');
    if (!(await waitForService(CONFIG.characterUrl))) {
        log.error('Character container is not responding. Please start the character container first.');
        return process.exit(1);
    }
    
    log.success('All services are ready!\n');
    
    // Test 1: Character Registration
    results.total++;
    const registrationResult = await testCharacterRegistration();
    if (registrationResult.success) {
        results.passed++;
        results.tests.push({ name: 'Character Registration', status: 'PASSED' });
    } else {
        results.failed++;
        results.tests.push({ name: 'Character Registration', status: 'FAILED', error: registrationResult.error });
    }
    
    // Only continue with other tests if registration succeeded
    if (registrationResult.success) {
        const token = registrationResult.token;
        
        // Test 2: Combat Integration
        results.total++;
        const combatResult = await testCombatIntegration(token);
        if (combatResult.success) {
            results.passed++;
            results.tests.push({ name: 'Combat Integration', status: 'PASSED' });
        } else {
            results.failed++;
            results.tests.push({ name: 'Combat Integration', status: 'FAILED', error: combatResult.error });
        }
        
        // Test 3: Exploration Integration
        results.total++;
        const explorationResult = await testExplorationIntegration(token);
        if (explorationResult.success) {
            results.passed++;
            results.tests.push({ name: 'Exploration Integration', status: 'PASSED' });
        } else {
            results.failed++;
            results.tests.push({ name: 'Exploration Integration', status: 'FAILED', error: explorationResult.error });
        }
    } else {
        log.warning('Skipping integration tests due to registration failure');
    }
    
    // Test 4: State Synchronization (independent of registration)
    results.total++;
    const stateResult = await testStateSynchronization();
    if (stateResult.success) {
        results.passed++;
        results.tests.push({ name: 'State Synchronization', status: 'PASSED' });
    } else {
        results.failed++;
        results.tests.push({ name: 'State Synchronization', status: 'FAILED', error: stateResult.error });
    }
    
    // Test 5: Error Handling
    results.total++;
    const errorResult = await testErrorHandling();
    if (errorResult.success) {
        results.passed++;
        results.tests.push({ name: 'Error Handling', status: 'PASSED' });
    } else {
        results.failed++;
        results.tests.push({ name: 'Error Handling', status: 'FAILED', error: errorResult.error });
    }
    
    // Print results
    console.log('\n======================================================');
    console.log('Integration Test Results:');
    console.log('======================================================');
    
    results.tests.forEach((test, index) => {
        const status = test.status === 'PASSED' 
            ? `${colors.green}✅ PASSED${colors.reset}`
            : `${colors.red}❌ FAILED${colors.reset}`;
        console.log(`${index + 1}. ${test.name}: ${status}`);
        if (test.error) {
            console.log(`   Error: ${test.error}`);
        }
    });
    
    console.log('\n======================================================');
    if (results.passed === results.total) {
        log.success(`🎉 ALL INTEGRATION TESTS PASSED! (${results.passed}/${results.total})`);
        process.exit(0);
    } else {
        log.error(`❌ SOME INTEGRATION TESTS FAILED (${results.passed}/${results.total} passed)`);
        console.log('\nTroubleshooting tips:');
        console.log('1. Ensure the main game system is running: docker-compose up -d');
        console.log('2. Ensure the character container is running: docker-compose up -d');
        console.log('3. Check service logs for errors');
        console.log('4. Verify network connectivity between containers');
        process.exit(1);
    }
}

// Handle command line arguments
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
        console.log('Integration Test Runner for Character Containers');
        console.log('Usage: node integration-test.js [options]');
        console.log('');
        console.log('Options:');
        console.log('  --game-url <url>      Game system URL (default: http://localhost:3000)');
        console.log('  --character-url <url> Character container URL (default: http://localhost:3001)');
        console.log('  --timeout <ms>        Request timeout in milliseconds (default: 10000)');
        console.log('  --help, -h           Show this help message');
        process.exit(0);
    }
    
    // Parse command line arguments
    const gameUrlIndex = args.indexOf('--game-url');
    if (gameUrlIndex !== -1 && args[gameUrlIndex + 1]) {
        CONFIG.gameSystemUrl = args[gameUrlIndex + 1];
    }
    
    const characterUrlIndex = args.indexOf('--character-url');
    if (characterUrlIndex !== -1 && args[characterUrlIndex + 1]) {
        CONFIG.characterUrl = args[characterUrlIndex + 1];
    }
    
    const timeoutIndex = args.indexOf('--timeout');
    if (timeoutIndex !== -1 && args[timeoutIndex + 1]) {
        CONFIG.timeout = parseInt(args[timeoutIndex + 1]);
    }
    
    runIntegrationTests().catch(error => {
        log.error(`Integration test runner failed: ${error.message}`);
        process.exit(1);
    });
}

module.exports = {
    runIntegrationTests,
    testCharacterRegistration,
    testCombatIntegration,
    testExplorationIntegration,
    testStateSynchronization,
    testErrorHandling
};