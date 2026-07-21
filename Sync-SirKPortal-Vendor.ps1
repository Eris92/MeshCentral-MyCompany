#Requires -Version 5.1
[CmdletBinding()]
param(
    [string]$Repository = 'https://github.com/Eris92/SirK-Portal.git',
    [string]$Branch = 'main',
    [string]$MyCompanyPath = $PSScriptRoot,
    [string]$ServiceName = 'MeshCentral',
    [switch]$RestartService
)

$ErrorActionPreference = 'Stop'
$Git = (Get-Command git.exe -ErrorAction Stop).Source
$Stage = Join-Path $env:TEMP ('SirK-Portal-Vendor-' + [guid]::NewGuid().ToString('N'))
$Destination = Join-Path $MyCompanyPath 'public\vendor\sirk-portal'
$Files = @(
    'sirk-portal.css',
    'sirk-preflight-0.3.13.js',
    'sirk-portal.js',
    'sirk-remote-modules-0.3.13.js',
    'sirk-portal-patch-0.2.8.js',
    'sirk-ui-icons-0.3.4.js',
    'sirk-layout-0.3.1.js',
    'sirk-management-workspace-0.3.6.js',
    'sirk-ui-runtime-0.3.15.js',
    'sirk-device-layout-0.3.13.js',
    'sirk-controls-0.3.17.js'
)

try {
    & $Git clone --depth 1 --single-branch --branch $Branch $Repository $Stage
    if ($LASTEXITCODE -ne 0) { throw 'Unable to clone SirK-Portal.' }

    $Config = Get-Content (Join-Path $Stage 'config.json') -Raw | ConvertFrom-Json
    if ([string]$Config.shortName -cne 'SirKPortal') {
        throw ('Invalid SirK Portal repository: {0}' -f $Config.shortName)
    }
    if ([version]$Config.version -lt [version]'0.3.17') {
        throw ('SirK Portal 0.3.17 or newer is required. Found: {0}' -f $Config.version)
    }

    Remove-Item $Destination -Recurse -Force -ErrorAction SilentlyContinue
    New-Item $Destination -ItemType Directory -Force | Out-Null

    foreach ($File in $Files) {
        $Source = Join-Path $Stage $File
        if (-not (Test-Path $Source -PathType Leaf)) {
            throw ('Missing SirK Portal asset: {0}' -f $File)
        }
        Copy-Item $Source (Join-Path $Destination $File) -Force
    }

    $Commit = (& $Git -C $Stage rev-parse HEAD).Trim()
    [ordered]@{
        version = [string]$Config.version
        commit = $Commit
        repository = $Repository
        branch = $Branch
        synchronizedAt = (Get-Date).ToUniversalTime().ToString('o')
        files = $Files
    } | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $Destination 'vendor-manifest.json') -Encoding UTF8

    Write-Host ('Synchronized SirK Portal {0} ({1})' -f $Config.version, $Commit) -ForegroundColor Green
    Write-Host ('Destination: {0}' -f $Destination)

    if ($RestartService) {
        Restart-Service $ServiceName -Force
        Write-Host ('Restarted service: {0}' -f $ServiceName) -ForegroundColor Green
    }
}
finally {
    Remove-Item $Stage -Recurse -Force -ErrorAction SilentlyContinue
}
