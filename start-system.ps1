# Distributed Dungeon System Startup Script
# This script orchestrates the complete startup of the distributed dungeon system

param(
    [string]$Environment = "development",
    [switch]$ShowLogs = $false,
    [switch]$Rebuild = $false,
    [switch]$Clean = $false,
    [switch]$Admin = $false
)

Write-Host "🐉 Starting Distributed Dungeon System" -ForegroundColor Green
Write-Host "Environment: $Environment" -ForegroundColor Yellow

# Set error action preference
$ErrorActionPreference = "Stop"

# Function to display colored output
function Write-Status {
    param([string]$Message, [string]$Color = "White")
    Write-Host "📊 $Message" -ForegroundColor $Color
}

function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "⚠️ $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

try {
    # Step 1: Clean up if requested
    if ($Clean) {
        Write-Status "Cleaning up existing containers and volumes..." "Yellow"
        docker-compose down --volumes --remove-orphans
        docker system prune -f
        Write-Success "Cleanup completed"
    }

    # Step 2: Check for required environment files
    Write-Status "Checking environment configuration..."
    
    $envFile = if ($Environment -eq "production") { ".env.prod" } else { ".env" }
    
    if (-not (Test-Path $envFile)) {
        Write-Warning "Environment file $envFile not found. Creating template..."
        
        $envTemplate = @"
# Database Configuration
DATABASE_PASSWORD=dungeonmaster123
REDIS_PASSWORD=redispass123

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# AI Configuration
GEMINI_API_KEY=your-gemini-api-key-here

# Discord Configuration (Optional)
DISCORD_BOT_TOKEN=your-discord-bot-token
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_GUILD_ID=your-discord-guild-id

# Service Scaling (Production only)
DUNGEON_MASTER_REPLICAS=1
DUNGEON_SERVICE_REPLICAS=2
MONSTER_SERVICE_REPLICAS=3
PLAYER_SERVICE_REPLICAS=2
COMMUNICATION_SERVICE_REPLICAS=1
RULES_ENGINE_REPLICAS=2

# Meshtastic Configuration (Linux only)
MESHTASTIC_DEVICE=/dev/ttyUSB0
"@
        $envTemplate | Out-File -FilePath $envFile -Encoding UTF8
        Write-Warning "Please edit $envFile with your actual configuration values"
        Write-Warning "Press any key to continue..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    }

    # Step 3: Select Docker Compose file
    $composeFile = if ($Environment -eq "production") { "docker-compose.prod.yml" } else { "docker-compose.yml" }
    $composeCmd = "docker-compose -f $composeFile"
    
    # Add admin profile if requested
    if ($Admin) {
        $composeCmd += " --profile admin"
    }

    Write-Success "Using configuration: $composeFile"

    # Step 4: Build services if requested
    if ($Rebuild) {
        Write-Status "Rebuilding all services..." "Yellow"
        Invoke-Expression "$composeCmd build --no-cache"
        Write-Success "Build completed"
    }

    # Step 5: Start infrastructure services first
    Write-Status "Starting infrastructure services (database, redis)..." "Cyan"
    Invoke-Expression "$composeCmd up -d database redis"
    
    # Wait for infrastructure to be healthy
    Write-Status "Waiting for infrastructure to be ready..." "Yellow"
    $healthyInfra = $false
    $attempts = 0
    $maxAttempts = 30
    
    while (-not $healthyInfra -and $attempts -lt $maxAttempts) {
        Start-Sleep 2
        $attempts++
        
        $dbHealth = docker inspect --format='{{.State.Health.Status}}' dungeon_postgres 2>$null
        $redisHealth = docker inspect --format='{{.State.Health.Status}}' dungeon_redis 2>$null
        
        if ($dbHealth -eq "healthy" -and $redisHealth -eq "healthy") {
            $healthyInfra = $true
            Write-Success "Infrastructure services are healthy"
        } else {
            Write-Host "." -NoNewline -ForegroundColor Yellow
        }
    }
    
    if (-not $healthyInfra) {
        throw "Infrastructure services failed to become healthy within $maxAttempts attempts"
    }

    # Step 6: Start core services
    Write-Status "Starting core services..." "Cyan"
    Invoke-Expression "$composeCmd up -d dungeon-master dungeon monster player communication rules-engine"

    # Step 7: Start load balancer and monitoring
    Write-Status "Starting load balancer and monitoring..." "Cyan"
    if ($Admin) {
        Invoke-Expression "$composeCmd up -d nginx adminer redis-commander"
        Write-Success "Admin tools started on ports 8080 (adminer) and 8081 (redis-commander)"
    } else {
        Invoke-Expression "$composeCmd up -d nginx"
    }

    # Step 8: Wait for all services to be healthy
    Write-Status "Waiting for all services to be ready..." "Yellow"
    Start-Sleep 10
    
    # Step 9: Display service status
    Write-Host "`n🎯 Service Status:" -ForegroundColor Green
    Write-Host "==================" -ForegroundColor Green
    
    $services = @(
        @{Name="Dungeon Master"; Port=3001; Container="dungeon_master_service"},
        @{Name="Dungeon Explorer"; Port=3000; Container="dungeon_service"; WebInterface=$true},
        @{Name="Dungeon API"; Port=3002; Container="dungeon_service"},
        @{Name="Monster Compendium"; Port=3007; Container="monster_service"; WebInterface=$true},
        @{Name="Monster API"; Port=3003; Container="monster_service"},
        @{Name="Player Service"; Port=3004; Container="player_service"},
        @{Name="Communication"; Port=3005; Container="communication_service"},
        @{Name="Rules Engine"; Port=3006; Container="rules_engine_service"},
        @{Name="Database"; Port=5432; Container="dungeon_postgres"},
        @{Name="Redis"; Port=6379; Container="dungeon_redis"},
        @{Name="Load Balancer"; Port=80; Container="dungeon_nginx"}
    )

    foreach ($service in $services) {
        $containerName = if ($Environment -eq "production") { $service.Container + "_prod" } else { $service.Container }
        $status = docker inspect --format='{{.State.Status}}' $containerName 2>$null
        
        if ($status -eq "running") {
            $icon = if ($service.WebInterface) { "🌐" } else { "🔧" }
            Write-Host "$icon $($service.Name): " -NoNewline -ForegroundColor White
            Write-Host "http://localhost:$($service.Port)" -ForegroundColor Green
        } else {
            Write-Host "❌ $($service.Name): Not running" -ForegroundColor Red
        }
    }

    if ($Admin) {
        Write-Host "`n🛠️ Admin Tools:" -ForegroundColor Cyan
        Write-Host "===============" -ForegroundColor Cyan
        Write-Host "🗄️ Adminer (Database): http://localhost:8080" -ForegroundColor Green
        Write-Host "🔴 Redis Commander: http://localhost:8081" -ForegroundColor Green
    }

    # Step 10: Show startup summary
    Write-Host "`n🎉 System Status Summary:" -ForegroundColor Green
    Write-Host "=========================" -ForegroundColor Green
    Write-Host "🌐 Web Interfaces:" -ForegroundColor Yellow
    Write-Host "   • Dungeon Explorer: http://localhost:3000" -ForegroundColor White
    Write-Host "   • Monster Compendium: http://localhost:3007" -ForegroundColor White
    Write-Host ""
    Write-Host "🔧 API Endpoints:" -ForegroundColor Yellow
    Write-Host "   • Dungeon Master: http://localhost:3001" -ForegroundColor White
    Write-Host "   • Dungeon API: http://localhost:3002" -ForegroundColor White
    Write-Host "   • Monster API: http://localhost:3003" -ForegroundColor White
    Write-Host "   • Player API: http://localhost:3004" -ForegroundColor White
    Write-Host "   • Communication: http://localhost:3005" -ForegroundColor White
    Write-Host "   • Rules Engine: http://localhost:3006" -ForegroundColor White
    Write-Host ""
    Write-Host "💾 Infrastructure:" -ForegroundColor Yellow
    Write-Host "   • PostgreSQL: localhost:5432" -ForegroundColor White
    Write-Host "   • Redis: localhost:6379" -ForegroundColor White
    Write-Host "   • Load Balancer: http://localhost" -ForegroundColor White

    # Show logs if requested
    if ($ShowLogs) {
        Write-Host "`n📋 Showing service logs (Ctrl+C to exit)..." -ForegroundColor Yellow
        Invoke-Expression "$composeCmd logs -f"
    } else {
        Write-Host "`n📋 To view logs, run: docker-compose -f $composeFile logs -f" -ForegroundColor Cyan
        Write-Host "📋 To stop all services, run: docker-compose -f $composeFile down" -ForegroundColor Cyan
    }

    Write-Success "🐉 Distributed Dungeon System is now running!"

} catch {
    Write-Error "Failed to start system: $($_.Exception.Message)"
    Write-Host "`n🛠️ Troubleshooting commands:" -ForegroundColor Yellow
    Write-Host "docker-compose -f $composeFile ps" -ForegroundColor White
    Write-Host "docker-compose -f $composeFile logs" -ForegroundColor White
    Write-Host "docker-compose -f $composeFile down" -ForegroundColor White
    exit 1
}