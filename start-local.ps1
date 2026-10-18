$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$env:PYTHONPATH = "$PSScriptRoot\.runtime\python;$PSScriptRoot\backend"
$modelPath = if (Test-Path -LiteralPath "$PSScriptRoot\.runtime\model-path") { (Get-Content -LiteralPath "$PSScriptRoot\.runtime\model-path" -Raw).Trim() } else { "$PSScriptRoot\.runtime\models" }
$env:OLLAMA_MODELS = $modelPath
$env:OLLAMA_HOST = '127.0.0.1:11434'
$env:OLLAMA_NO_CLOUD = '1'
$ollamaPath = "$PSScriptRoot\.runtime\ollama\ollama.exe"
if (!(Test-Path -LiteralPath $ollamaPath)) { throw 'Run setup-local.ps1 first.' }
try { $null = Invoke-RestMethod 'http://127.0.0.1:11434/api/tags' -TimeoutSec 3 }
catch {
    Start-Process -FilePath $ollamaPath -ArgumentList 'serve' -WindowStyle Hidden -RedirectStandardOutput "$PSScriptRoot\.runtime\ollama-out.log" -RedirectStandardError "$PSScriptRoot\.runtime\ollama-error.log"
    $ready = $false
    for ($i = 0; $i -lt 30; $i++) {
        try { $null = Invoke-RestMethod 'http://127.0.0.1:11434/api/tags' -TimeoutSec 2; $ready = $true; break } catch { Start-Sleep -Seconds 1 }
    }
    if (!$ready) { throw 'Ollama did not start. See .runtime/ollama-error.log' }
}
$tags = Invoke-RestMethod 'http://127.0.0.1:11434/api/tags'
if ('qwen3.5:4b' -notin $tags.models.name) { throw 'Model missing. Run setup-local.ps1.' }
if (!(Test-Path -LiteralPath "$PSScriptRoot\dist\index.html")) { throw 'Build missing. Run setup-local.ps1.' }
Write-Host 'ARGUS: http://127.0.0.1:8000 — keep this window open.'
python -m uvicorn app:app --app-dir backend --host 127.0.0.1 --port 8000
