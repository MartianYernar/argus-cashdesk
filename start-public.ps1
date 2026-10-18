$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$env:PYTHONPATH = "$PSScriptRoot\.runtime\python;$PSScriptRoot\backend"
New-Item -ItemType Directory -Force .runtime | Out-Null
python -c "import fastapi,uvicorn,cv2,multipart,numpy"
if ($LASTEXITCODE -ne 0) {
    python -m pip install --target .runtime/python -r backend/requirements.txt
    if ($LASTEXITCODE -ne 0) { throw 'Dependencies failed' }
}
$ollamaExe = if (Get-Command ollama -ErrorAction SilentlyContinue) { (Get-Command ollama).Source } elseif (Test-Path "$PSScriptRoot\.runtime\ollama\ollama.exe") { "$PSScriptRoot\.runtime\ollama\ollama.exe" } else { throw 'Install Ollama with qwen3.5:4b first' }
$env:OLLAMA_HOST = '127.0.0.1:11434'
$env:OLLAMA_NO_CLOUD = '1'
if (Test-Path "$PSScriptRoot\.runtime\model-path") { $env:OLLAMA_MODELS = (Get-Content "$PSScriptRoot\.runtime\model-path" -Raw).Trim() }
try { $tags = Invoke-RestMethod 'http://127.0.0.1:11434/api/tags' -TimeoutSec 3 }
catch {
    Start-Process -FilePath $ollamaExe -ArgumentList 'serve' -WindowStyle Hidden -RedirectStandardOutput "$PSScriptRoot\.runtime\ollama-out.log" -RedirectStandardError "$PSScriptRoot\.runtime\ollama-error.log"
    $ready = $false
    for ($i = 0; $i -lt 30; $i++) {
        try { $tags = Invoke-RestMethod 'http://127.0.0.1:11434/api/tags' -TimeoutSec 2; $ready = $true; break } catch { Start-Sleep -Seconds 1 }
    }
    if (!$ready) { throw 'Ollama did not start' }
}
if ('qwen3.5:4b' -notin $tags.models.name) { throw 'qwen3.5:4b missing in Ollama' }
$pythonExe = (Get-Command python).Source
$api = Start-Process -FilePath $pythonExe -ArgumentList '-m','uvicorn','app:app','--app-dir','backend','--host','127.0.0.1','--port','8000' -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput "$PSScriptRoot\.runtime\api-out.log" -RedirectStandardError "$PSScriptRoot\.runtime\api-error.log"
Start-Sleep -Seconds 3
if ($api.HasExited) { throw 'API did not start; inspect .runtime/api-error.log. Port 8000 may be busy.' }
if (!(Test-Path "$PSScriptRoot\.runtime\cloudflared.exe")) {
    Invoke-WebRequest 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe' -OutFile .runtime/cloudflared.exe
}
Write-Host 'LOCAL WEBSITE: http://127.0.0.1:8000'
Write-Host 'JURY API KEY (keep private):'
Get-Content .runtime/api-key
Write-Host 'Public website and API base URL appear below as https://....trycloudflare.com'
Write-Host 'Keep this terminal open. In the public website, click server settings and enter the API key.'
try { & "$PSScriptRoot\.runtime\cloudflared.exe" tunnel --url http://127.0.0.1:8000 --protocol http2 --no-autoupdate }
finally { if (!$api.HasExited) { Stop-Process -Id $api.Id } }
