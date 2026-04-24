# Local Meilisearch runner for Windows.
#
# Downloads the official meilisearch.exe into `.bin\` (gitignored) on first
# run, then launches it with a persistent data dir under `.data\meili\` and
# the master key from the repo-root .env.
#
# Usage:
#   pwsh scripts\meilisearch.ps1           # start
#   Ctrl+C                                  # stop
#
# Bump this when you want a newer release.
$Version = "v1.11.3"

$ErrorActionPreference = "Stop"
$Root    = Split-Path $PSScriptRoot -Parent
$BinDir  = Join-Path $Root ".bin"
$DataDir = Join-Path $Root ".data\meili"
$Exe     = Join-Path $BinDir "meilisearch.exe"

New-Item -ItemType Directory -Force -Path $BinDir, $DataDir | Out-Null

if (-not (Test-Path $Exe)) {
    $url = "https://github.com/meilisearch/meilisearch/releases/download/$Version/meilisearch-windows-amd64.exe"
    Write-Host "Downloading Meilisearch $Version ..." -ForegroundColor Cyan
    Invoke-WebRequest -Uri $url -OutFile $Exe
}

# Pull MEILI_MASTER_KEY from .env (very small parser — first matching key wins).
$key = "dev-master-key-change-me"
$envFile = Join-Path $Root ".env"
if (Test-Path $envFile) {
    foreach ($line in Get-Content $envFile) {
        if ($line -match "^\s*MEILI_MASTER_KEY\s*=\s*(.+?)\s*$") {
            $key = $matches[1].Trim('"').Trim("'")
            break
        }
    }
}

Write-Host "Starting Meilisearch on http://localhost:7700" -ForegroundColor Green
& $Exe `
    --http-addr "127.0.0.1:7700" `
    --db-path $DataDir `
    --env development `
    --master-key $key `
    --no-analytics
