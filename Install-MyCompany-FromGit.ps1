#Requires -RunAsAdministrator
[CmdletBinding()]
param(
    [string]$Repository = 'https://github.com/Eris92/MeshCentral-MyCompany.git',
    [string]$Branch = 'main',
    [string]$MeshRoot = 'C:\Program Files\Open Source\MeshCentral',
    [string]$ServiceName = 'MeshCentral',
    [switch]$SkipTests
)

$ErrorActionPreference = 'Stop'
$DataRoot = Join-Path $MeshRoot 'meshcentral-data'
$PluginsRoot = Join-Path $DataRoot 'plugins'
$Target = Join-Path $PluginsRoot 'MyCompany'
$StageRoot = Join-Path $env:TEMP ('MyCompany-Git-' + [guid]::NewGuid().ToString('N'))
$Stage = Join-Path $StageRoot 'MyCompany'
$BackupRoot = Join-Path $DataRoot 'plugin-backups'
$Backup = Join-Path $BackupRoot ('MyCompany-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
$Git = (Get-Command git.exe -ErrorAction Stop).Source
$Node = (Get-Command node.exe -ErrorAction Stop).Source

function Invoke-Checked {
    param([string]$FilePath, [string[]]$Arguments, [string]$WorkingDirectory = '')
    $start = @{ FilePath = $FilePath; ArgumentList = $Arguments; Wait = $true; PassThru = $true; NoNewWindow = $true }
    if ($WorkingDirectory) { $start.WorkingDirectory = $WorkingDirectory }
    $p = Start-Process @start
    if ($p.ExitCode -ne 0) { throw ('Command failed ({0}): {1} {2}' -f $p.ExitCode, $FilePath, ($Arguments -join ' ')) }
}

try {
    New-Item $StageRoot -ItemType Directory -Force | Out-Null
    Invoke-Checked $Git @('clone','--depth','1','--single-branch','--branch',$Branch,$Repository,$Stage)

    $ConfigPath = Join-Path $Stage 'config.json'
    $Entry = Join-Path $Stage 'MyCompany.js'
    if (-not (Test-Path $ConfigPath -PathType Leaf)) { throw 'Repository does not contain config.json.' }
    if (-not (Test-Path $Entry -PathType Leaf)) { throw 'Repository does not contain MyCompany.js.' }
    $config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
    if ([string]$config.shortName -cne 'MyCompany') { throw ('Invalid shortName: {0}' -f $config.shortName) }
    $entrypoints = @(Get-ChildItem $Stage -File | Where-Object { $_.Name.ToLowerInvariant() -eq 'mycompany.js' })
    if ($entrypoints.Count -ne 1 -or $entrypoints[0].Name -cne 'MyCompany.js') { throw 'Entrypoint collision detected.' }
    Invoke-Checked $Node @('--check',$Entry)
    if (-not $SkipTests) { Invoke-Checked (Get-Command npm.cmd -ErrorAction Stop).Source @('test') $Stage }

    $service = Get-Service $ServiceName -ErrorAction Stop
    if ($service.Status -ne 'Stopped') { Stop-Service $ServiceName -Force -ErrorAction Stop }
    New-Item $PluginsRoot -ItemType Directory -Force | Out-Null
    New-Item $BackupRoot -ItemType Directory -Force | Out-Null
    if (Test-Path $Target) { Copy-Item $Target $Backup -Recurse -Force }
    Remove-Item $Target -Recurse -Force -ErrorAction SilentlyContinue
    Move-Item $Stage $Target
    Start-Service $ServiceName -ErrorAction Stop
    Start-Sleep -Seconds 6
    if ((Get-Service $ServiceName).Status -ne 'Running') { throw 'MeshCentral service did not start.' }
    Write-Host ('Installed MyCompany {0} from {1}@{2}' -f $config.version, $Repository, $Branch) -ForegroundColor Green
    Write-Host ('Path: {0}' -f $Target)
    Write-Host 'The target is an exact Git checkout. Old files were removed.'
}
catch {
    try {
        if ((Get-Service $ServiceName -ErrorAction SilentlyContinue).Status -ne 'Running') { Start-Service $ServiceName -ErrorAction SilentlyContinue }
    } catch {}
    throw
}
finally {
    Remove-Item $StageRoot -Recurse -Force -ErrorAction SilentlyContinue
}
