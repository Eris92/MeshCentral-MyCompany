#Requires -RunAsAdministrator
[CmdletBinding()]
param(
    [string]$Repository = 'https://github.com/Eris92/sirk-portal.git',
    [string]$Branch = 'main',
    [string]$MeshRoot = 'C:\Program Files\Open Source\MeshCentral',
    [string]$ServiceName = 'MeshCentral',
    [switch]$SkipTests
)

$ErrorActionPreference = 'Stop'
$DataRoot = Join-Path $MeshRoot 'meshcentral-data'
$PluginsRoot = Join-Path $DataRoot 'plugins'
$Target = Join-Path $PluginsRoot 'SIRK-Portal'
$LegacyTarget = Join-Path $PluginsRoot 'SirkPlatform'
$RuntimeData = Join-Path $DataRoot 'sirk-platform-data'
$LegacyRuntimeData = Join-Path $DataRoot 'sirk-platform-data'
$StageRoot = Join-Path $env:TEMP ('SIRK-Portal-Git-' + [guid]::NewGuid().ToString('N'))
$Stage = Join-Path $StageRoot 'SIRK-Portal'
$BackupRoot = Join-Path $DataRoot 'plugin-backups'
$Backup = Join-Path $BackupRoot ('SIRK-Portal-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
$Git = (Get-Command git.exe -ErrorAction Stop).Source
$Node = (Get-Command node.exe -ErrorAction Stop).Source
$Npm = (Get-Command npm.cmd -ErrorAction Stop).Source
$Icacls = (Get-Command icacls.exe -ErrorAction Stop).Source
$Takeown = (Get-Command takeown.exe -ErrorAction Stop).Source

function Invoke-Checked {
    param([string]$FilePath, [string[]]$Arguments, [string]$WorkingDirectory = '')
    $start = @{ FilePath = $FilePath; ArgumentList = $Arguments; Wait = $true; PassThru = $true; NoNewWindow = $true }
    if ($WorkingDirectory) { $start.WorkingDirectory = $WorkingDirectory }
    $process = Start-Process @start
    if ($process.ExitCode -ne 0) { throw ('Command failed ({0}): {1} {2}' -f $process.ExitCode, $FilePath, ($Arguments -join ' ')) }
}

function Repair-RuntimeDataPermissions {
    param([string]$Path, [string]$Service)
    New-Item $Path -ItemType Directory -Force | Out-Null
    Get-ChildItem $Path -Force -Recurse -ErrorAction SilentlyContinue | ForEach-Object {
        try { $_.Attributes = $_.Attributes -band (-bnot [System.IO.FileAttributes]::ReadOnly) } catch {}
    }
    $grants = @('*S-1-5-18:(OI)(CI)F', '*S-1-5-32-544:(OI)(CI)F')
    $serviceInfo = Get-CimInstance Win32_Service -Filter ("Name='{0}'" -f $Service) -ErrorAction SilentlyContinue
    $serviceAccount = [string]$serviceInfo.StartName
    if ($serviceAccount -and $serviceAccount -notin @('LocalSystem', 'NT AUTHORITY\SYSTEM')) { $grants += ('{0}:(OI)(CI)M' -f $serviceAccount) }
    $arguments = @($Path, '/inheritance:e', '/T', '/C', '/Q')
    foreach ($grant in $grants) { $arguments += @('/grant:r', $grant) }
    & $Icacls @arguments | Out-Null
    if ($LASTEXITCODE -ne 0) {
        & $Takeown /F $Path /R /D Y | Out-Null
        if ($LASTEXITCODE -ne 0) { throw ('Unable to take ownership of: {0}' -f $Path) }
        & $Icacls @arguments | Out-Null
        if ($LASTEXITCODE -ne 0) { throw ('Unable to repair permissions on: {0}' -f $Path) }
    }
}

try {
    New-Item $StageRoot -ItemType Directory -Force | Out-Null
    Invoke-Checked $Git @('clone', '--depth', '1', '--single-branch', '--branch', $Branch, $Repository, $Stage)

    $ConfigPath = Join-Path $Stage 'config.json'
    $Entry = Join-Path $Stage 'SIRK-Portal.js'
    if (-not (Test-Path $ConfigPath -PathType Leaf)) { throw 'Repository does not contain config.json.' }
    if (-not (Test-Path $Entry -PathType Leaf)) { throw 'Repository does not contain SIRK-Portal.js.' }

    $config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
    if ([string]$config.shortName -cne 'SIRK-Portal') { throw ('Invalid shortName: {0}' -f $config.shortName) }
    Invoke-Checked $Node @('--check', $Entry)
    if (-not $SkipTests) { Invoke-Checked $Npm @('test') $Stage }

    $service = Get-Service $ServiceName -ErrorAction Stop
    if ($service.Status -ne 'Stopped') { Stop-Service $ServiceName -Force -ErrorAction Stop }

    New-Item $PluginsRoot -ItemType Directory -Force | Out-Null
    New-Item $BackupRoot -ItemType Directory -Force | Out-Null

    $current = if (Test-Path $Target) { $Target } elseif (Test-Path $LegacyTarget) { $LegacyTarget } else { $null }
    if ($current) { Copy-Item $current $Backup -Recurse -Force }

    if (-not (Test-Path $RuntimeData) -and (Test-Path $LegacyRuntimeData)) {
        Copy-Item $LegacyRuntimeData $RuntimeData -Recurse -Force
    }
    Repair-RuntimeDataPermissions -Path $RuntimeData -Service $ServiceName

    Remove-Item $Target -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item $LegacyTarget -Recurse -Force -ErrorAction SilentlyContinue
    Move-Item $Stage $Target

    Start-Service $ServiceName -ErrorAction Stop
    Start-Sleep -Seconds 6
    if ((Get-Service $ServiceName).Status -ne 'Running') { throw 'MeshCentral service did not start.' }

    Write-Host ('Installed SIRK Management Platform {0} from {1}@{2}' -f $config.version, $Repository, $Branch) -ForegroundColor Green
    Write-Host ('Plugin path: {0}' -f $Target)
    Write-Host ('Runtime data: {0}' -f $RuntimeData)
}
catch {
    try { if ((Get-Service $ServiceName -ErrorAction SilentlyContinue).Status -ne 'Running') { Start-Service $ServiceName -ErrorAction SilentlyContinue } } catch {}
    throw
}
finally {
    Remove-Item $StageRoot -Recurse -Force -ErrorAction SilentlyContinue
}
