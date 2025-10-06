# Distributed Dungeon System Management Script
param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("status", "logs", "stop", "restart", "health")]
    [string]$Action,
    
    [string]$Service = "",
    [string]$Environment = "development",
    [switch]$Follow = $false
)

$ErrorActionPreference = "Stop"

function Write-Status {
    param([string]$Message, [string]$Color = "White")
    Write-Host "📊 $Message" -ForegroundColor $Color
}

function Write-Success {
    param([string]$Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

# Select Docker Compose file
$composeFile = if ($Environment -eq "production") { "docker-compose.prod.yml" } else { "docker-compose.yml" }
$composeCmd = "docker-compose -f $composeFile"

Write-Host "🐉 Distributed Dungeon System Management" -ForegroundColor Green
Write-Host "Action: $Action | Environment: $Environment" -ForegroundColor Yellow

try {
    switch ($Action) {
        "status" {
            Write-Status "Checking system status..." "Cyan"
            Write-Host "`n📦 Container Status:" -ForegroundColor Green
            Invoke-Expression "$composeCmd ps"
        }
        
        "logs" {
            if ($Service) {
                Write-Status "Showing logs for service: $Service" "Cyan"
                $logCmd = "$composeCmd logs"
                if ($Follow) { $logCmd += " -f" }
                $logCmd += " $Service"
            } else {
                Write-Status "Showing logs for all services" "Cyan"
                $logCmd = "$composeCmd logs"
                if ($Follow) { $logCmd += " -f" }
            }
            Invoke-Expression $logCmd
        }
        
        "stop" {
            if ($Service) {
                Write-Status "Stopping service: $Service" "Yellow"
                Invoke-Expression "$composeCmd stop $Service"
            } else {
                Write-Status "Stopping all services..." "Yellow"
                Invoke-Expression "$composeCmd down"
            }
            Write-Success "Stop completed"
        }
        
        "restart" {
            if ($Service) {
                Write-Status "Restarting service: $Service" "Yellow"
                Invoke-Expression "$composeCmd restart $Service"
            } else {
                Write-Status "Restarting all services..." "Yellow"
                Invoke-Expression "$composeCmd restart"
            }
            Write-Success "Restart completed"
        }
        
        "health" {
            Write-Status "Running health check..." "Cyan"
            
            # Check web interfaces
            Write-Host "`n🌐 Web Interface Check:" -ForegroundColor Green
            $webEndpoints = @(
                @{Name="Dungeon Explorer"; URL="http://localhost:3000"},
                @{Name="Monster Compendium"; URL="http://localhost:3007"}
            )
            
            foreach ($endpoint in $webEndpoints) {
                try {
                    $response = Invoke-WebRequest -Uri $endpoint.URL -TimeoutSec 5 -UseBasicParsing
                    if ($response.StatusCode -eq 200) {
                        Write-Host "✅ $($endpoint.Name): Available" -ForegroundColor Green
                    }
                } catch {
                    Write-Host "❌ $($endpoint.Name): Unavailable" -ForegroundColor Red
                }
            }
        }
        
        default {
            throw "Unknown action: $Action"
        }
    }
    
} catch {
    Write-Host "❌ Operation failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Success "Operation completed successfully!"