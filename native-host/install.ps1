# DB Browser native host installer (Windows)
#
# Easiest way to run this: double-click truelift_setup.bat in this same folder -
# it launches this script correctly and keeps the window open.
#
# Alternatively, from an already-open PowerShell window:
#   cd native-host
#   powershell -ExecutionPolicy Bypass -File .\install.ps1

$ErrorActionPreference = "Stop"

function Pause-Before-Exit {
    Write-Host ""
    Read-Host "Press Enter to close this window"
}

try {
    Write-Host "DB Browser native host installer" -ForegroundColor Cyan

    # 1. Check Node.js is available - install it automatically if not
    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) {
        Write-Host "Node.js was not found. Installing it automatically..." -ForegroundColor Yellow
        Write-Host "(This may show a Windows permission prompt - please click Yes.)"

        $winget = Get-Command winget -ErrorAction SilentlyContinue
        if ($winget) {
            Write-Host "Installing Node.js LTS via winget..."
            winget install OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
            if ($LASTEXITCODE -ne 0) {
                throw "winget install of Node.js failed with exit code $LASTEXITCODE. Please install Node.js manually from https://nodejs.org (LTS) and re-run this script."
            }
        } else {
            Write-Host "winget not available - downloading the official Node.js installer..."
            $distIndex = Invoke-RestMethod -Uri "https://nodejs.org/dist/index.json"
            $latestLts = $distIndex | Where-Object { $_.lts -ne $false } | Select-Object -First 1
            if (-not $latestLts) {
                throw "Could not determine the latest Node.js LTS version. Please install Node.js manually from https://nodejs.org (LTS) and re-run this script."
            }
            $version = $latestLts.version
            $msiUrl = "https://nodejs.org/dist/$version/node-$version-x64.msi"
            $msiPath = Join-Path $env:TEMP "node-installer.msi"

            Write-Host "Downloading Node.js $version..."
            Invoke-WebRequest -Uri $msiUrl -OutFile $msiPath

            Write-Host "Running the Node.js installer..."
            $installProcess = Start-Process -FilePath "msiexec.exe" -ArgumentList "/i", "`"$msiPath`"", "/quiet", "/norestart" -Wait -PassThru
            if ($installProcess.ExitCode -ne 0) {
                throw "The Node.js installer failed (exit code $($installProcess.ExitCode)). Please install Node.js manually from https://nodejs.org (LTS) and re-run this script."
            }
            Remove-Item $msiPath -ErrorAction SilentlyContinue
        }

        # Refresh this session's PATH from the registry - the installer updated
        # PATH system-wide, but this already-running process doesn't see that
        # change until we re-read it directly.
        $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
        $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
        $env:Path = "$machinePath;$userPath"

        $node = Get-Command node -ErrorAction SilentlyContinue
        if (-not $node) {
            throw "Node.js was installed but isn't recognized in this window yet. Please close this window, then double-click truelift_setup.bat again."
        }
        Write-Host "Node.js installed successfully." -ForegroundColor Green
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
    Write-Host "Installing dependencies (this can take a minute)..."
    npm install --omit=dev
    if ($LASTEXITCODE -ne 0) {
        throw "npm install failed with exit code $LASTEXITCODE - see output above."
    }
    Pop-Location

    # 4. Write a wrapper .bat that Chrome will actually launch
    $batPath = Join-Path $installDir "run-native-host.bat"
    @"
@echo off
node "$installDir\native-host.js"
"@ | Set-Content -Path $batPath -Encoding ASCII

    # 5. Write the native messaging host manifest with the real path filled in.
    # JSON needs each backslash doubled (\ -> \\); the replacement string
    # below is exactly two literal backslash characters, producing correct
    # JSON escaping - not four, which was a bug in an earlier version of
    # this script.
    $manifestPath = Join-Path $installDir "com.dbbrowser.nativehost.json"
    $escapedBatPath = $batPath -replace '\\', '\\'
    $manifestContent = @"
{
  "name": "com.dbbrowser.nativehost",
  "description": "DB Browser native messaging host - opens local database connections",
  "path": "$escapedBatPath",
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
    Write-Host "Installation Complete" -ForegroundColor Green
    Write-Host "The native host is installed and registered with Chrome."
    Write-Host "Next: load the extension folder via chrome://extensions (Developer mode > Load unpacked)."
    Pause-Before-Exit
}
catch {
    Write-Host ""
    Write-Host "Installation failed:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Pause-Before-Exit
    exit 1
}
