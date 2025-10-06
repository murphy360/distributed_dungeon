#!/bin/bash

# Deploy Test Party Script
# Deploys multiple character containers for testing

echo "🚀 Deploying Test Party for Distributed Dungeon"
echo "================================================"

# Configuration
BASE_PORT=3001
CHARACTERS=("fighter" "wizard" "rogue" "cleric")
DEFAULT_CHARACTERS=("fighter")

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Helper functions
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }

# Parse command line arguments
DEPLOY_CHARACTERS=()
CLEANUP_MODE=false
DEVELOPMENT_MODE=false

for arg in "$@"; do
    case $arg in
        --cleanup)
            CLEANUP_MODE=true
            shift
            ;;
        --dev)
            DEVELOPMENT_MODE=true
            shift
            ;;
        --help)
            echo "Usage: $0 [OPTIONS] [CHARACTERS...]"
            echo ""
            echo "Deploy character containers for testing"
            echo ""
            echo "Options:"
            echo "  --cleanup    Stop and remove all character containers"
            echo "  --dev        Deploy in development mode with hot reload"
            echo "  --help       Show this help message"
            echo ""
            echo "Characters:"
            echo "  fighter      Deploy example fighter character"
            echo "  wizard       Deploy example wizard character (if available)"
            echo "  rogue        Deploy example rogue character (if available)"
            echo "  cleric       Deploy example cleric character (if available)"
            echo ""
            echo "Examples:"
            echo "  $0 fighter                    # Deploy single fighter"
            echo "  $0 fighter wizard rogue       # Deploy party of three"
            echo "  $0 --dev fighter              # Deploy fighter in dev mode"
            echo "  $0 --cleanup                  # Clean up all containers"
            exit 0
            ;;
        *)
            if [[ " ${CHARACTERS[@]} " =~ " $arg " ]]; then
                DEPLOY_CHARACTERS+=("$arg")
            else
                log_warning "Unknown character: $arg"
            fi
            shift
            ;;
    esac
done

# Use default if no characters specified
if [ ${#DEPLOY_CHARACTERS[@]} -eq 0 ] && [ "$CLEANUP_MODE" = false ]; then
    DEPLOY_CHARACTERS=("${DEFAULT_CHARACTERS[@]}")
fi

# Cleanup function
cleanup_characters() {
    log_info "Cleaning up character containers..."
    
    # Stop and remove character containers
    for container in $(docker ps -a --filter "name=character-" --format "{{.Names}}"); do
        log_info "Stopping container: $container"
        docker stop "$container" >/dev/null 2>&1
        docker rm "$container" >/dev/null 2>&1
    done
    
    # Remove character networks
    for network in $(docker network ls --filter "name=character-network" --format "{{.Name}}"); do
        log_info "Removing network: $network"
        docker network rm "$network" >/dev/null 2>&1
    done
    
    log_success "Cleanup completed"
}

# Check if character directory exists
check_character_exists() {
    local character=$1
    local char_dir="character-containers/example-$character"
    
    if [ ! -d "$char_dir" ]; then
        log_error "Character directory not found: $char_dir"
        return 1
    fi
    
    if [ ! -f "$char_dir/docker-compose.yml" ]; then
        log_error "Docker compose file not found: $char_dir/docker-compose.yml"
        return 1
    fi
    
    return 0
}

# Deploy single character
deploy_character() {
    local character=$1
    local port=$2
    local char_dir="character-containers/example-$character"
    
    log_info "Deploying $character character on port $port..."
    
    # Check if character exists
    if ! check_character_exists "$character"; then
        return 1
    fi
    
    # Set environment variables
    export CHARACTER_NAME="test-$character-$port"
    export CHARACTER_PORT="$port"
    export CHARACTER_CLASS="$character"
    export CHARACTER_LEVEL="3"
    export LOG_LEVEL="info"
    
    if [ "$DEVELOPMENT_MODE" = true ]; then
        export BUILD_TARGET="development"
        export VOLUME_MOUNT_TYPE="rw"
        export NODE_ENV="development"
        log_info "Deploying in development mode with hot reload"
    else
        export BUILD_TARGET="production"
        export VOLUME_MOUNT_TYPE="ro" 
        export NODE_ENV="production"
    fi
    
    # Set character-specific AI configuration
    case $character in
        fighter)
            export AI_AGGRESSIVENESS="0.7"
            export AI_CAUTION="0.4"
            export AI_CURIOSITY="0.5"
            export AI_TACTICAL="0.8"
            export FIGHTING_STYLE="defense"
            ;;
        wizard)
            export AI_AGGRESSIVENESS="0.3"
            export AI_CAUTION="0.8"
            export AI_CURIOSITY="0.9"
            export AI_TACTICAL="0.9"
            ;;
        rogue)
            export AI_AGGRESSIVENESS="0.6"
            export AI_CAUTION="0.7"
            export AI_CURIOSITY="0.8"
            export AI_TACTICAL="0.7"
            ;;
        cleric)
            export AI_AGGRESSIVENESS="0.4"
            export AI_CAUTION="0.6"
            export AI_CURIOSITY="0.6"
            export AI_TACTICAL="0.6"
            ;;
    esac
    
    # Deploy with docker-compose
    cd "$char_dir"
    
    if docker-compose up -d; then
        log_success "$character character deployed successfully"
        
        # Wait for container to be ready
        log_info "Waiting for $character to be ready..."
        for i in {1..30}; do
            if curl -s -m 2 "http://localhost:$port/health" >/dev/null 2>&1; then
                log_success "$character is ready and healthy!"
                break
            fi
            if [ $i -eq 30 ]; then
                log_error "$character failed to start within 60 seconds"
                return 1
            fi
            sleep 2
        done
        
        # Display character info
        character_info=$(curl -s "http://localhost:$port/api/character" 2>/dev/null)
        if [ $? -eq 0 ]; then
            echo "Character Info:"
            echo "$character_info" | jq '.' 2>/dev/null || echo "$character_info"
        fi
        
    else
        log_error "Failed to deploy $character character"
        return 1
    fi
    
    cd - >/dev/null
    return 0
}

# Main execution
if [ "$CLEANUP_MODE" = true ]; then
    cleanup_characters
    exit 0
fi

# Check prerequisites
log_info "Checking prerequisites..."

# Check if main system is running
if ! curl -s -m 5 "http://localhost:3000/health" >/dev/null 2>&1; then
    log_error "Main game system is not running!"
    log_info "Please start the main system first:"
    log_info "  cd distributed_dungeon"
    log_info "  docker-compose up -d"
    exit 1
fi

log_success "Main game system is running"

# Check Docker
if ! command -v docker >/dev/null 2>&1; then
    log_error "Docker is not installed or not in PATH"
    exit 1
fi

if ! command -v docker-compose >/dev/null 2>&1; then
    log_error "Docker Compose is not installed or not in PATH"
    exit 1
fi

# Check if we're in the right directory
if [ ! -d "character-containers" ]; then
    log_error "character-containers directory not found"
    log_info "Please run this script from the distributed_dungeon root directory"
    exit 1
fi

log_success "All prerequisites met"

# Deploy characters
log_info "Deploying ${#DEPLOY_CHARACTERS[@]} character(s): ${DEPLOY_CHARACTERS[*]}"

deployed_count=0
failed_count=0

for i in "${!DEPLOY_CHARACTERS[@]}"; do
    character="${DEPLOY_CHARACTERS[$i]}"
    port=$((BASE_PORT + i))
    
    if deploy_character "$character" "$port"; then
        ((deployed_count++))
    else
        ((failed_count++))
    fi
    
    echo # Add spacing between deployments
done

# Summary
echo "================================================"
echo "Deployment Summary:"
echo "================================================"

if [ $deployed_count -gt 0 ]; then
    log_success "$deployed_count character(s) deployed successfully"
    
    echo ""
    echo "Character Endpoints:"
    for i in "${!DEPLOY_CHARACTERS[@]}"; do
        character="${DEPLOY_CHARACTERS[$i]}"
        port=$((BASE_PORT + i))
        echo "  $character: http://localhost:$port"
    done
    
    echo ""
    echo "Testing Commands:"
    echo "  # Test all characters"
    echo "  cd character-containers/test-utils"
    echo "  node integration-test.js"
    echo ""
    echo "  # Manual health checks"
    for i in "${!DEPLOY_CHARACTERS[@]}"; do
        port=$((BASE_PORT + i))
        echo "  curl http://localhost:$port/health"
    done
    
    echo ""
    echo "  # View logs"
    echo "  docker-compose logs -f"
    
    echo ""
    echo "  # Cleanup when done"
    echo "  $0 --cleanup"
fi

if [ $failed_count -gt 0 ]; then
    log_error "$failed_count character(s) failed to deploy"
fi

echo "================================================"

if [ $deployed_count -gt 0 ] && [ $failed_count -eq 0 ]; then
    log_success "🎉 All characters deployed successfully!"
    exit 0
else
    log_error "❌ Some deployments failed"
    exit 1
fi