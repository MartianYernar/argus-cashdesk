$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
New-Item -ItemType Directory -Force .runtime | Out-Null
python -m pip install --target .runtime/python -r backend/requirements.txt
if ($LASTEXITCODE -ne 0) { throw 'Python dependency installation failed' }
npm ci
if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed' }
npm run build
if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed' }
$ollamaPath = "$PSScriptRoot\.runtime\ollama\ollama.exe"
if (!(Test-Path -LiteralPath $ollamaPath)) {
    Invoke-WebRequest 'https://github.com/ollama/ollama/releases/latest/download/ollama-windows-amd64.zip' -OutFile .runtime/ollama.zip
    Expand-Archive -LiteralPath .runtime/ollama.zip -DestinationPath .runtime/ollama -Force
}
$modelPath = if (Test-Path -LiteralPath "$PSScriptRoot\.runtime\model-path") { (Get-Content -LiteralPath "$PSScriptRoot\.runtime\model-path" -Raw).Trim() } else { "$PSScriptRoot\.runtime\models" }
$env:OLLAMA_MODELS = $modelPath
$env:OLLAMA_HOST = '127.0.0.1:11434'
$env:OLLAMA_NO_CLOUD = '1'
try { $null = Invoke-RestMethod 'http://127.0.0.1:11434/api/tags' -TimeoutSec 3 }
catch {
    Start-Process -FilePath $ollamaPath -ArgumentList 'serve' -WindowStyle Hidden -RedirectStandardOutput "$PSScriptRoot\.runtime\ollama-out.log" -RedirectStandardError "$PSScriptRoot\.runtime\ollama-error.log"
    $ready = $false
    for ($i = 0; $i -lt 30; $i++) {
        try { $null = Invoke-RestMethod 'http://127.0.0.1:11434/api/tags' -TimeoutSec 2; $ready = $true; break } catch { Start-Sleep -Seconds 1 }
    }
    if (!$ready) { throw 'Ollama did not start' }
}
& $ollamaPath pull qwen3.5:4b
if ($LASTEXITCODE -ne 0) { throw 'Model download failed' }
Write-Host 'Ready. Run ./start-local.ps1'
