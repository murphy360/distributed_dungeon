#!/bin/bash
# Development setup script for Distributed Dungeon

set -e

echo "🏰 Setting up Distributed Dungeon development environment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose > /dev/null 2>&1; then
    echo "❌ Docker Compose is not installed. Please install it and try again."
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "✅ Created .env file. Please review and update the configuration."
else
    echo "✅ .env file already exists"
fi

# Create logs directory
mkdir -p logs
echo "✅ Created logs directory"

# Create uploads directory
mkdir -p uploads
echo "✅ Created uploads directory"

# Install dependencies for all services
echo "📦 Installing Node.js dependencies for all services..."

services=("dungeon-master" "dungeon" "monster" "player" "communication" "rules-engine")

for service in "${services[@]}"; do
    if [ -f "services/$service/package.json" ]; then
        echo "Installing dependencies for $service..."
        cd "services/$service"
        npm install
        cd ../..
        echo "✅ Dependencies installed for $service"
    else
        echo "⚠️  No package.json found for $service, skipping..."
    fi
done

# Build Docker images
echo "🐳 Building Docker images..."
docker-compose build

# Start the database first
echo "🗄️  Starting database services..."
docker-compose up -d database redis

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 10

# Check database health
max_attempts=30
attempt=1
while ! docker-compose exec -T database pg_isready -U postgres -d dungeon_db > /dev/null 2>&1; do
    if [ $attempt -eq $max_attempts ]; then
        echo "❌ Database failed to start after $max_attempts attempts"
        exit 1
    fi
    echo "Waiting for database... (attempt $attempt/$max_attempts)"
    sleep 2
    ((attempt++))
done

echo "✅ Database is ready"

# Run database migrations
echo "🔄 Running database migrations..."
docker-compose exec -T database psql -U postgres -d dungeon_db -f /docker-entrypoint-initdb.d/001_initial_schema.sql
docker-compose exec -T database psql -U postgres -d dungeon_db -f /docker-entrypoint-initdb.d/seeds/001_core_data.sql

echo "✅ Database migrations completed"

# Start all services
echo "🚀 Starting all services..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 15

# Health check all services
services_ports=("3001" "3002" "3003" "3004" "3005" "3006")
service_names=("Dungeon Master" "Dungeon" "Monster" "Player" "Communication" "Rules Engine")

for i in "${!services_ports[@]}"; do
    port="${services_ports[$i]}"
    name="${service_names[$i]}"
    
    if curl -f "http://localhost:$port/health" > /dev/null 2>&1; then
        echo "✅ $name service is healthy (port $port)"
    else
        echo "⚠️  $name service may not be ready yet (port $port)"
    fi
done

echo ""
echo "🎉 Development environment setup complete!"
echo ""
echo "📊 Service Status:"
echo "- Dungeon Master:  http://localhost:3001"
echo "- Dungeon Service: http://localhost:3002"
echo "- Monster Service: http://localhost:3003"
echo "- Player Service:  http://localhost:3004"
echo "- Communication:   http://localhost:3005"
echo "- Rules Engine:    http://localhost:3006"
echo ""
echo "🗄️  Database Access:"
echo "- PostgreSQL:      localhost:5432 (user: postgres, db: dungeon_db)"
echo "- Redis:           localhost:6379"
echo "- Adminer:         http://localhost:8080 (if admin profile enabled)"
echo ""
echo "🔧 Useful Commands:"
echo "- View logs:       docker-compose logs -f [service-name]"
echo "- Stop services:   docker-compose down"
echo "- Restart service: docker-compose restart [service-name]"
echo "- Shell access:    docker-compose exec [service-name] /bin/sh"
echo ""
echo "📖 Next Steps:"
echo "1. Review and update .env file with your API keys"
echo "2. Check the README.md for API documentation"
echo "3. Visit the docs/ folder for detailed architecture information"
echo ""
echo "Happy coding! 🎲"