param(
  [string]$ApiKey = $env:OPENROUTER_API_KEY,
  [string]$Models = "google/gemma-4-31b-it:free,openrouter/free",
  [int]$MaxRounds = 5,
  [int]$WaitSeconds = 90,
  [string]$Slug = "",
  [switch]$Force
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ApiKey)) {
  throw "Missing OpenRouter API key. Pass -ApiKey or set OPENROUTER_API_KEY."
}

$root = Split-Path -Parent $PSScriptRoot
$generator = Join-Path $root "scripts\generate-article-summaries.mjs"

if (-not (Test-Path $generator)) {
  throw "Generator script not found at $generator"
}

$env:OPENROUTER_API_KEY = $ApiKey
$args = @($generator, "--models", $Models)

if ($Force) {
  $args += "--force"
}

if (-not [string]::IsNullOrWhiteSpace($Slug)) {
  $args += @("--slug", $Slug)
}

for ($round = 1; $round -le $MaxRounds; $round++) {
  Write-Host "Summary build attempt $round of $MaxRounds..." -ForegroundColor Cyan
  & node @args

  if ($LASTEXITCODE -eq 0) {
    Write-Host "Summary build completed successfully." -ForegroundColor Green
    exit 0
  }

  if ($round -eq $MaxRounds) {
    break
  }

  Write-Warning "Summary build failed on attempt $round. Waiting $WaitSeconds seconds before retrying."
  Start-Sleep -Seconds $WaitSeconds
}

throw "Summary build failed after $MaxRounds attempts."
