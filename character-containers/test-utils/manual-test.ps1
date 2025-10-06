# Manual Test Script for Character Containers (Windows PowerShell)
# This script performs basic functionality tests on a running character container

param(
    [string]$CharacterUrl = "http://localhost:3001",
    [int]$Timeout = 10
)

Write-Host "🧪 Starting Manual Character Container Test..." -ForegroundColor Blue
Write-Host "======================================================" -ForegroundColor Gray

# Helper function for HTTP requests
function Invoke-TestRequest {
    param(
        [string]$Url,
        [string]$Method = "GET",
        [string]$Body = $null,
        [string]$Expected = $null
    )
    
    try {
        $params = @{
            Uri = $Url
            Method = $Method
            TimeoutSec = $Timeout
            UseBasicParsing = $true
        }
        
        if ($Body) {
            $params.Body = $Body
            $params.ContentType = "application/json"
        }
        
        $response = Invoke-WebRequest @params
        $content = $response.Content
        
        if ($Expected -and $content -notmatch $Expected) {
            Write-Host "Expected '$Expected' not found in: $content" -ForegroundColor Red
            return $false
        }
        
        return $true
    }
    catch {
        Write-Host "Request failed: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Test function wrapper
function Invoke-Test {
    param(
        [string]$TestName,
        [scriptblock]$TestFunction
    )
    
    Write-Host "$TestName... " -NoNewline
    
    try {
        $result = & $TestFunction
        if ($result) {
            Write-Host "✅ PASSED" -ForegroundColor Green
            return $true
        } else {
            Write-Host "❌ FAILED" -ForegroundColor Red
            return $false
        }
    }
    catch {
        Write-Host "❌ FAILED - $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Test 1: Container Health Check
function Test-HealthCheck {
    return Invoke-TestRequest -Url "$CharacterUrl/health" -Expected "healthy"
}

# Test 2: Character Information Retrieval
function Test-CharacterInfo {
    return Invoke-TestRequest -Url "$CharacterUrl/api/character" -Expected "fighter"
}

# Test 3: AI Status Check
function Test-AIStatus {
    return Invoke-TestRequest -Url "$CharacterUrl/api/ai/status" -Expected "enabled"
}

# Test 4: Character State Persistence
function Test-CharacterState {
    return Invoke-TestRequest -Url "$CharacterUrl/api/character/save" -Method "POST" -Body "{}" -Expected "success"
}

# Test 5: API Response Time
function Test-ResponseTime {
    $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    $result = Invoke-TestRequest -Url "$CharacterUrl/health"
    $stopwatch.Stop()
    
    if ($result -and $stopwatch.ElapsedMilliseconds -lt 1000) {
        return $true
    } else {
        Write-Host "Response time too slow: $($stopwatch.ElapsedMilliseconds)ms" -ForegroundColor Red
        return $false
    }
}

# Test 6: Error Handling
function Test-ErrorHandling {
    try {
        Invoke-WebRequest -Uri "$CharacterUrl/api/nonexistent" -TimeoutSec $Timeout -UseBasicParsing -ErrorAction Stop
        Write-Host "Expected error response not received" -ForegroundColor Red
        return $false
    }
    catch {
        if ($_.Exception.Response.StatusCode -eq 404) {
            return $true
        } else {
            Write-Host "Expected 404 but got: $($_.Exception.Response.StatusCode)" -ForegroundColor Red
            return $false
        }
    }
}

# Wait for container to be ready
Write-Host "Testing character container at: $CharacterUrl" -ForegroundColor Blue
Write-Host "Timeout set to: $($Timeout)s" -ForegroundColor Blue
Write-Host ""

Write-Host "Waiting for container to be ready..." -ForegroundColor Yellow
$ready = $false
for ($i = 1; $i -le 30; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "$CharacterUrl/health" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
        Write-Host "Container is ready!" -ForegroundColor Green
        $ready = $true
        break
    }
    catch {
        if ($i -eq 30) {
            Write-Host "Container failed to start within 60 seconds" -ForegroundColor Red
            exit 1
        }
        Write-Host "." -NoNewline
        Start-Sleep -Seconds 2
    }
}

if (-not $ready) {
    Write-Host "Container is not ready" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Running tests..." -ForegroundColor Blue
Write-Host "==================" -ForegroundColor Gray

# Run all tests
$testsPassed = 0
$totalTests = 0

# Basic functionality tests
$totalTests++
if (Invoke-Test "1. Health Check" { Test-HealthCheck }) { $testsPassed++ }

$totalTests++
if (Invoke-Test "2. Character Info" { Test-CharacterInfo }) { $testsPassed++ }

$totalTests++
if (Invoke-Test "3. AI Status" { Test-AIStatus }) { $testsPassed++ }

$totalTests++
if (Invoke-Test "4. State Persistence" { Test-CharacterState }) { $testsPassed++ }

$totalTests++
if (Invoke-Test "5. Response Time" { Test-ResponseTime }) { $testsPassed++ }

$totalTests++
if (Invoke-Test "6. Error Handling" { Test-ErrorHandling }) { $testsPassed++ }

# Results summary
Write-Host ""
Write-Host "======================================================" -ForegroundColor Gray
Write-Host "Test Results Summary:" -ForegroundColor Blue
Write-Host "======================================================" -ForegroundColor Gray

if ($testsPassed -eq $totalTests) {
    Write-Host "🎉 ALL TESTS PASSED! ($testsPassed/$totalTests)" -ForegroundColor Green
    exit 0
} else {
    Write-Host "❌ SOME TESTS FAILED ($testsPassed/$totalTests passed)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Troubleshooting tips:" -ForegroundColor Yellow
    Write-Host "1. Check container logs: docker-compose logs character-container" -ForegroundColor White
    Write-Host "2. Verify container is running: docker-compose ps" -ForegroundColor White
    Write-Host "3. Check network connectivity: curl $CharacterUrl/health" -ForegroundColor White
    Write-Host "4. Review environment configuration in .env file" -ForegroundColor White
    exit 1
}