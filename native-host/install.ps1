# DB Browser native host installer (Windows)
# Run this once per machine, from PowerShell, in this native-host folder:
#   .\install.ps1

$ErrorActionPreference = "Stop"

Write-Host "DB Browser native host installer" -ForegroundColor Cyan

# 1. Check Node.js is available
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Host "Node.js was not found. Install it from https://nodejs.org (LTS) and re-run this script." -ForegroundColor Red
    exit 1
}
Write-Host "Found Node.js at $($node.Source)"

# 2. Copy this folder to a stable per-user install location
$installDir = Join-Path $env:LOCALAPPDATA "DBBrowserNativeHost"
Write-Host "Installing to $installDir"
New-Item -ItemType Directory -Force -Path $installDir | Out-Null
Copy-Item -Path (Join-Path $PSScriptRoot "native-host.js") -Destination $installDir -Force
Copy-Item -Path (Join-Path $PSScriptRoot "package.json") -Destination $installDir -Force

# 3. Install dependencies (pg) into the install location
Push-Location $installDir
Write-Host "Installing dependencies..."
npm install --omit=dev --silent
Pop-Location

# 4. Write a wrapper .bat that Chrome will actually launch
$batPath = Join-Path $installDir "run-native-host.bat"
@"
@echo off
node "$installDir\native-host.js"
"@ | Set-Content -Path $batPath -Encoding ASCII

# 5. Write the native messaging host manifest with the real path filled in
$manifestPath = Join-Path $installDir "com.dbbrowser.nativehost.json"
$manifestContent = @"
{
  "name": "com.dbbrowser.nativehost",
  "description": "DB Browser native messaging host - opens local database connections",
  "path": "$($batPath -replace '\\', '\\\\')",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://ndhijdclhjlpfbafkndaedecehhlcoae/"
  ]
}
"@
Set-Content -Path $manifestPath -Value $manifestContent -Encoding ASCII

# 6. Register the native host with Chrome (per-user, no admin rights needed)
$registryPath = "HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.dbbrowser.nativehost"
New-Item -Path $registryPath -Force | Out-Null
Set-ItemProperty -Path $registryPath -Name "(default)" -Value $manifestPath

Write-Host ""
Write-Host "Done. The native host is installed and registered with Chrome." -ForegroundColor Green
Write-Host "Next: load the extension folder via chrome://extensions (Developer mode > Load unpacked)."