param([Parameter(Mandatory=$true)][string]$Url, [Parameter(Mandatory=$true)][string]$Video)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$env:PYTHONPATH = "$PSScriptRoot\.runtime\python"
$env:FORTE_API_KEY = (Get-Content -LiteralPath .runtime/api-key -Raw).Trim()
python backend/model_package/detector/api_smoke.py --url $Url --video $Video
if ($LASTEXITCODE -ne 0) { throw 'Public API smoke test failed: do not claim successful deployment.' }
