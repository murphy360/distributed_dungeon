#!/bin/bash

# Manual Test Script for Character Containers
# This script performs basic functionality tests on a running character container

echo "🧪 Starting Manual Character Container Test..."
echo "======================================================"

# Configuration
CHARACTER_URL="http://localhost:3001"
TIMEOUT=10

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper function for HTTP requests with timeout
make_request() {
    local url=$1
    local method=${2:-GET}
    local data=${3:-}
    local expected=${4:-}
    
    if [ "$method" = "POST" ] && [ -n "$data" ]; then
        response=$(curl -s -m $TIMEOUT -X POST -H "Content-Type: application/json" -d "$data" "$url" 2>/dev/null)
    else
        response=$(curl -s -m $TIMEOUT "$url" 2>/dev/null)
    fi
    
    if [ $? -eq 0 ]; then
        if [ -n "$expected" ] && echo "$response" | grep -q "$expected"; then
            return 0
        elif [ -z "$expected" ]; then
            return 0
        else
            echo "Expected '$expected' not found in: $response"
            return 1
        fi
    else
        echo "Request failed or timed out"
        return 1
    fi
}

# Test function wrapper
run_test() {
    local test_name="$1"
    local test_func="$2"
    
    echo -n "$test_name... "
    
    if $test_func; then
        echo -e "${GREEN}✅ PASSED${NC}"
        return 0
    else
        echo -e "${RED}❌ FAILED${NC}"
        return 1
    fi
}

# Test 1: Container Health Check
test_health_check() {
    make_request "$CHARACTER_URL/health" "GET" "" "healthy"
}

# Test 2: Character Information Retrieval
test_character_info() {
    make_request "$CHARACTER_URL/api/character" "GET" "" "fighter"
}

# Test 3: AI Status Check
test_ai_status() {
    make_request "$CHARACTER_URL/api/ai/status" "GET" "" "enabled"
}

# Test 4: Character State Persistence
test_character_state() {
    make_request "$CHARACTER_URL/api/character/save" "POST" "{}" "success"
}

# Test 5: API Response Time
test_response_time() {
    local start_time=$(date +%s%N)
    make_request "$CHARACTER_URL/health"
    local end_time=$(date +%s%N)
    local response_time=$(( (end_time - start_time) / 1000000 )) # Convert to milliseconds
    
    if [ $response_time -lt 1000 ]; then # Less than 1 second
        return 0
    else
        echo "Response time too slow: ${response_time}ms"
        return 1
    fi
}

# Test 6: Error Handling
test_error_handling() {
    local error_response=$(curl -s -m $TIMEOUT "$CHARACTER_URL/api/nonexistent" 2>/dev/null)
    if echo "$error_response" | grep -q "404\|error\|not found"; then
        return 0
    else
        echo "Expected error response not received"
        return 1
    fi
}

# Test 7: AI Decision Making (Mock)
test_ai_decision() {
    local test_data='{"scenario": "test", "gameState": {"combat": {"enemies": [{"id": "test-enemy", "hp": 10}]}}, "availableActions": [{"type": "attack", "target": "test-enemy"}]}'
    make_request "$CHARACTER_URL/api/ai/test-decision" "POST" "$test_data" "action"
}

# Main test execution
echo "Testing character container at: $CHARACTER_URL"
echo "Timeout set to: ${TIMEOUT}s"
echo ""

# Wait for container to be ready
echo "Waiting for container to be ready..."
for i in {1..30}; do
    if curl -s -m 2 "$CHARACTER_URL/health" >/dev/null 2>&1; then
        echo -e "${GREEN}Container is ready!${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}Container failed to start within 60 seconds${NC}"
        exit 1
    fi
    sleep 2
    echo -n "."
done

echo ""
echo "Running tests..."
echo "=================="

# Run all tests
tests_passed=0
total_tests=0

# Basic functionality tests
run_test "1. Health Check" test_health_check && ((tests_passed++))
((total_tests++))

run_test "2. Character Info" test_character_info && ((tests_passed++))
((total_tests++))

run_test "3. AI Status" test_ai_status && ((tests_passed++))
((total_tests++))

run_test "4. State Persistence" test_character_state && ((tests_passed++))
((total_tests++))

run_test "5. Response Time" test_response_time && ((tests_passed++))
((total_tests++))

run_test "6. Error Handling" test_error_handling && ((tests_passed++))
((total_tests++))

# Optional AI test (might not be implemented yet)
if curl -s -m 2 "$CHARACTER_URL/api/ai/test-decision" >/dev/null 2>&1; then
    run_test "7. AI Decision (Optional)" test_ai_decision && ((tests_passed++))
    ((total_tests++))
else
    echo -e "7. AI Decision (Optional)... ${YELLOW}⚠️  SKIPPED (endpoint not available)${NC}"
fi

# Results summary
echo ""
echo "======================================================"
echo "Test Results Summary:"
echo "======================================================"

if [ $tests_passed -eq $total_tests ]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED! ($tests_passed/$total_tests)${NC}"
    exit 0
else
    echo -e "${RED}❌ SOME TESTS FAILED ($tests_passed/$total_tests passed)${NC}"
    echo ""
    echo "Troubleshooting tips:"
    echo "1. Check container logs: docker-compose logs character-container"
    echo "2. Verify container is running: docker-compose ps"
    echo "3. Check network connectivity: curl $CHARACTER_URL/health"
    echo "4. Review environment configuration in .env file"
    exit 1
fi