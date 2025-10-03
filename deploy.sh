#!/bin/bash

# Distributed Dungeon Deployment Script
# This script handles development and production deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
MODE="development"
BUILD_FLAG=""
DETACHED_FLAG=""

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS] COMMAND"
    echo ""
    echo "Commands:"
    echo "  dev         Start development environment"
    echo "  prod        Start production environment"
    echo "  stop        Stop all services"
    echo "  down        Stop and remove all containers, networks, volumes"
    echo "  build       Build all container images"
    echo "  logs        Show logs for all services"
    echo "  status      Show status of all services"
    echo "  clean       Clean up unused Docker resources"
    echo "  help        Show this help message"
    echo ""
    echo "Options:"
    echo "  -d, --detached    Run in detached mode"
    echo "  -b, --build       Force rebuild of images"
    echo "  -h, --help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 dev              # Start development environment"
    echo "  $0 dev -d           # Start development environment in background"
    echo "  $0 prod -b          # Start production with forced rebuild"
    echo "  $0 logs             # Show logs for all services"
    echo "  $0 stop             # Stop all running services"
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check if Docker is installed and running
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
    
    # Check if Docker Compose is available
    if ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not available. Please install Docker Compose."
        exit 1
    fi
    
    print_status "Prerequisites check passed!"
}

# Function to create environment file if it doesn't exist
create_env_file() {
    if [ ! -f .env ]; then
        print_warning ".env file not found. Creating from template..."
        if [ -f .env.example ]; then
            cp .env.example .env
            print_status "Created .env file from template. Please update it with your actual values."
        else
            print_error ".env.example file not found. Cannot create .env file."
            exit 1
        fi
    fi
}

# Function to start development environment
start_dev() {
    print_status "Starting development environment..."
    create_env_file
    
    COMPOSE_CMD="docker compose -f docker-compose.yml up"
    
    if [ "$BUILD_FLAG" = "--build" ]; then
        COMPOSE_CMD="$COMPOSE_CMD --build"
    fi
    
    if [ "$DETACHED_FLAG" = "-d" ]; then
        COMPOSE_CMD="$COMPOSE_CMD -d"
    fi
    
    print_status "Running: $COMPOSE_CMD"
    eval $COMPOSE_CMD
    
    if [ "$DETACHED_FLAG" = "-d" ]; then
        print_status "Development environment started in background!"
        print_status "Access the API at: http://localhost:8080"
        print_status "View logs with: $0 logs"
        print_status "Stop services with: $0 stop"
    fi
}

# Function to start production environment
start_prod() {
    print_status "Starting production environment..."
    create_env_file
    
    COMPOSE_CMD="docker compose -f docker-compose.prod.yml up"
    
    if [ "$BUILD_FLAG" = "--build" ]; then
        COMPOSE_CMD="$COMPOSE_CMD --build"
    fi
    
    if [ "$DETACHED_FLAG" = "-d" ]; then
        COMPOSE_CMD="$COMPOSE_CMD -d"
    fi
    
    print_status "Running: $COMPOSE_CMD"
    eval $COMPOSE_CMD
    
    if [ "$DETACHED_FLAG" = "-d" ]; then
        print_status "Production environment started in background!"
        print_status "Access the API at: http://localhost"
        print_status "View logs with: $0 logs"
        print_status "Stop services with: $0 stop"
    fi
}

# Function to stop services
stop_services() {
    print_status "Stopping all services..."
    docker compose -f docker-compose.yml down 2>/dev/null || true
    docker compose -f docker-compose.prod.yml down 2>/dev/null || true
    print_status "All services stopped!"
}

# Function to remove everything
down_services() {
    print_status "Stopping and removing all containers, networks, and volumes..."
    docker compose -f docker-compose.yml down -v 2>/dev/null || true
    docker compose -f docker-compose.prod.yml down -v 2>/dev/null || true
    print_status "All services, networks, and volumes removed!"
}

# Function to build images
build_images() {
    print_status "Building all container images..."
    docker compose -f docker-compose.yml build
    docker compose -f docker-compose.prod.yml build
    print_status "All images built successfully!"
}

# Function to show logs
show_logs() {
    print_status "Showing logs for all services..."
    # Try development first, then production
    if docker compose -f docker-compose.yml ps -q &>/dev/null && [ "$(docker compose -f docker-compose.yml ps -q)" ]; then
        docker compose -f docker-compose.yml logs -f
    elif docker compose -f docker-compose.prod.yml ps -q &>/dev/null && [ "$(docker compose -f docker-compose.prod.yml ps -q)" ]; then
        docker compose -f docker-compose.prod.yml logs -f
    else
        print_warning "No running services found."
    fi
}

# Function to show status
show_status() {
    print_status "Checking service status..."
    echo ""
    echo "Development Environment:"
    docker compose -f docker-compose.yml ps 2>/dev/null || print_warning "Development environment not running"
    echo ""
    echo "Production Environment:"
    docker compose -f docker-compose.prod.yml ps 2>/dev/null || print_warning "Production environment not running"
}

# Function to clean up Docker resources
clean_docker() {
    print_status "Cleaning up unused Docker resources..."
    docker system prune -f
    docker volume prune -f
    print_status "Docker cleanup completed!"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--detached)
            DETACHED_FLAG="-d"
            shift
            ;;
        -b|--build)
            BUILD_FLAG="--build"
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        dev|development)
            MODE="dev"
            shift
            ;;
        prod|production)
            MODE="prod"
            shift
            ;;
        stop)
            MODE="stop"
            shift
            ;;
        down)
            MODE="down"
            shift
            ;;
        build)
            MODE="build"
            shift
            ;;
        logs)
            MODE="logs"
            shift
            ;;
        status)
            MODE="status"
            shift
            ;;
        clean)
            MODE="clean"
            shift
            ;;
        help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Main execution
print_status "Distributed Dungeon Deployment Script"
print_status "======================================"

check_prerequisites

case $MODE in
    dev)
        start_dev
        ;;
    prod)
        start_prod
        ;;
    stop)
        stop_services
        ;;
    down)
        down_services
        ;;
    build)
        build_images
        ;;
    logs)
        show_logs
        ;;
    status)
        show_status
        ;;
    clean)
        clean_docker
        ;;
    *)
        print_error "No command specified"
        show_usage
        exit 1
        ;;
esac