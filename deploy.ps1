# Distributed Dungeon Deployment Script for Windows PowerShell
# This script handles development and production deployment

param(
    [Parameter(Position=0)]
    [ValidateSet("dev", "development", "prod", "production", "stop", "down", "build", "logs", "status", "clean", "help")]
    [string]$Command = "help",
    
    [Alias("d")]
    [switch]$Detached,
    
    [Alias("b")]
    [switch]$Build,
    
    [Alias("h")]
    [switch]$Help
)

# Function to print colored output
function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Function to show usage
function Show-Usage {
    Write-Host ""
    Write-Host "Distributed Dungeon Deployment Script" -ForegroundColor Cyan
    Write-Host "=====================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\deploy.ps1 [OPTIONS] COMMAND" -ForegroundColor White
    Write-Host ""
    Write-Host "Commands:" -ForegroundColor White
    Write-Host "  dev         Start development environment" -ForegroundColor Gray
    Write-Host "  prod        Start production environment" -ForegroundColor Gray
    Write-Host "  stop        Stop all services" -ForegroundColor Gray
    Write-Host "  down        Stop and remove all containers, networks, volumes" -ForegroundColor Gray
    Write-Host "  build       Build all container images" -ForegroundColor Gray
    Write-Host "  logs        Show logs for all services" -ForegroundColor Gray
    Write-Host "  status      Show status of all services" -ForegroundColor Gray
    Write-Host "  clean       Clean up unused Docker resources" -ForegroundColor Gray
    Write-Host "  help        Show this help message" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Options:" -ForegroundColor White
    Write-Host "  -Detached, -d     Run in detached mode" -ForegroundColor Gray
    Write-Host "  -Build, -b        Force rebuild of images" -ForegroundColor Gray
    Write-Host "  -Help, -h         Show this help message" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Examples:" -ForegroundColor White
    Write-Host "  .\deploy.ps1 dev              # Start development environment" -ForegroundColor Gray
    Write-Host "  .\deploy.ps1 dev -Detached    # Start development environment in background" -ForegroundColor Gray
    Write-Host "  .\deploy.ps1 prod -Build      # Start production with forced rebuild" -ForegroundColor Gray
    Write-Host "  .\deploy.ps1 logs             # Show logs for all services" -ForegroundColor Gray
    Write-Host "  .\deploy.ps1 stop             # Stop all running services" -ForegroundColor Gray
    Write-Host ""
}

# Function to check prerequisites
function Test-Prerequisites {
    Write-Status "Checking prerequisites..."
    
    # Check if Docker is installed
    try {
        $dockerVersion = docker --version
        Write-Status "Docker found: $($dockerVersion.Split(' ')[2])"
    }
    catch {
        Write-Error "Docker is not installed or not in PATH. Please install Docker Desktop."
        exit 1
    }
    
    # Check if Docker is running
    try {
        docker info | Out-Null
    }
    catch {
        Write-Error "Docker is not running. Please start Docker Desktop."
        exit 1
    }
    
    # Check if Docker Compose is available
    try {
        $composeVersion = docker compose version
        Write-Status "Docker Compose found: $($composeVersion.Split(' ')[-1])"
    }
    catch {
        Write-Error "Docker Compose is not available. Please install Docker Compose."
        exit 1
    }
    
    Write-Status "Prerequisites check passed!"
}

# Function to create environment file if it doesn't exist
function Initialize-Environment {
    if (-not (Test-Path ".env")) {
        Write-Warning ".env file not found. Creating from template..."
        if (Test-Path ".env.example") {
            Copy-Item ".env.example" ".env"
            Write-Status "Created .env file from template. Please update it with your actual values."
        }
        else {
            Write-Error ".env.example file not found. Cannot create .env file."
            exit 1
        }
    }
}

# Function to start development environment
function Start-Development {
    Write-Status "Starting development environment..."
    Initialize-Environment
    
    $composeArgs = @("compose", "-f", "docker-compose.yml", "up")
    
    if ($Build) {
        $composeArgs += "--build"
    }
    
    if ($Detached) {
        $composeArgs += "-d"
    }
    
    Write-Status "Running: docker $($composeArgs -join ' ')"
    & docker @composeArgs
    
    if ($Detached) {
        Write-Status "Development environment started in background!"
        Write-Status "Access the API at: http://localhost:8080"
        Write-Status "View logs with: .\deploy.ps1 logs"
        Write-Status "Stop services with: .\deploy.ps1 stop"
    }
}

# Function to start production environment
function Start-Production {
    Write-Status "Starting production environment..."
    Initialize-Environment
    
    $composeArgs = @("compose", "-f", "docker-compose.prod.yml", "up")
    
    if ($Build) {
        $composeArgs += "--build"
    }
    
    if ($Detached) {
        $composeArgs += "-d"
    }
    
    Write-Status "Running: docker $($composeArgs -join ' ')"
    & docker @composeArgs
    
    if ($Detached) {
        Write-Status "Production environment started in background!"
        Write-Status "Access the API at: http://localhost"
        Write-Status "View logs with: .\deploy.ps1 logs"
        Write-Status "Stop services with: .\deploy.ps1 stop"
    }
}

# Function to stop services
function Stop-Services {
    Write-Status "Stopping all services..."
    try {
        docker compose -f docker-compose.yml down 2>$null
    }
    catch {
        # Ignore errors
    }
    try {
        docker compose -f docker-compose.prod.yml down 2>$null
    }
    catch {
        # Ignore errors
    }
    Write-Status "All services stopped!"
}

# Function to remove everything
function Remove-Services {
    Write-Status "Stopping and removing all containers, networks, and volumes..."
    try {
        docker compose -f docker-compose.yml down -v 2>$null
    }
    catch {
        # Ignore errors
    }
    try {
        docker compose -f docker-compose.prod.yml down -v 2>$null
    }
    catch {
        # Ignore errors
    }
    Write-Status "All services, networks, and volumes removed!"
}

# Function to build images
function Build-Images {
    Write-Status "Building all container images..."
    docker compose -f docker-compose.yml build
    docker compose -f docker-compose.prod.yml build
    Write-Status "All images built successfully!"
}

# Function to show logs
function Show-Logs {
    Write-Status "Showing logs for all services..."
    
    # Try development first, then production
    $devRunning = (docker compose -f docker-compose.yml ps -q) 2>$null
    $prodRunning = (docker compose -f docker-compose.prod.yml ps -q) 2>$null
    
    if ($devRunning) {
        docker compose -f docker-compose.yml logs -f
    }
    elseif ($prodRunning) {
        docker compose -f docker-compose.prod.yml logs -f
    }
    else {
        Write-Warning "No running services found."
    }
}

# Function to show status
function Show-Status {
    Write-Status "Checking service status..."
    Write-Host ""
    Write-Host "Development Environment:" -ForegroundColor Cyan
    try {
        docker compose -f docker-compose.yml ps
    }
    catch {
        Write-Warning "Development environment not running"
    }
    Write-Host ""
    Write-Host "Production Environment:" -ForegroundColor Cyan
    try {
        docker compose -f docker-compose.prod.yml ps
    }
    catch {
        Write-Warning "Production environment not running"
    }
}

# Function to clean up Docker resources
function Clear-DockerResources {
    Write-Status "Cleaning up unused Docker resources..."
    docker system prune -f
    docker volume prune -f
    Write-Status "Docker cleanup completed!"
}

# Main execution
if ($Help -or $Command -eq "help") {
    Show-Usage
    exit 0
}

Write-Status "Distributed Dungeon Deployment Script"
Write-Status "======================================"

Test-Prerequisites

switch ($Command) {
    { $_ -in @("dev", "development") } {
        Start-Development
    }
    { $_ -in @("prod", "production") } {
        Start-Production
    }
    "stop" {
        Stop-Services
    }
    "down" {
        Remove-Services
    }
    "build" {
        Build-Images
    }
    "logs" {
        Show-Logs
    }
    "status" {
        Show-Status
    }
    "clean" {
        Clear-DockerResources
    }
    default {
        Write-Error "Unknown command: $Command"
        Show-Usage
        exit 1
    }
}