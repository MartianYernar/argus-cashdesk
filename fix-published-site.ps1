$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$backendPath = Join-Path $PSScriptRoot 'backend/app.py'
if (!(Test-Path -LiteralPath $backendPath)) { throw 'Place this script beside the backend folder.' }
$source = [System.IO.File]::ReadAllText($backendPath)
$origin = 'https://martianyernar.github.io'
if ($source.Contains($origin)) { Write-Host 'GitHub Pages origin is already configured.'; exit 0 }
$pattern = 'allow_origins\s*=\s*\[(?<origins>[^\]]*)\]'
if ($source -notmatch $pattern) { throw 'Unknown CORS setup. Apply the updated backend/app.py manually.' }
$source = [regex]::Replace($source, $pattern, { param($match) 'allow_origins=["https://martianyernar.github.io", ' + $match.Groups['origins'].Value + ']' })
[System.IO.File]::WriteAllText($backendPath, $source, (New-Object System.Text.UTF8Encoding($false)))
Write-Host 'CORS fixed. Restart ONLY the Python API on port 8000.'
Write-Host 'Do NOT stop or restart cloudflared: keep the submitted public URL.'
Write-Host 'Keep the existing ARGUS_API_KEY / .runtime/api-key unchanged.'
