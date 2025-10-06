# Deploy Test Party Script for Windows PowerShell
# Deploys multiple character containers for testing

param(
    [string[]]$Characters = @("fighter"),
    [switch]$Cleanup,
    [switch]$Dev,
    [switch]$Help,
    [int]$BasePort = 3001
)

if ($Help) {
    Write-Host "Deploy Test Party for Distributed Dungeon" -ForegroundColor Blue
    Write-Host "=========================================" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Usage: .\deploy-test-party.ps1 [OPTIONS] [CHARACTERS...]" -ForegroundColor White
    Write-Host ""
    Write-Host "Deploy character containers for testing" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Options:" -ForegroundColor Yellow
    Write-Host "  -Cleanup     Stop and remove all character containers" -ForegroundColor White
    Write-Host "  -Dev         Deploy in development mode with hot reload" -ForegroundColor White
    Write-Host "  -Help        Show this help message" -ForegroundColor White
    Write-Host ""
    Write-Host "Characters:" -ForegroundColor Yellow
    Write-Host "  fighter      Deploy example fighter character" -ForegroundColor White
    Write-Host "  wizard       Deploy example wizard character (if available)" -ForegroundColor White
    Write-Host "  rogue        Deploy example rogue character (if available)" -ForegroundColor White
    Write-Host "  cleric       Deploy example cleric character (if available)" -ForegroundColor White
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor Yellow
    Write-Host "  .\deploy-test-party.ps1 fighter                    # Deploy single fighter" -ForegroundColor White
    Write-Host "  .\deploy-test-party.ps1 fighter,wizard,rogue       # Deploy party of three" -ForegroundColor White
    Write-Host "  .\deploy-test-party.ps1 -Dev fighter               # Deploy fighter in dev mode" -ForegroundColor White
    Write-Host "  .\deploy-test-party.ps1 -Cleanup                   # Clean up all containers" -ForegroundColor White
    exit 0
}

Write-Host "🚀 Deploying Test Party for Distributed Dungeon" -ForegroundColor Blue
Write-Host "================================================" -ForegroundColor Gray

# Helper functions
function Write-Info { param($msg) Write-Host "ℹ️  $msg" -ForegroundColor Blue }
function Write-Success { param($msg) Write-Host "✅ $msg" -ForegroundColor Green }
function Write-Error { param($msg) Write-Host "❌ $msg" -ForegroundColor Red }
function Write-Warning { param($msg) Write-Host "⚠️  $msg" -ForegroundColor Yellow }

# Cleanup function
function Invoke-Cleanup {
    Write-Info "Cleaning up character containers..."
    
    # Stop and remove character containers
    $containers = docker ps -a --filter "name=character-" --format "{{.Names}}"
    foreach ($container in $containers) {
        if ($container) {
            Write-Info "Stopping container: $container"
            docker stop $container | Out-Null
            docker rm $container | Out-Null
        }
    }
    
    # Remove character networks
    $networks = docker network ls --filter "name=character-network" --format "{{.Name}}"
    foreach ($network in $networks) {
        if ($network) {
            Write-Info "Removing network: $network"
            docker network rm $network | Out-Null
        }
    }
    
    Write-Success "Cleanup completed"
}

# Check if character directory exists
function Test-CharacterExists {
    param([string]$Character)
    
    $charDir = "character-containers\example-$Character"
    
    if (-not (Test-Path $charDir)) {
        Write-Error "Character directory not found: $charDir"
        return $false
    }
    
    if (-not (Test-Path "$charDir\docker-compose.yml")) {
        Write-Error "Docker compose file not found: $charDir\docker-compose.yml"
        return $false
    }
    
    return $true
}

# Deploy single character
function Deploy-Character {
    param(
        [string]$Character,
        [int]$Port
    )
    
    Write-Info "Deploying $Character character on port $Port..."
    
    # Check if character exists
    if (-not (Test-CharacterExists $Character)) {
        return $false
    }
    
    $charDir = "character-containers\example-$Character"
    
    # Set environment variables
    $env:CHARACTER_NAME = "test-$Character-$Port"
    $env:CHARACTER_PORT = $Port.ToString()
    $env:CHARACTER_CLASS = $Character
    $env:CHARACTER_LEVEL = "3"
    $env:LOG_LEVEL = "info"
    
    if ($Dev) {
        $env:BUILD_TARGET = "development"
        $env:VOLUME_MOUNT_TYPE = "rw"
        $env:NODE_ENV = "development"
        Write-Info "Deploying in development mode with hot reload"
    } else {
        $env:BUILD_TARGET = "production"
        $env:VOLUME_MOUNT_TYPE = "ro"
        $env:NODE_ENV = "production"
    }
    
    # Set character-specific AI configuration
    switch ($Character) {
        "fighter" {
            $env:AI_AGGRESSIVENESS = "0.7"
            $env:AI_CAUTION = "0.4"
            $env:AI_CURIOSITY = "0.5"
            $env:AI_TACTICAL = "0.8"
            $env:FIGHTING_STYLE = "defense"
        }
        "wizard" {
            $env:AI_AGGRESSIVENESS = "0.3"
            $env:AI_CAUTION = "0.8"
            $env:AI_CURIOSITY = "0.9"
            $env:AI_TACTICAL = "0.9"
        }
        "rogue" {
            $env:AI_AGGRESSIVENESS = "0.6"
            $env:AI_CAUTION = "0.7"
            $env:AI_CURIOSITY = "0.8"
            $env:AI_TACTICAL = "0.7"
        }
        "cleric" {
            $env:AI_AGGRESSIVENESS = "0.4"
            $env:AI_CAUTION = "0.6"
            $env:AI_CURIOSITY = "0.6"
            $env:AI_TACTICAL = "0.6"
        }
    }
    
    # Deploy with docker-compose
    Push-Location $charDir
    
    try {
        $result = docker-compose up -d 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Success "$Character character deployed successfully"
            
            # Wait for container to be ready
            Write-Info "Waiting for $Character to be ready..."
            $ready = $false
            for ($i = 1; $i -le 30; $i++) {
                try {
                    $response = Invoke-WebRequest -Uri "http://localhost:$Port/health" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
                    Write-Success "$Character is ready and healthy!"
                    $ready = $true
                    break
                }
                catch {
                    if ($i -eq 30) {
                        Write-Error "$Character failed to start within 60 seconds"
                        return $false
                    }
                    Start-Sleep -Seconds 2
                }
            }
            
            if ($ready) {
                # Display character info
                try {
                    $characterInfo = Invoke-WebRequest -Uri "http://localhost:$Port/api/character" -UseBasicParsing -TimeoutSec 5
                    Write-Host "Character Info:" -ForegroundColor Cyan
                    $characterInfo.Content | ConvertFrom-Json | ConvertTo-Json -Depth 10 | Write-Host
                }
                catch {
                    Write-Warning "Could not retrieve character info"
                }
            }
            
            return $ready
        } else {
            Write-Error "Failed to deploy $Character character"
            Write-Host $result -ForegroundColor Red
            return $false
        }
    }
    finally {
        Pop-Location
    }
}

# Main execution
if ($Cleanup) {
    Invoke-Cleanup
    exit 0
}

# Check prerequisites
Write-Info "Checking prerequisites..."

# Check if main system is running
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -TimeoutSec 5 -UseBasicParsing -ErrorAction Stop
    Write-Success "Main game system is running"
}
catch {
    Write-Error "Main game system is not running!"
    Write-Info "Please start the main system first:"
    Write-Info "  cd distributed_dungeon"
    Write-Info "  docker-compose up -d"
    exit 1
}

# Check Docker
try {
    docker --version | Out-Null
    if ($LASTEXITCODE -ne 0) { throw }
}
catch {
    Write-Error "Docker is not installed or not in PATH"
    exit 1
}

try {
    docker-compose --version | Out-Null
    if ($LASTEXITCODE -ne 0) { throw }
}
catch {
    Write-Error "Docker Compose is not installed or not in PATH"
    exit 1
}

# Check if we're in the right directory
if (-not (Test-Path "character-containers")) {
    Write-Error "character-containers directory not found"
    Write-Info "Please run this script from the distributed_dungeon root directory"
    exit 1
}

Write-Success "All prerequisites met"

# Deploy characters
Write-Info "Deploying $($Characters.Count) character(s): $($Characters -join ', ')"

$deployedCount = 0
$failedCount = 0

for ($i = 0; $i -lt $Characters.Count; $i++) {
    $character = $Characters[$i]
    $port = $BasePort + $i
    
    if (Deploy-Character $character $port) {
        $deployedCount++
    } else {
        $failedCount++
    }
    
    Write-Host "" # Add spacing between deployments
}

# Summary
Write-Host "================================================" -ForegroundColor Gray
Write-Host "Deployment Summary:" -ForegroundColor Blue
Write-Host "================================================" -ForegroundColor Gray

if ($deployedCount -gt 0) {
    Write-Success "$deployedCount character(s) deployed successfully"
    
    Write-Host ""
    Write-Host "Character Endpoints:" -ForegroundColor Cyan
    for ($i = 0; $i -lt $Characters.Count; $i++) {
        $character = $Characters[$i]
        $port = $BasePort + $i
        Write-Host "  $character`: http://localhost:$port" -ForegroundColor White
    }
    
    Write-Host ""
    Write-Host "Testing Commands:" -ForegroundColor Cyan
    Write-Host "  # Test all characters" -ForegroundColor White
    Write-Host "  cd character-containers\test-utils" -ForegroundColor Gray
    Write-Host "  node integration-test.js" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  # Manual health checks" -ForegroundColor White
    for ($i = 0; $i -lt $Characters.Count; $i++) {
        $port = $BasePort + $i
        Write-Host "  Invoke-WebRequest http://localhost:$port/health" -ForegroundColor Gray
    }
    
    Write-Host ""
    Write-Host "  # View logs" -ForegroundColor White
    Write-Host "  docker-compose logs -f" -ForegroundColor Gray
    
    Write-Host ""
    Write-Host "  # Cleanup when done" -ForegroundColor White
    Write-Host "  .\deploy-test-party.ps1 -Cleanup" -ForegroundColor Gray
}

if ($failedCount -gt 0) {
    Write-Error "$failedCount character(s) failed to deploy"
}

Write-Host "================================================" -ForegroundColor Gray

if ($deployedCount -gt 0 -and $failedCount -eq 0) {
    Write-Success "🎉 All characters deployed successfully!"
    exit 0
} else {
    Write-Error "❌ Some deployments failed"
    exit 1
}