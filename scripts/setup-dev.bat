@echo off
REM Development setup script for Distributed Dungeon (Windows)

echo 🏰 Setting up Distributed Dungeon development environment...

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker is not running. Please start Docker and try again.
    exit /b 1
)

REM Check if Docker Compose is available
docker-compose --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Docker Compose is not installed. Please install it and try again.
    exit /b 1
)

REM Create .env file if it doesn't exist
if not exist ".env" (
    echo 📝 Creating .env file from template...
    copy .env.example .env
    echo ✅ Created .env file. Please review and update the configuration.
) else (
    echo ✅ .env file already exists
)

REM Create logs directory
if not exist "logs" mkdir logs
echo ✅ Created logs directory

REM Create uploads directory
if not exist "uploads" mkdir uploads
echo ✅ Created uploads directory

REM Install dependencies for all services
echo 📦 Installing Node.js dependencies for all services...

set services=dungeon-master dungeon monster player communication rules-engine

for %%s in (%services%) do (
    if exist "services\%%s\package.json" (
        echo Installing dependencies for %%s...
        cd services\%%s
        call npm install
        cd ..\..
        echo ✅ Dependencies installed for %%s
    ) else (
        echo ⚠️  No package.json found for %%s, skipping...
    )
)

REM Build Docker images
echo 🐳 Building Docker images...
docker-compose build

REM Start the database first
echo 🗄️  Starting database services...
docker-compose up -d database redis

REM Wait for database to be ready
echo ⏳ Waiting for database to be ready...
timeout /t 10 /nobreak >nul

REM Check database health (simplified for Windows)
echo 🔄 Running database migrations...
timeout /t 5 /nobreak >nul
docker-compose exec -T database psql -U postgres -d dungeon_db -f /docker-entrypoint-initdb.d/001_initial_schema.sql
docker-compose exec -T database psql -U postgres -d dungeon_db -f /docker-entrypoint-initdb.d/seeds/001_core_data.sql

echo ✅ Database migrations completed

REM Start all services
echo 🚀 Starting all services...
docker-compose up -d

REM Wait for services to be ready
echo ⏳ Waiting for services to be ready...
timeout /t 15 /nobreak >nul

echo.
echo 🎉 Development environment setup complete!
echo.
echo 📊 Service Status:
echo - Dungeon Master:  http://localhost:3001
echo - Dungeon Service: http://localhost:3002
echo - Monster Service: http://localhost:3003
echo - Player Service:  http://localhost:3004
echo - Communication:   http://localhost:3005
echo - Rules Engine:    http://localhost:3006
echo.
echo 🗄️  Database Access:
echo - PostgreSQL:      localhost:5432 (user: postgres, db: dungeon_db)
echo - Redis:           localhost:6379
echo - Adminer:         http://localhost:8080 (if admin profile enabled)
echo.
echo 🔧 Useful Commands:
echo - View logs:       docker-compose logs -f [service-name]
echo - Stop services:   docker-compose down
echo - Restart service: docker-compose restart [service-name]
echo - Shell access:    docker-compose exec [service-name] /bin/sh
echo.
echo 📖 Next Steps:
echo 1. Review and update .env file with your API keys
echo 2. Check the README.md for API documentation
echo 3. Visit the docs/ folder for detailed architecture information
echo.
echo Happy coding! 🎲

pause